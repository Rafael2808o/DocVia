import crypto from 'node:crypto';
import { BD } from '../../db.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/erros.js';
import { enviarEmailTransacional } from './emailService.js';

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function criarTokenVerificacao(userId, cliente = BD) {
    const token = crypto.randomBytes(32).toString('hex');
    await cliente.query('UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]);
    await cliente.query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
        [userId, hash(token)]
    );
    return token;
}

export async function consumirTokenVerificacao(token, cliente = BD) {
    const resultado = await cliente.query(
        `UPDATE email_verification_tokens SET used_at = NOW()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING user_id`,
        [hash(token)]
    );
    return resultado.rows[0]?.user_id || null;
}

export async function enviarEmailVerificacao(email, token) {
    if (!env.EMAIL_VERIFICATION_URL) {
        throw new AppError('Verificação de e-mail ainda não está configurada', 503);
    }
    const link = new URL(env.EMAIL_VERIFICATION_URL);
    link.searchParams.set('token', token);
    const texto = `Confirme seu e-mail DocVia em até 24 horas: ${link.toString()}`;
    const html = [
        '<p>Confirme que este e-mail pertence a você.</p>',
        `<p><a href="${link.toString()}">Confirmar meu e-mail</a></p>`,
        '<p>Este link expira em 24 horas. Se você não solicitou o cadastro, ignore esta mensagem.</p>',
    ].join('');
    await enviarEmailTransacional({ para: email, assunto: 'Confirme seu e-mail no DocVia', texto, html });
}
