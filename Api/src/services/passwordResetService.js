import crypto from 'node:crypto';
import { resolve4 } from 'node:dns/promises';
import nodemailer from 'nodemailer';
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

export async function consumirTokenRedefinicao(token, cliente = BD) {
    const resultado = await cliente.query(
        `UPDATE password_reset_tokens SET used_at = NOW()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING user_id`, [hash(token)]
    );
    return resultado.rows[0]?.user_id || null;
}

export async function enviarEmailRedefinicao(email, token) {
    const providerKey = env.EMAIL_PROVIDER === 'smtp'
        ? env.SMTP_PASSWORD
        : env.EMAIL_PROVIDER === 'brevo' ? env.BREVO_API_KEY : env.RESEND_API_KEY;
    if (!providerKey || !env.MAIL_FROM || !env.PASSWORD_RESET_URL) {
        throw new AppError('Recuperação por e-mail ainda não está configurada', 503);
    }
    const link = new URL(env.PASSWORD_RESET_URL);
    link.searchParams.set('token', token);
    const html = `<p>Use este link em até 15 minutos:</p><p><a href="${link.toString()}">Redefinir senha</a></p>`;
    let resposta;
    if (env.EMAIL_PROVIDER === 'smtp') {
        const [smtpIpv4] = await resolve4(env.SMTP_HOST);
        if (!smtpIpv4) throw new AppError('O servidor SMTP não possui endereço IPv4 disponível', 503);
        const transporter = nodemailer.createTransport({
            host: smtpIpv4,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
            tls: { servername: env.SMTP_HOST },
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 20_000,
        });
        await transporter.sendMail({
            from: env.MAIL_FROM,
            to: email,
            subject: 'Redefina sua senha DocVia',
            text: `Use este link em até 15 minutos: ${link.toString()}`,
            html,
        });
        return;
    }
    if (env.EMAIL_PROVIDER === 'brevo') {
        const correspondencia = env.MAIL_FROM.match(/^(.*?)\s*<([^<>]+)>\s*$/);
        const sender = correspondencia ? { name: correspondencia[1].trim(), email: correspondencia[2] } : { email: env.MAIL_FROM };
        resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ sender, to: [{ email }], subject: 'Redefina sua senha DocVia', htmlContent: html }),
        });
    } else {
        resposta = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: env.MAIL_FROM, to: [email], subject: 'Redefina sua senha DocVia', html }),
        });
    }
    if (!resposta.ok) throw new AppError('Não foi possível enviar o e-mail de recuperação', 502);
}
