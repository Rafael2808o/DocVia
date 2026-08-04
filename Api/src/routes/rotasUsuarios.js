import { Router } from 'express';
import { BD } from '../../db.js';
import { autenticarToken } from '../middlewares/autenticacao.js';
import { validar } from '../middlewares/validar.js';
import { AppError, asyncHandler } from '../../utils/erros.js';
import { buscarDetalhesDoPlano } from '../services/billingService.js';
import { consentSchema, deleteAccountSchema } from '../schemas/authSchemas.js';
import { nomeArquivoDaUrl, removerArquivo } from '../services/storageService.js';
import { env } from '../../config/env.js';
import path from 'node:path';

const router = Router();

/**
 * @swagger
 * /users/me:
 *   get:
 *     tags: ["Usuários"]
 *     summary: "Retorna os dados do usuário autenticado"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Dados obtidos com sucesso" }
 *       401: { description: "Token não fornecido" }
 *       403: { description: "Token inválido ou expirado" }
 */
router.get('/me', autenticarToken, asyncHandler(async (req, res) => {
    const resultado = await BD.query(
            'SELECT id, name, email, plan, created_at FROM users WHERE id = $1',
            [req.usuario.id_usuario]
        );

    if (resultado.rows.length === 0) {
        throw new AppError('Usuário não encontrado', 404);
    }

    const usuario = resultado.rows[0];
    const planDetails = buscarDetalhesDoPlano(usuario.plan);

    return res.status(200).json({
        ...usuario,
        plan_details: planDetails,
    });
}));

router.get('/privacy-policy', (req, res) => res.status(200).json({
    version: '1.0',
    updated_at: '2026-08-03',
    summary: 'O DocVia usa seus documentos exclusivamente para extração e análise solicitadas por você. Você pode exportar ou excluir seus dados a qualquer momento.',
    data_collected: ['dados da conta', 'documentos enviados', 'textos extraídos', 'análises e uso do serviço'],
    retention: 'Os dados permanecem até a exclusão da conta, salvo obrigação legal aplicável.',
    contact: 'Defina um e-mail de privacidade antes da publicação.',
}));

router.post('/privacy-consent', autenticarToken, validar(consentSchema), asyncHandler(async (req, res) => {
    await BD.query('UPDATE users SET privacy_consent_at = NOW(), updated_at = NOW() WHERE id = $1', [req.usuario.id_usuario]);
    return res.status(200).json({ message: 'Consentimento de privacidade registrado' });
}));

router.get('/me/export', autenticarToken, asyncHandler(async (req, res) => {
    const [usuario, documentos, analises, assinaturas] = await Promise.all([
        BD.query('SELECT id, name, email, plan, created_at, privacy_consent_at FROM users WHERE id = $1', [req.usuario.id_usuario]),
        BD.query('SELECT id, original_name, document_type, status, created_at FROM documents WHERE user_id = $1 ORDER BY created_at DESC', [req.usuario.id_usuario]),
        BD.query(`SELECT a.id, a.document_id, a.summary, a.deadlines, a.costs, a.warnings, a.created_at
                  FROM analyses a JOIN documents d ON d.id = a.document_id WHERE d.user_id = $1 ORDER BY a.created_at DESC`, [req.usuario.id_usuario]),
        BD.query('SELECT status, started_at, expires_at, payment_provider, amount, currency FROM subscriptions WHERE user_id = $1 ORDER BY started_at DESC', [req.usuario.id_usuario]),
    ]);
    if (!usuario.rows[0]) throw new AppError('Usuário não encontrado', 404);
    return res.status(200).json({ exported_at: new Date().toISOString(), user: usuario.rows[0], documents: documentos.rows, analyses: analises.rows, subscriptions: assinaturas.rows });
}));

router.delete('/me', autenticarToken, validar(deleteAccountSchema), asyncHandler(async (req, res) => {
    const documentos = await BD.query('SELECT storage_url FROM documents WHERE user_id = $1', [req.usuario.id_usuario]);
    for (const documento of documentos.rows) {
        const nome = nomeArquivoDaUrl(documento.storage_url);
        if (nome) await removerArquivo(path.join(env.STORAGE_DIR, nome));
    }
    const resultado = await BD.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.usuario.id_usuario]);
    if (!resultado.rows[0]) throw new AppError('Usuário não encontrado', 404);
    return res.status(200).json({ message: 'Conta e dados associados excluídos' });
}));

export default router;
