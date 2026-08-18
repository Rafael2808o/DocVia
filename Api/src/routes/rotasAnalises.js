import { Router } from 'express';
import { BD } from '../../db.js';
import { autenticarToken } from '../middlewares/autenticacao.js';
import { validarUuidParam } from '../middlewares/validar.js';
import { enfileirarJobUnico } from '../services/jobService.js';
import { AppError, asyncHandler } from '../../utils/erros.js';

const router = Router();

/**
 * @swagger
 * /documents/{id}/analyze:
 *   post:
 *     tags: ["Análises"]
 *     summary: "Roda a análise de IA sobre um documento já enviado"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201: { description: "Análise concluída" }
 *       404: { description: "Documento não encontrado" }
 *       429: { description: "Limite diário de análises atingido" }
 */
router.post('/:id/analyze', autenticarToken, validarUuidParam(), asyncHandler(async (req, res) => {
    const documento = await BD.query(
            'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
            [req.params.id, req.usuario.id_usuario]
        );

    if (documento.rows.length === 0) {
        throw new AppError('Documento não encontrado', 404);
    }

    const doc = documento.rows[0];
    if (!doc.extracted_text?.trim()) {
        throw new AppError('O documento ainda não possui texto extraído para análise', 422);
    }
    const job = await enfileirarJobUnico('analyze_document', { documentId: doc.id, userId: req.usuario.id_usuario });
    return res.status(202).json({ message: 'Análise enfileirada', job: { id: job.id, status: job.status } });
}));

/**
 * @swagger
 * /documents/{id}/analysis:
 *   get:
 *     tags: ["Análises"]
 *     summary: "Retorna a análise mais recente de um documento"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Análise encontrada" }
 *       404: { description: "Documento ou análise não encontrados" }
 */
router.get('/:id/analysis', autenticarToken, validarUuidParam(), asyncHandler(async (req, res) => {
    const documento = await BD.query(
            'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
            [req.params.id, req.usuario.id_usuario]
        );

    if (documento.rows.length === 0) {
        throw new AppError('Documento não encontrado', 404);
    }

    const analise = await BD.query(
            'SELECT * FROM analyses WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1',
            [req.params.id]
        );

    if (analise.rows.length === 0) {
        throw new AppError('Esse documento ainda não foi analisado', 404);
    }

    const resultado = analise.rows[0];
    const actionItems = resultado.raw_ai_response?.action_items ?? [];
    const evidence = resultado.raw_ai_response?.evidence ?? [];
    const structuredAnalysis = resultado.raw_ai_response?.structured_analysis ?? null;

    return res.status(200).json({
        ...resultado,
        action_items: actionItems,
        evidence,
        structured_analysis: structuredAnalysis,
    });
}));

export default router;
