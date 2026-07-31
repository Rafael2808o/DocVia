import { z } from 'zod';

export const registerSchema = z.object({
    nome: z
        .string({ required_error: 'Nome é obrigatório' })
        .trim()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(150, 'Nome muito longo'),
    email: z
        .string({ required_error: 'Email é obrigatório' })
        .trim()
        .toLowerCase()
        .email('Email inválido'),
    senha: z
        .string({ required_error: 'Senha é obrigatória' })
        .min(8, 'Senha deve ter pelo menos 8 caracteres')
        .max(72, 'Senha muito longa'),
});

export const loginSchema = z.object({
    email: z
        .string({ required_error: 'Email é obrigatório' })
        .trim()
        .toLowerCase()
        .email('Email inválido'),
    senha: z.string({ required_error: 'Senha é obrigatória' }).min(1, 'Senha é obrigatória'),
});

export const refreshSchema = z.object({
    refresh_token: z.string({ required_error: 'refresh_token é obrigatório' }).min(1),
});