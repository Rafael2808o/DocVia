import { Router } from 'express';
import { BD } from '../../db.js';
import { autenticarToken } from '../middlewares/autenticacao.js';
import { reservarUsoNaTransacao } from '../services/usoService.js';
import { analisarDocumentoComIA } from '../services/iaService.js';
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
router.post('/:id/analyze', autenticarToken, asyncHandler(async (req, res) => {
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

    const resultadoIA = await analisarDocumentoComIA(doc.extracted_text);
    const cliente = await BD.connect();

    try {
        await cliente.query('BEGIN');
        const usuario = await cliente.query('SELECT plan FROM users WHERE id = $1 FOR UPDATE', [req.usuario.id_usuario]);
        const plano = usuario.rows[0]?.plan ?? 'free';
        const podeUsar = await reservarUsoNaTransacao(cliente, req.usuario.id_usuario, plano);
        if (!podeUsar) {
            throw new AppError('Limite diário de análises atingido. Faça upgrade para o plano premium.', 429);
        }

        const analise = await cliente.query(
                `INSERT INTO analyses (document_id, summary, deadlines, costs, warnings, raw_ai_response)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [
                    doc.id,
                    resultadoIA.summary,
                    JSON.stringify(resultadoIA.deadlines),
                    JSON.stringify(resultadoIA.costs),
                    JSON.stringify(resultadoIA.warnings),
                    JSON.stringify(resultadoIA.raw),
                ]
            );

        await cliente.query('UPDATE documents SET status = $1 WHERE id = $2', ['done', doc.id]);
        await cliente.query('COMMIT');

        return res.status(201).json({ message: 'Análise concluída', analise: analise.rows[0] });
    } catch (error) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        throw error;
    } finally {
        cliente.release();
    }
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
router.get('/:id/analysis', autenticarToken, asyncHandler(async (req, res) => {
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

    return res.status(200).json(analise.rows[0]);
}));

export default router;