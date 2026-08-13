import { BD } from '../../db.js';

const PLAN_DETAILS = {
    free: {
        id: 'free',
        name: 'Plano Gratuito',
        monthly_cost: 0,
        daily_analysis_limit: 3,
        description: 'Teste o app com recursos básicos de análise e limite diário.',
        features: [
            'Análises básicas',
            'Histórico limitado',
            'Resumos de documentos',
        ],
    },
    premium: {
        id: 'premium',
        name: 'Plano Premium',
        monthly_cost: 19.9,
        daily_analysis_limit: 3,
        description: 'Acesso ampliado a análises, histórico completo e recursos avançados.',
        features: [
            'Histórico ilimitado',
            'Exportação avançada',
            'Prioridade de análise',
            'Relatórios e ações sugeridas',
        ],
    },
};

export function buscarDetalhesDoPlano(plan = 'free') {
    return PLAN_DETAILS[plan] ?? PLAN_DETAILS.free;
}

export async function buscarAssinaturaAtivaUsuario(userId) {
    const resultado = await BD.query(
        `SELECT * FROM subscriptions
         WHERE user_id = $1 AND status IN ('active', 'pending')
         ORDER BY started_at DESC
         LIMIT 1`,
        [userId]
    );
    return resultado.rows[0] || null;
}

export async function buscarAssinaturasUsuario(userId) {
    const resultado = await BD.query(
        `SELECT * FROM subscriptions
         WHERE user_id = $1
         ORDER BY started_at DESC`,
        [userId]
    );
    return resultado.rows;
}

export async function criarAssinaturaPendente(userId, paymentProvider, externalId, amount, currency) {
    const resultado = await BD.query(
        `INSERT INTO subscriptions (user_id, status, payment_provider, external_id, amount, currency, started_at)
         VALUES ($1, 'pending', $2, $3, $4, $5, NOW())
         RETURNING *`,
        [userId, paymentProvider, externalId, amount, currency]
    );
    return resultado.rows[0];
}

export async function obterAssinaturaPorExternalId(userId, externalId) {
    const resultado = await BD.query(
        `SELECT * FROM subscriptions
         WHERE user_id = $1 AND external_id = $2
         ORDER BY started_at DESC
         LIMIT 1`,
        [userId, externalId]
    );
    return resultado.rows[0] || null;
}

export async function ativarAssinaturaPremium(userId, subscriptionId, expiresAt) {
    await BD.query(
        `UPDATE subscriptions
         SET status = 'active', expires_at = $1
         WHERE id = $2 AND user_id = $3`,
        [expiresAt, subscriptionId, userId]
    );

    await BD.query(
        `UPDATE users SET plan = 'premium', updated_at = NOW() WHERE id = $1`,
        [userId]
    );
}

export async function cancelarAssinaturaPremium(userId) {
    await BD.query(
        `UPDATE subscriptions
         SET status = 'canceled'
         WHERE user_id = $1 AND status IN ('active', 'pending')`,
        [userId]
    );

    await BD.query(
        `UPDATE users SET plan = 'free', updated_at = NOW() WHERE id = $1`,
        [userId]
    );
}

export async function assinarPlanoPremium(userId) {
    await BD.query('UPDATE users SET plan = $1, updated_at = NOW() WHERE id = $2', ['premium', userId]);
}

export async function rebaixarParaPlanoFree(userId) {
    await cancelarAssinaturaPremium(userId);
}
