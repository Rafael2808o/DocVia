import crypto from 'node:crypto';
import { BD } from '../../db.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/erros.js';

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function criarTokenRedefinicao(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    await BD.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]);
    await BD.query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'15 minutes\')', [userId, hash(token)]);
    return token;
}

export async function consumirTokenRedefinicao(token) {
    const resultado = await BD.query(
        `UPDATE password_reset_tokens SET used_at = NOW()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING user_id`, [hash(token)]
    );
    return resultado.rows[0]?.user_id || null;
}

export async function enviarEmailRedefinicao(email, token) {
    if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.PASSWORD_RESET_URL) {
        throw new AppError('Recuperação por e-mail ainda não está configurada', 503);
    }
    const link = new URL(env.PASSWORD_RESET_URL);
    link.searchParams.set('token', token);
    const resposta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [email], subject: 'Redefina sua senha DocVia', html: `<p>Use este link em até 15 minutos:</p><p><a href="${link.toString()}">Redefinir senha</a></p>` }),
    });
    if (!resposta.ok) throw new AppError('Não foi possível enviar o e-mail de recuperação', 502);
}
