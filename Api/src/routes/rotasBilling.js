import { Router } from 'express';
import { autenticarToken } from '../middlewares/autenticacao.js';
import { validar } from '../middlewares/validar.js';
import { checkoutSchema, confirmPaymentSchema } from '../schemas/billingSchemas.js';
import {
    buscarDetalhesDoPlano,
    buscarAssinaturaAtivaUsuario,
    buscarAssinaturasUsuario,
    cancelarAssinaturaPremium,
} from '../services/billingService.js';
import { criarCheckoutPremium, confirmarPagamentoPremium, processStripeWebhook } from '../services/paymentService.js';
import { AppError, asyncHandler } from '../../utils/erros.js';
import { BD } from '../../db.js';
import { env } from '../../config/env.js';

const router = Router();

function exigirPagamentosAtivos(req, res, next) {
    if (env.PAYMENT_PROVIDER === 'none') return next(new AppError('Pagamentos não estão disponíveis nesta versão', 404));
    return next();
}

/**
 * @swagger
 * /billing/plan:
 *   get:
 *     tags: ["Billing"]
 *     summary: "Retorna os dados do plano atual do usuário"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Dados do plano obtidos com sucesso" }
 */
router.get('/plan', autenticarToken, asyncHandler(async (req, res) => {
    const resultado = await BD.query('SELECT plan FROM users WHERE id = $1', [req.usuario.id_usuario]);
    if (resultado.rows.length === 0) {
        throw new AppError('Usuário não encontrado', 404);
    }

    const plano = resultado.rows[0].plan;
    const assinaturaAtiva = await buscarAssinaturaAtivaUsuario(req.usuario.id_usuario);
    return res.status(200).json({
        plan: plano,
        plan_details: buscarDetalhesDoPlano(plano),
        active_subscription: assinaturaAtiva,
    });
}));

/**
 * @swagger
 * /billing/checkout:
 *   post:
 *     tags: ["Billing"]
 *     summary: "Inicia a compra do plano premium com pagamento por cartão ou boleto"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckoutRequest'
 *     responses:
 *       200: { description: "Checkout iniciado" }
 */
router.post('/checkout', exigirPagamentosAtivos, autenticarToken, validar(checkoutSchema), asyncHandler(async (req, res) => {
    const { payment_method, customer_name, customer_email } = req.body;
    const data = await criarCheckoutPremium(
        req.usuario.id_usuario,
        customer_name,
        customer_email,
        payment_method
    );
    return res.status(200).json(data);
}));

/**
 * @swagger
 * /billing/confirm:
 *   post:
 *     tags: ["Billing"]
 *     summary: "Confirma o pagamento da assinatura premium"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConfirmPaymentRequest'
 *     responses:
 *       200: { description: "Pagamento confirmado" }
 */
router.post('/confirm', exigirPagamentosAtivos, autenticarToken, validar(confirmPaymentSchema), asyncHandler(async (req, res) => {
    const { payment_intent_id } = req.body;
    const data = await confirmarPagamentoPremium(req.usuario.id_usuario, payment_intent_id);
    return res.status(200).json(data);
}));

/**
 * @swagger
 * /billing/cancel:
 *   post:
 *     tags: ["Billing"]
 *     summary: "Cancela a assinatura premium e rebaixa para free"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Assinatura cancelada" }
 */
router.post('/cancel', exigirPagamentosAtivos, autenticarToken, asyncHandler(async (req, res) => {
    await cancelarAssinaturaPremium(req.usuario.id_usuario);
    return res.status(200).json({ message: 'Assinatura cancelada e usuário rebaixado para free' });
}));

/**
 * @swagger
 * /billing/subscriptions:
 *   get:
 *     tags: ["Billing"]
 *     summary: "Retorna o histórico de assinaturas do usuário"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Histórico de assinaturas" }
 */
router.get('/subscriptions', autenticarToken, asyncHandler(async (req, res) => {
    const subscriptions = await buscarAssinaturasUsuario(req.usuario.id_usuario);
    return res.status(200).json({ subscriptions });
}));

router.post('/webhook', exigirPagamentosAtivos, asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    const result = await processStripeWebhook(req.rawBody, signature);
    return res.status(200).json(result);
}));

export default router;
