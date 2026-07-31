import crypto from 'crypto';
import { BD } from '../../db.js';

const REFRESH_TOKEN_DIAS = 30;

function gerarTokenBruto() {
    return crypto.randomBytes(48).toString('hex');
}

// Nunca guardamos o refresh token em texto puro no banco - só o hash.
// Se o banco vazar, ninguém consegue usar os tokens roubados.
function hashToken(tokenBruto) {
    return crypto.createHash('sha256').update(tokenBruto).digest('hex');
}

export async function criarRefreshToken(userId) {
    const tokenBruto = gerarTokenBruto();
    const tokenHash = hashToken(tokenBruto);
    const expiraEm = new Date(Date.now() + REFRESH_TOKEN_DIAS * 24 * 60 * 60 * 1000);

    await BD.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiraEm]
    );

    return tokenBruto;
}

export async function validarRefreshToken(tokenBruto) {
    const tokenHash = hashToken(tokenBruto);
    const resultado = await BD.query(
        `SELECT * FROM refresh_tokens
         WHERE token_hash = $1 AND revoked = false AND expires_at > NOW()`,
        [tokenHash]
    );
    return resultado.rows[0] || null;
}

export async function revogarRefreshToken(tokenBruto) {
    const tokenHash = hashToken(tokenBruto);
    await BD.query('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [tokenHash]);
}

// Usado no "logout de todos os dispositivos" (ex: quando o usuário troca a senha)
export async function revogarTodosOsTokens(userId) {
    await BD.query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [userId]);
}