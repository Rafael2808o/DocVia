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
    DB_SSL_CA_FILE: textoOpcional,
    DATABASE_URL: urlOpcional,
    DB_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
    AI_PROVIDER: z.enum(['gemini', 'openai', 'cloudflare']).default('gemini'),
    GEMINI_API_KEY: textoOpcional,
    GEMINI_MODEL: z.string().default('gemini-2.5-flash-lite'),
    OPENAI_API_KEY: textoOpcional,
    CLOUDFLARE_ACCOUNT_ID: textoOpcional,
    CLOUDFLARE_AI_API_TOKEN: textoOpcional,
    CLOUDFLARE_AI_MODEL: z.string().default('@cf/meta/llama-3.1-8b-instruct-fast'),
    PAYMENT_PROVIDER: z.enum(['none', 'stripe']).default('none'),
    STRIPE_SECRET_KEY: textoOpcional,
    STRIPE_WEBHOOK_SECRET: textoOpcional,
    EMAIL_PROVIDER: z.enum(['resend', 'brevo', 'smtp']).default('resend'),
    RESEND_API_KEY: textoOpcional,
    BREVO_API_KEY: textoOpcional,
    SMTP_HOST: z.string().default('smtp.gmail.com'),
    SMTP_PORT: z.coerce.number().int().positive().max(65535).default(465),
    SMTP_SECURE: z.enum(['true', 'false']).default('true').transform((valor) => valor === 'true'),
    SMTP_USER: emailOpcional,
    SMTP_PASSWORD: textoOpcional,
    MAIL_FROM: remetenteOpcional,
    PASSWORD_RESET_URL: z.string().url().optional(),
    EMAIL_VERIFICATION_URL: z.string().url().optional(),
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
    AI_GLOBAL_DAILY_LIMIT: z.coerce.number().int().positive().max(100_000).default(100),
    AI_PAID_TIER_CONFIRMED: z.enum(['true', 'false']).default('false').transform((valor) => valor === 'true'),
    AI_PRIVACY_CONFIRMED: z.enum(['true', 'false']).default('false').transform((valor) => valor === 'true'),
    SENSITIVE_DOCUMENTS_ENABLED: z.enum(['true', 'false']).default('false').transform((valor) => valor === 'true'),
    JOB_MODE: z.enum(['worker', 'cloud-tasks']).default('worker'),
    GCP_PROJECT_ID: textoOpcional,
    GCP_LOCATION: z.string().default('southamerica-east1'),
    CLOUD_TASKS_QUEUE: z.string().default('docvia-document-processing'),
    CLOUD_RUN_SERVICE_URL: urlOpcional,
    JOB_RUNNER_SECRET: opcional(z.string().min(32)),
    AUTO_MIGRATE: z.enum(['true', 'false']).default('true').transform((valor) => valor === 'true'),
    STORAGE_PROVIDER: z.enum(['local', 'r2', 's3']).default('local'),
    R2_ACCOUNT_ID: textoOpcional,
    R2_ACCESS_KEY_ID: textoOpcional,
    R2_SECRET_ACCESS_KEY: textoOpcional,
    R2_BUCKET: textoOpcional,
    S3_ENDPOINT: urlOpcional,
    S3_REGION: textoOpcional,
    S3_ACCESS_KEY_ID: textoOpcional,
    S3_SECRET_ACCESS_KEY: textoOpcional,
    S3_BUCKET: textoOpcional,
    S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('true').transform((valor) => valor === 'true'),
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
        for (const [campo, valor] of [['MAIL_FROM', configuracao.MAIL_FROM], ['PASSWORD_RESET_URL', configuracao.PASSWORD_RESET_URL], ['EMAIL_VERIFICATION_URL', configuracao.EMAIL_VERIFICATION_URL]]) {
            if (!valor) contexto.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: 'é obrigatório em produção porque a autenticação por e-mail está disponível no app' });
        }
        if (configuracao.EMAIL_PROVIDER === 'resend' && !configuracao.RESEND_API_KEY) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['RESEND_API_KEY'], message: 'é obrigatória quando EMAIL_PROVIDER=resend' });
        if (configuracao.EMAIL_PROVIDER === 'brevo' && !configuracao.BREVO_API_KEY) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['BREVO_API_KEY'], message: 'é obrigatória quando EMAIL_PROVIDER=brevo' });
        if (configuracao.EMAIL_PROVIDER === 'smtp') {
            for (const [campo, valor] of [['SMTP_USER', configuracao.SMTP_USER], ['SMTP_PASSWORD', configuracao.SMTP_PASSWORD]]) {
                if (!valor) contexto.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: 'é obrigatório quando EMAIL_PROVIDER=smtp' });
            }
        }
        if (configuracao.AI_PROVIDER === 'gemini' && !configuracao.GEMINI_API_KEY) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['GEMINI_API_KEY'], message: 'é obrigatória quando AI_PROVIDER=gemini' });
        if (configuracao.AI_PROVIDER === 'openai' && !configuracao.OPENAI_API_KEY) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['OPENAI_API_KEY'], message: 'é obrigatória quando AI_PROVIDER=openai' });
        if (configuracao.AI_PROVIDER === 'cloudflare') {
            for (const [campo, valor] of [['CLOUDFLARE_ACCOUNT_ID', configuracao.CLOUDFLARE_ACCOUNT_ID], ['CLOUDFLARE_AI_API_TOKEN', configuracao.CLOUDFLARE_AI_API_TOKEN]]) {
                if (!valor) contexto.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: 'é obrigatório quando AI_PROVIDER=cloudflare' });
            }
        }
        if (!configuracao.AI_PRIVACY_CONFIRMED && !configuracao.AI_PAID_TIER_CONFIRMED) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['AI_PRIVACY_CONFIRMED'], message: 'confirme que o provedor de IA não usa documentos reais para treinamento' });
        if (configuracao.STORAGE_PROVIDER === 'local') contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['STORAGE_PROVIDER'], message: 'em produção use armazenamento de objetos privado; disco local é efêmero' });
        if (configuracao.STORAGE_PROVIDER === 'r2') {
            for (const [campo, valor] of [['R2_ACCOUNT_ID', configuracao.R2_ACCOUNT_ID], ['R2_ACCESS_KEY_ID', configuracao.R2_ACCESS_KEY_ID], ['R2_SECRET_ACCESS_KEY', configuracao.R2_SECRET_ACCESS_KEY], ['R2_BUCKET', configuracao.R2_BUCKET]]) {
                if (!valor) contexto.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: 'é obrigatório quando STORAGE_PROVIDER=r2' });
            }
        }
        if (configuracao.STORAGE_PROVIDER === 's3') {
            for (const [campo, valor] of [['S3_ENDPOINT', configuracao.S3_ENDPOINT], ['S3_REGION', configuracao.S3_REGION], ['S3_ACCESS_KEY_ID', configuracao.S3_ACCESS_KEY_ID], ['S3_SECRET_ACCESS_KEY', configuracao.S3_SECRET_ACCESS_KEY], ['S3_BUCKET', configuracao.S3_BUCKET]]) {
                if (!valor) contexto.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: 'é obrigatório quando STORAGE_PROVIDER=s3' });
            }
        }
        if (configuracao.AUTO_MIGRATE) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['AUTO_MIGRATE'], message: 'desative DDL automático em produção e aplique o bootstrap antes do deploy' });
        if (configuracao.JOB_MODE === 'cloud-tasks') {
            for (const [campo, valor] of [['GCP_PROJECT_ID', configuracao.GCP_PROJECT_ID], ['CLOUD_RUN_SERVICE_URL', configuracao.CLOUD_RUN_SERVICE_URL], ['JOB_RUNNER_SECRET', configuracao.JOB_RUNNER_SECRET]]) {
                if (!valor) contexto.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: 'é obrigatório quando JOB_MODE=cloud-tasks' });
            }
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

export function temCloudflareAiConfigurada() {
    return Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_AI_API_TOKEN);
}

export function temGeminiConfigurada() {
    return Boolean(env.GEMINI_API_KEY && !env.GEMINI_API_KEY.startsWith('sua-chave-'));
}

export function origensCors() {
    if (env.CORS_ORIGINS === '*') return true;
    return env.CORS_ORIGINS.split(',').map((origem) => origem.trim()).filter(Boolean);
}
