import { Router } from 'express';
import { BD } from '../../db.js';
import { autenticarToken } from '../middlewares/autenticacao.js';
import { validar } from '../middlewares/validar.js';
import { AppError, asyncHandler } from '../../utils/erros.js';
import { buscarDetalhesDoPlano } from '../services/billingService.js';
import { consentSchema, deleteAccountSchema } from '../schemas/authSchemas.js';
import { removerArquivo } from '../services/storageService.js';
import { env } from '../../config/env.js';
import bcrypt from 'bcrypt';

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
    version: '1.1',
    updated_at: '2026-08-07',
    summary: 'O DocVia trata os dados necessários para oferecer a extração e a análise solicitadas, proteger a conta e operar o serviço. Você pode exportar ou excluir seus dados a qualquer momento.',
    data_collected: ['dados da conta', 'documentos enviados', 'textos extraídos', 'análises', 'registros mínimos de uso e segurança'],
    retention: 'Os dados permanecem até a exclusão da conta, salvo obrigação legal aplicável.',
    contact: env.PRIVACY_CONTACT_EMAIL || null,
    privacy_policy_url: env.PRIVACY_POLICY_URL || null,
    account_deletion_url: env.ACCOUNT_DELETION_URL || null,
}));

router.post('/privacy-consent', autenticarToken, validar(consentSchema), asyncHandler(async (req, res) => {
    await BD.query('UPDATE users SET privacy_consent_at = NOW(), updated_at = NOW() WHERE id = $1', [req.usuario.id_usuario]);
    return res.status(200).json({ message: 'Consentimento de privacidade registrado' });
}));

router.get('/me/export', autenticarToken, asyncHandler(async (req, res) => {
    const [usuario, documentos, analises, assinaturas, uso, prazos] = await Promise.all([
        BD.query('SELECT id, name, email, plan, created_at, privacy_consent_at FROM users WHERE id = $1', [req.usuario.id_usuario]),
        BD.query(`SELECT id, original_name, document_type, mime_type, extracted_text, status, error_message, created_at,
                         CASE WHEN storage_url = 'text://manual-entry' THEN NULL ELSE '/documents/' || id::text || '/file' END AS authenticated_file_endpoint
                    FROM documents WHERE user_id = $1 ORDER BY created_at DESC`, [req.usuario.id_usuario]),
        BD.query(`SELECT a.id, a.document_id, a.summary, a.deadlines, a.costs, a.warnings, a.raw_ai_response, a.created_at
                  FROM analyses a JOIN documents d ON d.id = a.document_id WHERE d.user_id = $1 ORDER BY a.created_at DESC`, [req.usuario.id_usuario]),
        BD.query('SELECT status, started_at, expires_at, payment_provider, amount, currency FROM subscriptions WHERE user_id = $1 ORDER BY started_at DESC', [req.usuario.id_usuario]),
        BD.query('SELECT action, created_at FROM usage_logs WHERE user_id = $1 ORDER BY created_at DESC', [req.usuario.id_usuario]),
        BD.query(`SELECT dd.document_id, dd.description, dd.due_date, dd.created_at
                    FROM document_deadlines dd JOIN documents d ON d.id = dd.document_id
                   WHERE d.user_id = $1 ORDER BY dd.due_date`, [req.usuario.id_usuario]),
    ]);
    if (!usuario.rows[0]) throw new AppError('Usuário não encontrado', 404);
    return res.status(200).json({ exported_at: new Date().toISOString(), user: usuario.rows[0], documents: documentos.rows, analyses: analises.rows, deadlines: prazos.rows, subscriptions: assinaturas.rows, usage: uso.rows });
}));

router.delete('/me', autenticarToken, validar(deleteAccountSchema), asyncHandler(async (req, res) => {
    const usuario = await BD.query('SELECT password_hash, email FROM users WHERE id = $1', [req.usuario.id_usuario]);
    if (!usuario.rows[0] || !usuario.rows[0].password_hash || !(await bcrypt.compare(req.body.password, usuario.rows[0].password_hash))) {
        throw new AppError('Senha incorreta', 401);
    }
    const documentos = await BD.query('SELECT storage_url, storage_path FROM documents WHERE user_id = $1', [req.usuario.id_usuario]);
    for (const documento of documentos.rows) {
        await removerArquivo(documento.storage_url || documento.storage_path);
    }
    const cliente = await BD.connect();
    try {
        await cliente.query('BEGIN');
        await cliente.query(`DELETE FROM jobs WHERE payload->>'userId' = $1 OR payload->>'documentId' IN (SELECT id::text FROM documents WHERE user_id = $1)`, [String(req.usuario.id_usuario)]);
        await cliente.query('DELETE FROM login_security WHERE email = $1', [usuario.rows[0].email.toLowerCase()]);
        const resultado = await cliente.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.usuario.id_usuario]);
        if (!resultado.rows[0]) throw new AppError('Usuário não encontrado', 404);
        await cliente.query('COMMIT');
    } catch (erro) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        throw erro;
    } finally {
        cliente.release();
    }
    return res.status(200).json({ message: 'Conta e dados associados excluídos' });
}));

export default router;
