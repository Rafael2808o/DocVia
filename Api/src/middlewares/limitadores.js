import rateLimit from 'express-rate-limit';

// Limite geral, aplicado em toda a API.
export const limitadorGeral = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Muitas requisições vindas desse IP. Tente novamente mais tarde.' },
});

// Limite mais rígido só pro login e registro, pra dificultar
// ataques de força bruta contra senha/criação de conta em massa.
export const limitadorAuth = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Muitas tentativas de login/cadastro. Tente novamente em alguns minutos.' },
});