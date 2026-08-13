import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const producaoValida = {
    ...process.env,
    NODE_ENV: 'production',
    JWT_SECRET: 'teste-de-configuracao-com-mais-de-32-caracteres',
    DATABASE_URL: 'postgresql://usuario:senha@db.example.com:5432/docvia',
    DB_SSL: 'true',
    DB_SSL_REJECT_UNAUTHORIZED: 'true',
    DB_SSL_CA_FILE: './config/certs/supabase-prod-ca-2021.crt',
    CORS_ORIGINS: 'https://docvia.example.com',
    API_URL: 'https://api.example.com',
    PRIVACY_CONTACT_EMAIL: 'privacidade@example.com',
    PRIVACY_POLICY_URL: 'https://docvia.example.com/privacidade',
    ACCOUNT_DELETION_URL: 'https://docvia.example.com/excluir-conta',
    RESEND_API_KEY: 're_teste',
    MAIL_FROM: 'DocVia <nao-responda@example.com>',
    PASSWORD_RESET_URL: 'docvia://reset-password',
    AI_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'chave-de-teste-valida',
    OPENAI_API_KEY: '',
    AI_PAID_TIER_CONFIRMED: 'true',
    STORAGE_PROVIDER: 'r2',
    R2_ACCOUNT_ID: 'conta',
    R2_ACCESS_KEY_ID: 'acesso',
    R2_SECRET_ACCESS_KEY: 'segredo',
    R2_BUCKET: 'docvia',
    JOB_MODE: 'cloud-tasks',
    GCP_PROJECT_ID: 'docvia-teste',
    CLOUD_RUN_SERVICE_URL: 'https://api.example.com',
    JOB_RUNNER_SECRET: 'segredo-de-job-com-mais-de-32-caracteres',
    AUTO_MIGRATE: 'false',
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
};

test('configuração de produção aceita remetente com nome e opcionais vazios', async () => {
    const { stdout } = await execFileAsync(
        process.execPath,
        ['--input-type=module', '-e', "import('./config/env.js').then(({env}) => console.log(env.MAIL_FROM))"],
        { cwd: process.cwd(), env: producaoValida },
    );
    assert.match(stdout, /DocVia <nao-responda@example\.com>/);
});

test('configuração de produção aceita Render, Supabase Storage S3 e Workers AI', async () => {
    const envRender = {
        ...producaoValida,
        AI_PROVIDER: 'cloudflare',
        GEMINI_API_KEY: '',
        AI_PAID_TIER_CONFIRMED: 'false',
        AI_PRIVACY_CONFIRMED: 'true',
        CLOUDFLARE_ACCOUNT_ID: 'conta-cloudflare',
        CLOUDFLARE_AI_API_TOKEN: 'token-cloudflare',
        STORAGE_PROVIDER: 's3',
        R2_ACCOUNT_ID: '',
        R2_ACCESS_KEY_ID: '',
        R2_SECRET_ACCESS_KEY: '',
        R2_BUCKET: '',
        S3_ENDPOINT: 'https://projeto.storage.supabase.co/storage/v1/s3',
        S3_REGION: 'sa-east-1',
        S3_ACCESS_KEY_ID: 'acesso-s3',
        S3_SECRET_ACCESS_KEY: 'segredo-s3',
        S3_BUCKET: 'docvia-documents',
        JOB_MODE: 'worker',
        GCP_PROJECT_ID: '',
        CLOUD_RUN_SERVICE_URL: '',
        JOB_RUNNER_SECRET: '',
    };
    const { stdout } = await execFileAsync(
        process.execPath,
        ['--input-type=module', '-e', "import('./config/env.js').then(({env}) => console.log(env.STORAGE_PROVIDER, env.JOB_MODE, env.AI_PROVIDER))"],
        { cwd: process.cwd(), env: envRender },
    );
    assert.match(stdout, /s3 worker cloudflare/);
});
