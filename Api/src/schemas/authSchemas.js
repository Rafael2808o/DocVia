import { z } from 'zod';
import { env } from '../../config/env.js';

const emailSchema = z
    .string({ required_error: 'E-mail é obrigatório' })
    .trim()
    .toLowerCase()
    .email('E-mail inválido');

// Em desenvolvimento/testes, o banco pode usar um identificador simples para
// agilizar os testes locais. Em produção, o contrato continua exigindo e-mail.
const loginIdentifierSchema = env.NODE_ENV === 'production'
    ? emailSchema
    : z
        .string({ required_error: 'E-mail ou usuário é obrigatório' })
        .trim()
        .toLowerCase()
        .min(3, 'E-mail ou usuário deve ter pelo menos 3 caracteres')
        .max(255, 'E-mail ou usuário muito longo');

export const registerSchema = z.object({
    nome: z
        .string({ required_error: 'Nome é obrigatório' })
        .trim()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(150, 'Nome muito longo'),
    email: loginIdentifierSchema,
    senha: z
        .string({ required_error: 'Senha é obrigatória' })
        .min(8, 'Senha deve ter pelo menos 8 caracteres')
        .max(72, 'Senha muito longa'),
});

export const loginSchema = z.object({
    email: loginIdentifierSchema,
    senha: z.string({ required_error: 'Senha é obrigatória' }).min(1, 'Senha é obrigatória'),
});

export const refreshSchema = z.object({
    refresh_token: z.string({ required_error: 'refresh_token é obrigatório' }).min(1),
});

export const consentSchema = z.object({
    accepted: z.literal(true, { errorMap: () => ({ message: 'Você precisa aceitar a política de privacidade' }) }),
});

export const deleteAccountSchema = z.object({
    password: z.string({ required_error: 'Senha é obrigatória' }).min(1, 'Senha é obrigatória').max(72),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().length(64), senha: z.string().min(8).max(72) });
