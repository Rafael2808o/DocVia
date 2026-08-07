import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const opcional = (schema) => z.preprocess((valor) => valor === '' ? undefined : valor, schema.optional());
const urlOpcional = opcional(z.string().url());
const textoOpcional = opcional(z.string());
const emailOpcional = opcional(z.string().email());
const remetenteOpcional = opcional(z.string().refine((valor) => {
    const correspondencia = valor.match(/<([^<>]+)>\s*$/);
    return z.string().email().safeParse(correspondencia ? correspondencia[1] : valor).success;
}, 'informe um e-mail ou remetente no formato Nome <email@dominio>'));

const ambienteSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    DB_USER: z.string().default('postgres'),
    DB_HOST: z.string().default('localhost'),
    DB_PASSWORD: z.string().default(''),
    DB_NAME: z.string().default('DocVia'),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_SSL: z.enum(['true', 'false']).default('false').transform((valor) => valor === 'true'),
    DB_SSL_REJECT_UNAUTHORIZED: z.enum(['true', 'false']).default('true').transform((valor) => valor === 'true'),
    DATABASE_URL: urlOpcional,
    DB_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
    AI_PROVIDER: z.enum(['gemini', 'openai']).default('gemini'),
    GEMINI_API_KEY: textoOpcional,
    GEMINI_MODEL: z.string().default('gemini-2.5-flash-lite'),
    OPENAI_API_KEY: textoOpcional,
    PAYMENT_PROVIDER: z.enum(['none', 'stripe']).default('none'),
    STRIPE_SECRET_KEY: textoOpcional,
    STRIPE_WEBHOOK_SECRET: textoOpcional,
    RESEND_API_KEY: textoOpcional,
    MAIL_FROM: remetenteOpcional,
    PASSWORD_RESET_URL: z.string().url().optional(),
    PRIVACY_CONTACT_EMAIL: emailOpcional,
    PRIVACY_POLICY_URL: z.string().url().optional(),
    ACCOUNT_DELETION_URL: z.string().url().optional(),
    API_URL: z.string().url().optional(),
    API_VERSION: z.string().default('1.0.0'),
    CORS_ORIGINS: z.string().default('*'),
    STORAGE_DIR: z.string().default('./storage'),
    STORAGE_PUBLIC_URL: z.string().default('/uploads'),
    TESSERACT_PATH: textoOpcional,
    OCR_ENABLED: z.enum(['true', 'false']).default('true').transform((valor) => valor === 'true'),
    OCR_LANGUAGE: z.string().default('por'),
    OCR_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
    PDF_MAX_PAGES: z.coerce.number().int().positive().max(200).default(30),
    AI_MAX_TEXT_CHARS: z.coerce.number().int().positive().default(120_000),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().max(300_000).default(60_000),
    AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(16_384).default(4_096),
    AI_GLOBAL_DAILY_LIMIT: z.coerce.number().int().positive().max(100_000).default(250),
    AI_PAID_TIER_CONFIRMED: z.enum(['true', 'false']).default('false').transform((valor) => valor === 'true'),
    SENSITIVE_DOCUMENTS_ENABLED: z.enum(['true', 'false']).default('false').transform((valor) => valor === 'true'),
    JOB_MODE: z.enum(['worker', 'cloud-tasks']).default('worker'),
    GCP_PROJECT_ID: textoOpcional,
    GCP_LOCATION: z.string().default('southamerica-east1'),
    CLOUD_TASKS_QUEUE: z.string().default('docvia-document-processing'),
    CLOUD_RUN_SERVICE_URL: z.string().url().optional(),
    JOB_RUNNER_SECRET: opcional(z.string().min(32)),
    AUTO_MIGRATE: z.enum(['true', 'false']).default('true').transform((valor) => valor === 'true'),
    STORAGE_PROVIDER: z.enum(['local', 'r2']).default('local'),
    R2_ACCOUNT_ID: textoOpcional,
    R2_ACCESS_KEY_ID: textoOpcional,
    R2_SECRET_ACCESS_KEY: textoOpcional,
    R2_BUCKET: textoOpcional,
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
    if (configuracao.NODE_ENV === 'production') {
        for (const [campo, valor] of [['API_URL', configuracao.API_URL], ['PRIVACY_POLICY_URL', configuracao.PRIVACY_POLICY_URL], ['ACCOUNT_DELETION_URL', configuracao.ACCOUNT_DELETION_URL]]) {
            if (!valor || !valor.startsWith('https://')) contexto.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: 'é obrigatório e precisa usar HTTPS em produção' });
        }
        if (!configuracao.PRIVACY_CONTACT_EMAIL) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['PRIVACY_CONTACT_EMAIL'], message: 'é obrigatório em produção' });
        for (const [campo, valor] of [['RESEND_API_KEY', configuracao.RESEND_API_KEY], ['MAIL_FROM', configuracao.MAIL_FROM], ['PASSWORD_RESET_URL', configuracao.PASSWORD_RESET_URL]]) {
            if (!valor) contexto.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: 'é obrigatório em produção porque a recuperação de senha está disponível no app' });
        }
        if (configuracao.AI_PROVIDER === 'gemini' && !configuracao.GEMINI_API_KEY) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['GEMINI_API_KEY'], message: 'é obrigatória quando AI_PROVIDER=gemini' });
        if (configuracao.AI_PROVIDER === 'openai' && !configuracao.OPENAI_API_KEY) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['OPENAI_API_KEY'], message: 'é obrigatória quando AI_PROVIDER=openai' });
        if (!configuracao.AI_PAID_TIER_CONFIRMED) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['AI_PAID_TIER_CONFIRMED'], message: 'confirme o plano de IA com proteção de dados antes de processar documentos reais' });
        if (configuracao.STORAGE_PROVIDER !== 'r2') contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['STORAGE_PROVIDER'], message: 'em produção use armazenamento privado R2; disco local é efêmero' });
        for (const [campo, valor] of [['R2_ACCOUNT_ID', configuracao.R2_ACCOUNT_ID], ['R2_ACCESS_KEY_ID', configuracao.R2_ACCESS_KEY_ID], ['R2_SECRET_ACCESS_KEY', configuracao.R2_SECRET_ACCESS_KEY], ['R2_BUCKET', configuracao.R2_BUCKET]]) {
            if (!valor) contexto.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: 'é obrigatório quando STORAGE_PROVIDER=r2' });
        }
        if (configuracao.JOB_MODE !== 'cloud-tasks') contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['JOB_MODE'], message: 'use cloud-tasks no Cloud Run para garantir processamento após a resposta HTTP' });
        if (configuracao.AUTO_MIGRATE) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['AUTO_MIGRATE'], message: 'desative DDL automático em produção e aplique o bootstrap antes do deploy' });
        for (const [campo, valor] of [['GCP_PROJECT_ID', configuracao.GCP_PROJECT_ID], ['CLOUD_RUN_SERVICE_URL', configuracao.CLOUD_RUN_SERVICE_URL], ['JOB_RUNNER_SECRET', configuracao.JOB_RUNNER_SECRET]]) {
            if (!valor) contexto.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: 'é obrigatório quando JOB_MODE=cloud-tasks' });
        }
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
