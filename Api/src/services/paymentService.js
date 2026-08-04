import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/erros.js';
import { criarAssinaturaPendente, obterAssinaturaPorExternalId, ativarAssinaturaPremium } from './billingService.js';

const STRIPE_BASE_URL = 'https://api.stripe.com/v1';

function stripeHeaders() {
    return {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
    };
}

async function stripeApi(path, method = 'POST', body = null) {
    if (!env.STRIPE_SECRET_KEY) {
        throw new AppError('Stripe não configurado. Defina STRIPE_SECRET_KEY no .env', 503);
    }

    const url = `${STRIPE_BASE_URL}${path}`;
    const options = { method, headers: stripeHeaders() };

    if (body) {
        options.body = new URLSearchParams(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        const mensagem = data.error?.message || 'Erro ao comunicar com Stripe';
        throw new AppError(mensagem, 502);
    }

    return data;
}

function verifyStripeWebhookSignature(signatureHeader, payload) {
    if (!env.STRIPE_WEBHOOK_SECRET) {
        throw new AppError('Stripe webhook não configurado. Defina STRIPE_WEBHOOK_SECRET no .env', 503);
    }

    if (!signatureHeader) {
        throw new AppError('Cabeçalho stripe-signature ausente', 400);
    }

    const partes = signatureHeader.split(',');
    const timestampPart = partes.find((parte) => parte.startsWith('t='));
    const signatureParts = partes.filter((parte) => parte.startsWith('v1='));

    if (!timestampPart || signatureParts.length === 0) {
        throw new AppError('Cabeçalho stripe-signature inválido', 400);
    }

    const timestamp = timestampPart.split('=')[1];
    const expectedSignature = crypto
        .createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

    const valid = signatureParts.some((parte) => {
        const signature = parte.split('=')[1];
        const expectedBuffer = Buffer.from(expectedSignature);
        const signatureBuffer = Buffer.from(signature);
        if (expectedBuffer.length !== signatureBuffer.length) {
            return false;
        }
        return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    });

    if (!valid) {
        throw new AppError('Assinatura Stripe inválida', 400);
    }

    const idade = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (idade > 300) {
        throw new AppError('Assinatura Stripe expirada', 400);
    }
}

export async function processStripeWebhook(rawBody, signatureHeader) {
    const payload = rawBody instanceof Buffer ? rawBody.toString('utf8') : String(rawBody || '');
    verifyStripeWebhookSignature(signatureHeader, payload);

    let evento;
    try {
        evento = JSON.parse(payload);
    } catch {
        throw new AppError('Payload do webhook Stripe inválido', 400);
    }

    if (evento.type === 'payment_intent.succeeded') {
        const intent = evento.data?.object;
        const userId = intent?.metadata?.user_id;
        const paymentIntentId = intent?.id;

        if (!userId || !paymentIntentId) {
            throw new AppError('Webhook Stripe incompleto: metadata.user_id ou id ausente', 400);
        }

        const assinatura = await obterAssinaturaPorExternalId(userId, paymentIntentId);
        if (!assinatura) {
            return { message: 'Assinatura não encontrada para esse pagamento', payment_intent_id: paymentIntentId };
        }

        if (assinatura.status === 'active') {
            return { message: 'Assinatura já estava ativa', subscription_id: assinatura.id };
        }

        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await ativarAssinaturaPremium(userId, assinatura.id, expiresAt);

        return {
            message: 'Assinatura premium ativada automaticamente via webhook Stripe',
            subscription_id: assinatura.id,
            status: 'active',
            expires_at: expiresAt.toISOString(),
        };
    }

    return { message: `Evento Stripe recebido e ignorado: ${evento.type}` };
}

export async function criarCheckoutPremium(userId, customerName, customerEmail, paymentMethod) {
    if (env.PAYMENT_PROVIDER !== 'stripe') {
        throw new AppError('Provedor de pagamento não suportado. Configure PAYMENT_PROVIDER=stripe', 503);
    }

    const amount = 1990;
    const body = {
        'amount': amount.toString(),
        'currency': 'brl',
        'payment_method_types[]': paymentMethod,
        'receipt_email': customerEmail,
        'description': 'Assinatura Premium DocVia',
        'metadata[user_id]': userId,
        'metadata[plan]': 'premium',
    };

    if (paymentMethod === 'boleto') {
        body['payment_method_options[boleto][expires_after_days]'] = '3';
    }

    const intent = await stripeApi('/payment_intents', 'POST', body);

    const boletoUrl = intent.next_action?.boleto_display_details?.hosted_voucher_url
        || intent.next_action?.boleto_display_details?.pdf?.url
        || null;

    await criarAssinaturaPendente(userId, 'stripe', intent.id, amount, 'brl');

    return {
        message: 'Pagamento iniciado. Confirme quando o pagamento for concluído.',
        payment_method: paymentMethod,
        payment_intent_id: intent.id,
        client_secret: intent.client_secret,
        status: intent.status,
        boleto_url: boletoUrl,
        amount: intent.amount,
        currency: intent.currency,
    };
}

export async function confirmarPagamentoPremium(userId, paymentIntentId) {
    if (env.PAYMENT_PROVIDER !== 'stripe') {
        throw new AppError('Provedor de pagamento não suportado. Configure PAYMENT_PROVIDER=stripe', 503);
    }

    const intent = await stripeApi(`/payment_intents/${encodeURIComponent(paymentIntentId)}`, 'GET');
    if (intent.status !== 'succeeded') {
        throw new AppError(`Pagamento ainda não concluído: ${intent.status}`, 400);
    }

    const assinatura = await obterAssinaturaPorExternalId(userId, paymentIntentId);
    if (!assinatura) {
        throw new AppError('Assinatura não encontrada para esse pagamento', 404);
    }

    if (assinatura.status === 'active') {
        return assinatura;
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await ativarAssinaturaPremium(userId, assinatura.id, expiresAt);

    return {
        message: 'Assinatura premium ativada com sucesso',
        subscription_id: assinatura.id,
        status: 'active',
        expires_at: expiresAt.toISOString(),
    };
}
