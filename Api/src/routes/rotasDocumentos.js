import { Router } from 'express';
import multer from 'multer';
import { BD } from '../../db.js';
import { autenticarToken } from '../middlewares/autenticacao.js';
import { validar, validarUuidParam } from '../middlewares/validar.js';
import { documentTypeSchema, textDocumentSchema } from '../schemas/documentSchemas.js';
import { AppError, asyncHandler } from '../../utils/erros.js';
import { salvarArquivo, removerArquivo, lerArquivoPorUrl } from '../services/storageService.js';
import { parseBoletoInfo } from '../services/boletoService.js';
import { enfileirarJob, enfileirarJobUnico } from '../services/jobService.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { analyzeDocumentSemantics, financialItemsToLegacyCosts } from '../services/documentSemanticsService.js';

const router = Router();

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const TIPOS_GENERICOS = new Set(['application/octet-stream', 'binary/octet-stream', '']);
const MIME_POR_EXTENSAO = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
};

// Alguns provedores de arquivos no Android identificam PDFs como
// application/octet-stream. A assinatura do arquivo ainda é validada no
// storageService; aqui só recuperamos o MIME correto a partir da extensão.
export function normalizarMimeDoUpload(file) {
    const mime = String(file?.mimetype || '').toLowerCase();
    if (TIPOS_PERMITIDOS.includes(mime)) return file;
    if (!TIPOS_GENERICOS.has(mime)) {
        throw new AppError('Tipo de arquivo não permitido. Envie PDF, JPG ou PNG.', 400);
    }

    const extensao = String(file?.originalname || '').split('.').pop().toLowerCase();
    const mimeInferido = MIME_POR_EXTENSAO[extensao];
    if (!mimeInferido) {
        throw new AppError('Tipo de arquivo não permitido. Envie PDF, JPG ou PNG.', 400);
    }
    file.mimetype = mimeInferido;
    return file;
}

function publicDocument(documento) {
    const { storage_path, user_id, extracted_text, ...publico } = documento;
    return publico;
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const mime = String(file.mimetype || '').toLowerCase();
        if (!TIPOS_PERMITIDOS.includes(mime) && !TIPOS_GENERICOS.has(mime)) {
            return cb(new AppError('Tipo de arquivo não permitido. Envie PDF, JPG ou PNG.', 400));
        }
        cb(null, true);
    },
});

/**
 * @swagger
 * /documents:
 *   post:
 *     tags: ["Documentos"]
 *     summary: "Envia um novo documento (contrato, exame, boleto, termo de uso...)"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               arquivo: { type: string, format: binary }
 *               document_type:
 *                 type: string
 *                 enum: [contrato, exame, boleto, termo_de_uso, outro]
 *     responses:
 *       201: { description: "Documento enviado com sucesso" }
 *       400: { description: "Arquivo ausente, tipo de arquivo inválido ou document_type inválido" }
 */
router.post(
    '/',
    autenticarToken,
    upload.single('arquivo'),
    validar(documentTypeSchema),
    asyncHandler(async (req, res) => {
        const { document_type } = req.body;

        if (document_type === 'exame' && !env.SENSITIVE_DOCUMENTS_ENABLED) {
            throw new AppError('Análise de exames ainda não está disponível nesta versão', 422);
        }

        if (!req.file) {
            throw new AppError('Nenhum arquivo enviado', 400);
        }

        normalizarMimeDoUpload(req.file);
        const arquivoSalvo = await salvarArquivo(req.file);
        try {
            const resultado = await BD.query(
                `INSERT INTO documents (user_id, original_name, document_type, storage_url, storage_path, mime_type, status, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, 'queued', NOW())
             RETURNING *`,
                [req.usuario.id_usuario, req.file.originalname, document_type, arquivoSalvo.url, arquivoSalvo.caminho, req.file.mimetype]
            );

            logger.info({ documentId: resultado.rows[0].id, storagePath: arquivoSalvo.caminho, storageUrl: arquivoSalvo.url, mime: req.file.mimetype }, 'Upload de documento persistido');
            const job = await enfileirarJobUnico('extract_document_text', { documentId: resultado.rows[0].id, userId: req.usuario.id_usuario });

            return res.status(202).json({
                message: 'Documento enviado e aguardando extração de texto',
                documento: publicDocument(resultado.rows[0]),
                job: { id: job.id, status: job.status },
            });
        } catch (error) {
            await removerArquivo(arquivoSalvo.caminho);
            throw error;
        }
    })
);

router.post('/text', autenticarToken, validar(textDocumentSchema), asyncHandler(async (req, res) => {
    const { document_type, text, name } = req.body;
    if (document_type === 'exame' && !env.SENSITIVE_DOCUMENTS_ENABLED) throw new AppError('Análise de exames ainda não está disponível nesta versão', 422);
    const resultado = await BD.query(
        `INSERT INTO documents (user_id, original_name, document_type, storage_url, mime_type, extracted_text, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'extracted', NOW())
         RETURNING *`,
        [req.usuario.id_usuario, name || 'Texto digitado', document_type, 'text://manual-entry', 'text/plain', text.trim()]
    );
    const documento = resultado.rows[0];
    const job = await enfileirarJobUnico('analyze_document', { documentId: documento.id, userId: req.usuario.id_usuario });
    return res.status(202).json({ message: 'Texto enviado para análise', documento: publicDocument(documento), job: { id: job.id, status: job.status } });
}));

/**
 * @swagger
 * /documents:
 *   get:
 *     tags: ["Documentos"]
 *     summary: "Lista os documentos do usuário autenticado"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Lista de documentos" }
 */
router.get('/', autenticarToken, asyncHandler(async (req, res) => {
    const resultado = await BD.query(
        `SELECT d.id, d.original_name, d.document_type, d.mime_type, d.status, d.error_message,
                d.created_at, d.updated_at,
                a.summary AS analysis_summary, a.deadlines AS analysis_deadlines,
                a.costs AS analysis_costs, a.warnings AS analysis_warnings,
                a.raw_ai_response->'action_items' AS analysis_action_items,
                a.raw_ai_response->'structured_analysis' AS analysis_structured,
                a.created_at AS analysis_created_at
         FROM documents d
         LEFT JOIN LATERAL (
             SELECT summary, deadlines, costs, warnings, raw_ai_response, created_at
             FROM analyses
             WHERE document_id = d.id
             ORDER BY created_at DESC
             LIMIT 1
         ) a ON true
         WHERE d.user_id = $1
         ORDER BY d.created_at DESC`,
        [req.usuario.id_usuario]
    );
    return res.status(200).json(resultado.rows);
}));

// Radar de prazos: o cliente pode mostrar alertas e criar notificações locais.
router.get('/deadlines/upcoming', autenticarToken, asyncHandler(async (req, res) => {
    const dias = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 30, 1), 365);
    const resultado = await BD.query(
        `SELECT dd.id, dd.description, dd.due_date, d.id AS document_id, d.original_name, d.document_type
           FROM document_deadlines dd
           JOIN documents d ON d.id = dd.document_id
          WHERE d.user_id = $1
            AND dd.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $2::integer
          ORDER BY dd.due_date ASC`,
        [req.usuario.id_usuario, dias]
    );
    return res.status(200).json({ days: dias, deadlines: resultado.rows });
}));

router.get('/jobs/:jobId', autenticarToken, validarUuidParam('jobId'), asyncHandler(async (req, res) => {
    const resultado = await BD.query(
        `SELECT id, type, status, attempts, max_attempts, created_at, completed_at, last_error
          FROM jobs
          WHERE id = $1
            AND (
                payload->>'userId' = $2::text
                OR payload->>'documentId' IN (
                    SELECT id::text FROM documents WHERE user_id = $2::uuid
                )
            )`,
        [req.params.jobId, req.usuario.id_usuario]
    );
    if (!resultado.rows[0]) throw new AppError('Job não encontrado', 404);
    return res.status(200).json({ job: resultado.rows[0] });
}));

router.post('/:id/retry', autenticarToken, validarUuidParam(), asyncHandler(async (req, res) => {
    const resultado = await BD.query(`UPDATE documents SET status = CASE WHEN extracted_text IS NOT NULL AND BTRIM(extracted_text) <> '' THEN 'extracted' ELSE 'queued' END, error_message = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2 AND status = 'failed' RETURNING id, extracted_text`, [req.params.id, req.usuario.id_usuario]);
    if (!resultado.rows[0]) throw new AppError('Este documento não pode ser reprocessado', 409);
    const type = resultado.rows[0].extracted_text?.trim() ? 'analyze_document' : 'extract_document_text';
    const job = await enfileirarJobUnico(type, { documentId: req.params.id, userId: req.usuario.id_usuario });
    return res.status(202).json({ message: 'Documento reenfileirado', job: { id: job.id, status: job.status } });
}));

/**
 * @swagger
 * /documents/{id}:
 *   get:
 *     tags: ["Documentos"]
 *     summary: "Retorna os detalhes de um documento"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Documento encontrado" }
 *       404: { description: "Documento não encontrado" }
 */
router.get('/:id', autenticarToken, validarUuidParam(), asyncHandler(async (req, res) => {
    const resultado = await BD.query(
        `SELECT d.id, d.original_name, d.document_type, d.storage_url, d.mime_type,
                d.extracted_text, d.status, d.error_message, d.created_at, d.updated_at,
                a.summary AS analysis_summary, a.deadlines AS analysis_deadlines,
                a.costs AS analysis_costs, a.warnings AS analysis_warnings,
                a.raw_ai_response->'action_items' AS analysis_action_items,
                a.raw_ai_response->'structured_analysis' AS analysis_structured,
                a.created_at AS analysis_created_at
         FROM documents d
         LEFT JOIN LATERAL (
             SELECT summary, deadlines, costs, warnings, raw_ai_response, created_at
             FROM analyses
             WHERE document_id = d.id
             ORDER BY created_at DESC
             LIMIT 1
         ) a ON true
         WHERE d.id = $1 AND d.user_id = $2`,
        [req.params.id, req.usuario.id_usuario]
    );

    if (resultado.rows.length === 0) {
        throw new AppError('Documento não encontrado', 404);
    }

    const document = resultado.rows[0];
    if (!document.analysis_structured && document.extracted_text && document.analysis_summary) {
        const structured = analyzeDocumentSemantics(document.extracted_text, { summary: document.analysis_summary }, document.document_type);
        document.analysis_structured = structured;
        const semanticCosts = financialItemsToLegacyCosts(structured.financial_items);
        if (semanticCosts.length) document.analysis_costs = semanticCosts;
        if (structured.warnings.length) document.analysis_warnings = [...(document.analysis_warnings || []), ...structured.warnings];
        document.analysis_summary = structured.summary || document.analysis_summary;
    }
    return res.status(200).json(document);
}));

/**
 * @swagger
 * /documents/{id}/file:
 *   get:
 *     tags: ["Documentos"]
 *     summary: "Baixa o arquivo original do documento"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Arquivo original" }
 *       404: { description: "Documento ou arquivo não encontrado" }
 */
router.get('/:id/file', autenticarToken, validarUuidParam(), asyncHandler(async (req, res) => {
    const resultado = await BD.query(
        'SELECT original_name, storage_url, mime_type FROM documents WHERE id = $1 AND user_id = $2',
        [req.params.id, req.usuario.id_usuario]
    );

    if (resultado.rows.length === 0) {
        throw new AppError('Documento não encontrado', 404);
    }

    if (resultado.rows[0].storage_url === 'text://manual-entry') throw new AppError('Este documento não possui arquivo original', 404);
    const arquivo = await lerArquivoPorUrl(resultado.rows[0].storage_url);
    const nomeSeguro = resultado.rows[0].original_name.replace(/[\r\n"\\/]/g, '_');
    res.set({
        'Content-Type': resultado.rows[0].mime_type || 'application/octet-stream',
        'Content-Length': String(arquivo.length),
        'Content-Disposition': `attachment; filename="${nomeSeguro}"`,
        'Cache-Control': 'private, no-store',
    });
    return res.send(arquivo);
}));

/**
 * @swagger
 * /documents/{id}/boleto:
 *   get:
 *     tags: ["Documentos"]
 *     summary: "Extrai as informações do boleto de um documento do tipo boleto"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Informações do boleto extraídas" }
 *       404: { description: "Documento não encontrado" }
 */
router.get('/:id/boleto', autenticarToken, validarUuidParam(), asyncHandler(async (req, res) => {
    const resultado = await BD.query(
        'SELECT document_type, extracted_text FROM documents WHERE id = $1 AND user_id = $2',
        [req.params.id, req.usuario.id_usuario]
    );

    if (resultado.rows.length === 0) {
        throw new AppError('Documento não encontrado', 404);
    }

    const documento = resultado.rows[0];
    if (documento.document_type !== 'boleto') {
        throw new AppError('Documento não é do tipo boleto', 400);
    }

    const boletoInfo = parseBoletoInfo(documento.extracted_text);
    return res.status(200).json({ boleto: boletoInfo });
}));

/**
 * @swagger
 * /documents/{id}/contract-summary:
 *   get:
 *     tags: ["Documentos"]
 *     summary: "Gera um resumo especializado de contrato"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Resumo de contrato gerado" }
 */
router.get('/:id/contract-summary', autenticarToken, validarUuidParam(), asyncHandler(async (req, res) => {
    const resultado = await BD.query(
        `SELECT d.document_type, a.summary, a.deadlines, a.costs, a.warnings
           FROM documents d
           LEFT JOIN LATERAL (
               SELECT summary, deadlines, costs, warnings FROM analyses
                WHERE document_id = d.id ORDER BY created_at DESC LIMIT 1
           ) a ON true
          WHERE d.id = $1 AND d.user_id = $2`,
        [req.params.id, req.usuario.id_usuario]
    );

    if (resultado.rows.length === 0) {
        throw new AppError('Documento não encontrado', 404);
    }

    const documento = resultado.rows[0];
    if (documento.document_type !== 'contrato') {
        throw new AppError('Documento não é do tipo contrato', 400);
    }

    if (!documento.summary) throw new AppError('A análise do contrato ainda não está disponível', 404);
    return res.status(200).json({ contract_summary: { summary: documento.summary, deadlines: documento.deadlines || [], costs: documento.costs || [], warnings: documento.warnings || [] } });
}));

/**
 * @swagger
 * /documents/{id}:
 *   delete:
 *     tags: ["Documentos"]
 *     summary: "Remove um documento (e suas análises, em cascata)"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Documento removido com sucesso" }
 *       404: { description: "Documento não encontrado" }
 */
router.delete('/:id', autenticarToken, validarUuidParam(), asyncHandler(async (req, res) => {
    const resultado = await BD.query(
        'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING storage_url, storage_path',
        [req.params.id, req.usuario.id_usuario]
    );

    if (resultado.rows.length === 0) {
        throw new AppError('Documento não encontrado', 404);
    }

    await removerArquivo(resultado.rows[0].storage_url || resultado.rows[0].storage_path);

    return res.status(200).json({ message: 'Documento removido com sucesso' });
}));

export default router;
