import { resolve4 } from 'node:dns/promises';
import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/erros.js';

function credencialConfigurada() {
    if (env.EMAIL_PROVIDER === 'smtp') return env.SMTP_PASSWORD;
    return env.EMAIL_PROVIDER === 'brevo' ? env.BREVO_API_KEY : env.RESEND_API_KEY;
}

function remetenteBrevo() {
    const correspondencia = env.MAIL_FROM.match(/^(.*?)\s*<([^<>]+)>\s*$/);
    return correspondencia
        ? { name: correspondencia[1].trim(), email: correspondencia[2] }
        : { email: env.MAIL_FROM };
}

export async function enviarEmailTransacional({ para, assunto, texto, html }) {
    if (!credencialConfigurada() || !env.MAIL_FROM) {
        throw new AppError('O envio de e-mail ainda não está configurado', 503);
    }

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
        await transporter.sendMail({ from: env.MAIL_FROM, to: para, subject: assunto, text: texto, html });
        return;
    }

    const resposta = env.EMAIL_PROVIDER === 'brevo'
        ? await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ sender: remetenteBrevo(), to: [{ email: para }], subject: assunto, textContent: texto, htmlContent: html }),
            signal: AbortSignal.timeout(15_000),
        })
        : await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: env.MAIL_FROM, to: [para], subject: assunto, text: texto, html }),
            signal: AbortSignal.timeout(15_000),
        });

    if (!resposta.ok) {
        const detalhe = (await resposta.text()).slice(0, 300);
        const provedor = env.EMAIL_PROVIDER === 'brevo' ? 'Brevo' : 'Resend';
        throw new AppError(`Não foi possível enviar o e-mail (${provedor} ${resposta.status}: ${detalhe})`, 502);
    }
}
