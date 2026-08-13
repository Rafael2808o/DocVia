import { BD } from '../../db.js';
import { env } from '../../config/env.js';

const LIMITES_POR_PLANO = {
    free: 3,
    premium: 3,
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

    // Impede que cadastros automatizados somem cotas individuais e gerem uma
    // conta de IA sem limite. Todas as reservas seguem a mesma ordem de travas.
    await cliente.query("SELECT pg_advisory_xact_lock(hashtextextended('docvia:ai:global', 0))");
    const usoGlobal = await cliente.query(
        `SELECT COUNT(*) FROM usage_logs
         WHERE action = 'analysis_created'
           AND created_at >= NOW() - INTERVAL '1 day'`
    );
    if (parseInt(usoGlobal.rows[0].count, 10) >= env.AI_GLOBAL_DAILY_LIMIT) return null;

    await cliente.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [userId]);
    const resultado = await cliente.query(
        `SELECT COUNT(*) FROM usage_logs
         WHERE user_id = $1
           AND action = 'analysis_created'
           AND created_at >= NOW() - INTERVAL '1 day'`,
        [userId]
    );

    const usoHoje = parseInt(resultado.rows[0].count, 10);
    if (usoHoje >= limite) return null;

    const reserva = await cliente.query(
        'INSERT INTO usage_logs (user_id, action) VALUES ($1, $2) RETURNING id',
        [userId, 'analysis_created']
    );
    return reserva.rows[0]?.id ?? null;
}

export { LIMITES_POR_PLANO };
