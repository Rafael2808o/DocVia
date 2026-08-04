import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { BD } from '../../db.js';

function normalizarEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}


// Limite geral, aplicado em toda a API.
export const limitadorGeral = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Muitas requisições vindas desse IP. Tente novamente mais tarde.' },
});

// Limite mais rígido só pro login e registro, pra dificultar
// ataques de força bruta contra senha/criação de conta em massa.
export const limitadorAuth = rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Muitas tentativas de login/cadastro. Tente novamente em alguns minutos.' },
});

export async function verificarBloqueioLogin(req, res, next) {
    const email = normalizarEmail(req.body?.email);
    if (!email) return next();
    try {
        const resultado = await BD.query('SELECT locked_until FROM login_security WHERE email = $1', [email]);
        if (resultado.rows[0]?.locked_until && new Date(resultado.rows[0].locked_until) > new Date()) {
            return res.status(429).json({ message: 'Muitas tentativas de login para este e-mail. Tente novamente mais tarde.' });
        }
        return next();
    } catch (erro) {
        return next(erro);
    }
}

export async function registrarFalhaLogin(email) {
    const chave = normalizarEmail(email);
    if (!chave) return;
    await BD.query(
        `INSERT INTO login_security (email, failed_attempts, locked_until, updated_at)
         VALUES ($1, 1, NULL, NOW())
         ON CONFLICT (email) DO UPDATE SET
             failed_attempts = login_security.failed_attempts + 1,
             locked_until = CASE WHEN login_security.failed_attempts + 1 >= $2
                 THEN NOW() + ($3 * INTERVAL '1 millisecond') ELSE NULL END,
             updated_at = NOW()`,
        [chave, env.FAILED_LOGIN_MAX_ATTEMPTS, env.FAILED_LOGIN_LOCKOUT_MS]
    );
}

export async function registrarSucessoLogin(email) {
    const chave = normalizarEmail(email);
    if (!chave) return;
    await BD.query('DELETE FROM login_security WHERE email = $1', [chave]);
}
