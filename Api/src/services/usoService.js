import { BD } from '../../db.js';

const LIMITES_POR_PLANO = {
    free: 5,
    premium: 100,
};

// Verifica se o usuário ainda pode fazer uma análise hoje, de acordo com o plano dele.
export async function verificarLimiteDiario(userId, plano) {
    const limite = LIMITES_POR_PLANO[plano] ?? LIMITES_POR_PLANO.free;

    const resultado = await BD.query(
        `SELECT COUNT(*) FROM usage_logs
         WHERE user_id = $1
           AND action = 'analysis_created'
           AND created_at >= NOW() - INTERVAL '1 day'`,
        [userId]
    );

    const usoHoje = parseInt(resultado.rows[0].count, 10);
    return usoHoje < limite;
}

// Registra que o usuário usou uma "cota" de análise.
export async function registrarUso(userId, acao) {
    await BD.query('INSERT INTO usage_logs (user_id, action) VALUES ($1, $2)', [userId, acao]);
}

export async function reservarUsoNaTransacao(cliente, userId, plano) {
    const limite = LIMITES_POR_PLANO[plano] ?? LIMITES_POR_PLANO.free;

    await cliente.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [userId]);
    const resultado = await cliente.query(
        `SELECT COUNT(*) FROM usage_logs
         WHERE user_id = $1
           AND action = 'analysis_created'
           AND created_at >= NOW() - INTERVAL '1 day'`,
        [userId]
    );

    const usoHoje = parseInt(resultado.rows[0].count, 10);
    if (usoHoje >= limite) return false;

    await cliente.query(
        'INSERT INTO usage_logs (user_id, action) VALUES ($1, $2)',
        [userId, 'analysis_created']
    );
    return true;
}

export { LIMITES_POR_PLANO };