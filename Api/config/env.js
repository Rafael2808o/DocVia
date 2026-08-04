import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ambienteSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    DB_USER: z.string().default('postgres'),
    DB_HOST: z.string().default('localhost'),
    DB_PASSWORD: z.string().default(''),
    DB_NAME: z.string().default('DocVia'),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
    AI_PROVIDER: z.enum(['gemini', 'openai']).default('gemini'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    OPENAI_API_KEY: z.string().optional(),
    PAYMENT_PROVIDER: z.enum(['none', 'stripe']).default('none'),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    API_URL: z.string().url().optional(),
    API_VERSION: z.string().default('1.0.0'),
    CORS_ORIGINS: z.string().default('*'),
    STORAGE_DIR: z.string().default('./storage'),
    STORAGE_PUBLIC_URL: z.string().default('/uploads'),
    TESSERACT_PATH: z.string().optional(),
    OCR_ENABLED: z.enum(['true', 'false']).default('true').transform((valor) => valor === 'true'),
    OCR_LANGUAGE: z.string().default('por'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(8),
    FAILED_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    FAILED_LOGIN_LOCKOUT_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
}).superRefine((configuracao, contexto) => {
    if (configuracao.NODE_ENV === 'production' && configuracao.CORS_ORIGINS === '*') {
        contexto.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['CORS_ORIGINS'],
            message: 'em produção, informe as origens permitidas separadas por vírgula; * não é aceito',
        });
    }
});

const resultado = ambienteSchema.safeParse(process.env);

if (!resultado.success) {
    const mensagens = resultado.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Configuração inválida: ${mensagens}`);
}

export const env = resultado.data;

export function temOpenAiConfigurada() {
    return Boolean(env.OPENAI_API_KEY && !env.OPENAI_API_KEY.startsWith('sk-sua-'));
}

export function temGeminiConfigurada() {
    return Boolean(env.GEMINI_API_KEY && !env.GEMINI_API_KEY.startsWith('sua-chave-'));
}

export function origensCors() {
    if (env.CORS_ORIGINS === '*') return true;
    return env.CORS_ORIGINS.split(',').map((origem) => origem.trim()).filter(Boolean);
}
