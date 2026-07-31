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
import { testarConexao } from './db.js';
import { limitadorGeral } from './src/middlewares/limitadores.js';
import { tratarErros, rotaNaoEncontrada } from './src/middlewares/tratarErros.js';

import rotasAutenticacao from './src/routes/rotasAutenticacao.js';
import rotasUsuarios from './src/routes/rotasUsuarios.js';
import rotasDocumentos from './src/routes/rotasDocumentos.js';
import rotasAnalises from './src/routes/rotasAnalises.js';
import rotasUso from './src/routes/rotasUso.js';

const app = express();

// Segurança básica de headers HTTP (evita alguns ataques comuns tipo clickjacking)
app.use(helmet());
app.use(cors({ origin: origensCors() }));
app.use(express.json());

// Loga cada requisição (método, rota, status, tempo de resposta)
app.use(pinoHttp({ logger }));

// Limite geral de requisições por IP - protege contra abuso/DoS simples
app.use(limitadorGeral);

// Documentação interativa em http://localhost:3000/docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/auth', rotasAutenticacao);
app.use('/users', rotasUsuarios);
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
    return app.listen(env.PORT, () => {
        logger.info(`Servidor rodando em http://localhost:${env.PORT}`);
        logger.info(`Swagger disponível em http://localhost:${env.PORT}/docs`);
    });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    iniciarServidor();
}