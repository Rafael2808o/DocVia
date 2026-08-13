import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { logger } from './config/logger.js';
import { env, origensCors } from './config/env.js';
import { BD, testarConexao } from './db.js';
import { limitadorGeral } from './src/middlewares/limitadores.js';
import { tratarErros, rotaNaoEncontrada } from './src/middlewares/tratarErros.js';

import rotasAutenticacao from './src/routes/rotasAutenticacao.js';
import rotasUsuarios from './src/routes/rotasUsuarios.js';
import rotasBilling from './src/routes/rotasBilling.js';
import rotasDocumentos from './src/routes/rotasDocumentos.js';
import rotasAnalises from './src/routes/rotasAnalises.js';
import rotasUso from './src/routes/rotasUso.js';
import rotasInternas from './src/routes/rotasInternas.js';
import { iniciarWorker } from './src/services/jobService.js';
import { extrairTextoDoDocumento, analisarDocumentoEmSegundoPlano, expirarDocumentosParados } from './src/services/documentPipelineService.js';
import { garantirSchemaProcessamento, verificarSchemaProcessamento } from './src/services/processingSchemaService.js';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Segurança básica de headers HTTP (evita alguns ataques comuns tipo clickjacking)
app.use(helmet());
app.use(cors({
    origin: origensCors(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    },
}));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// A API devolve dados pessoais e estados que mudam durante o processamento.
// Impede que CDNs/proxies compartilhem ou retenham respostas autenticadas e
// evita que um 404 transitório durante um deploy fique armazenado no edge.
app.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
});

app.get('/health/live', (req, res) => res.status(200).json({ status: 'ok', version: env.API_VERSION }));
app.get('/health/ready', async (req, res) => {
    try {
        await BD.query('SELECT 1');
        return res.status(200).json({ status: 'ready', version: env.API_VERSION });
    } catch {
        return res.status(503).json({ status: 'unavailable' });
    }
});

// Loga cada requisição (método, rota, status, tempo de resposta)
app.use(pinoHttp({ logger }));

// Limite geral de requisições por IP - protege contra abuso/DoS simples
app.use('/internal', rotasInternas);
app.use(limitadorGeral);

// Documentação interativa em http://localhost:3000/docs
if (env.NODE_ENV !== 'production') {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
app.use('/auth', rotasAutenticacao);
app.use('/users', rotasUsuarios);
app.use('/billing', rotasBilling);
app.use('/documents', rotasDocumentos);
app.use('/documents', rotasAnalises);
app.use('/usage', rotasUso);

// A PARTIR DAQUI só middlewares de "fim de linha":
// 404 pra rota que não existe, e o tratador de erro por último.
app.use(rotaNaoEncontrada);
app.use(tratarErros);

export { app };

export async function iniciarServidor() {
    await testarConexao();
    if (env.AUTO_MIGRATE) await garantirSchemaProcessamento();
    else await verificarSchemaProcessamento();
    const pararWorker = env.JOB_MODE === 'worker' ? iniciarWorker({
        extract_document_text: extrairTextoDoDocumento,
        analyze_document: analisarDocumentoEmSegundoPlano,
    }) : () => undefined;
    const timeoutGuard = env.JOB_MODE === 'worker'
        ? setInterval(() => expirarDocumentosParados().catch((err) => logger.error({ err }, 'Falha no timeout guard')), 30_000)
        : null;
    const servidor = app.listen(env.PORT, () => {
        logger.info(`Servidor rodando em http://localhost:${env.PORT}`);
        logger.info(`Swagger disponível em http://localhost:${env.PORT}/docs`);
    });
    const encerrar = () => servidor.close(() => BD.end().finally(() => process.exit(0)));
    process.once('SIGTERM', encerrar);
    process.once('SIGINT', encerrar);
    servidor.on('close', () => { pararWorker(); if (timeoutGuard) clearInterval(timeoutGuard); });
    return servidor;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    iniciarServidor();
}
