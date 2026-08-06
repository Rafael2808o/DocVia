import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { BD } from '../../db.js';
import { autenticarToken } from '../middlewares/autenticacao.js';
import { validar, validarUuidParam } from '../middlewares/validar.js';
import { documentTypeSchema } from '../schemas/documentSchemas.js';
import { AppError, asyncHandler } from '../../utils/erros.js';
import { salvarArquivo, removerArquivo, nomeArquivoDaUrl } from '../services/storageService.js';
import { analisarDocumentoComIA } from '../services/iaService.js';
import { parseBoletoInfo } from '../services/boletoService.js';
import { env } from '../../config/env.js';
import { enfileirarJob, enfileirarJobUnico } from '../services/jobService.js';
import { logger } from '../../config/logger.js';

const router = Router();

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
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

        if (!req.file) {
            throw new AppError('Nenhum arquivo enviado', 400);
        }

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
                documento: resultado.rows[0],
                job: { id: job.id, status: job.status },
            });
        } catch (error) {
            await removerArquivo(arquivoSalvo.caminho);
            throw error;
        }
    })
);

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
        `SELECT d.*, a.summary AS analysis_summary, a.deadlines AS analysis_deadlines,
                a.costs AS analysis_costs, a.warnings AS analysis_warnings,
                a.created_at AS analysis_created_at
         FROM documents d
         LEFT JOIN LATERAL (
             SELECT summary, deadlines, costs, warnings, created_at
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
            AND (payload->>'userId' = $2 OR payload->>'documentId' IN (SELECT id::text FROM documents WHERE user_id = $2))`,
        [req.params.jobId, req.usuario.id_usuario]
    );
    if (!resultado.rows[0]) throw new AppError('Job não encontrado', 404);
    return res.status(200).json({ job: resultado.rows[0] });
}));

router.post('/:id/retry', autenticarToken, validarUuidParam(), asyncHandler(async (req, res) => {
    const resultado = await BD.query(`UPDATE documents SET status = 'queued', error_message = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2 AND status = 'failed' RETURNING id`, [req.params.id, req.usuario.id_usuario]);
    if (!resultado.rows[0]) throw new AppError('Este documento não pode ser reprocessado', 409);
    const job = await enfileirarJobUnico('extract_document_text', { documentId: req.params.id, userId: req.usuario.id_usuario });
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
        `SELECT d.*, a.summary AS analysis_summary, a.deadlines AS analysis_deadlines,
                a.costs AS analysis_costs, a.warnings AS analysis_warnings,
                a.created_at AS analysis_created_at
         FROM documents d
         LEFT JOIN LATERAL (
             SELECT summary, deadlines, costs, warnings, created_at
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

    return res.status(200).json(resultado.rows[0]);
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
        'SELECT original_name, storage_url FROM documents WHERE id = $1 AND user_id = $2',
        [req.params.id, req.usuario.id_usuario]
    );

    if (resultado.rows.length === 0) {
        throw new AppError('Documento não encontrado', 404);
    }

    const nomeArquivo = nomeArquivoDaUrl(resultado.rows[0].storage_url);
    if (!nomeArquivo) throw new AppError('Arquivo do documento não encontrado', 404);

    return res.sendFile(nomeArquivo, {
        root: path.resolve(env.STORAGE_DIR),
        headers: { 'Content-Disposition': `attachment; filename="${resultado.rows[0].original_name.replace(/[\r\n"]/g, '')}"` },
    });
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
        'SELECT document_type, extracted_text FROM documents WHERE id = $1 AND user_id = $2',
        [req.params.id, req.usuario.id_usuario]
    );

    if (resultado.rows.length === 0) {
        throw new AppError('Documento não encontrado', 404);
    }

    const documento = resultado.rows[0];
    if (documento.document_type !== 'contrato') {
        throw new AppError('Documento não é do tipo contrato', 400);
    }

    if (!documento.extracted_text?.trim()) {
        throw new AppError('Documento não possui texto extraído para análise', 422);
    }

    const resumo = await analisarDocumentoComIA(documento.extracted_text, 'contrato');
    return res.status(200).json({ contract_summary: resumo });
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
        'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING storage_url',
        [req.params.id, req.usuario.id_usuario]
    );

    if (resultado.rows.length === 0) {
        throw new AppError('Documento não encontrado', 404);
    }

    const nomeArquivo = nomeArquivoDaUrl(resultado.rows[0].storage_url);
    if (nomeArquivo) {
        await removerArquivo(path.join(env.STORAGE_DIR, nomeArquivo));
    }

    return res.status(200).json({ message: 'Documento removido com sucesso' });
}));

export default router;
