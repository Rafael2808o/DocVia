-- ============================================
-- Schema inicial: Tradutor de Burocracia
-- Rode este script no Query Tool do pgAdmin,
-- conectado ao banco que você criar (ex: burocracia_db)
-- ============================================

-- Extensão para gerar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Tabela: users
-- ============================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255),          -- pode ser NULL se login via Google/Apple
    auth_provider   VARCHAR(20) NOT NULL DEFAULT 'email', -- 'email' | 'google' | 'apple'
    plan            VARCHAR(20) NOT NULL DEFAULT 'free',  -- 'free' | 'premium'
    email_verified_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Tabela: documents
-- Cada upload feito pelo usuário (contrato, exame, boleto, etc)
-- ============================================
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_name   VARCHAR(255) NOT NULL,
    document_type   VARCHAR(30) NOT NULL,   -- 'contrato' | 'exame' | 'boleto' | 'termo_de_uso' | 'outro'
    storage_url     TEXT NOT NULL,          -- URL no Supabase Storage / Cloudflare R2
    extracted_text  TEXT,                   -- texto bruto retornado pelo OCR
    status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'done' | 'failed'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_user_id ON documents(user_id);

-- ============================================
-- Tabela: analyses
-- Resultado gerado pela IA para cada documento
-- ============================================
CREATE TABLE analyses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    summary         TEXT NOT NULL,          -- resumo simples do documento
    deadlines       JSONB,                  -- lista de prazos: [{ "descricao": "...", "data": "..." }]
    costs           JSONB,                  -- lista de valores: [{ "descricao": "...", "valor": "..." }]
    warnings        JSONB,                  -- "pegadinhas": [{ "descricao": "..." }]
    raw_ai_response JSONB,                  -- resposta completa da IA, pra debug/auditoria
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analyses_document_id ON analyses(document_id);

-- ============================================
-- Tabela: usage_logs
-- Controla quantas análises o usuário fez (limite diário do plano free)
-- ============================================
CREATE TABLE usage_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action          VARCHAR(30) NOT NULL,   -- 'analysis_created', etc
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_logs_user_id_created_at ON usage_logs(user_id, created_at);

-- ============================================
-- Tabela: subscriptions
-- Histórico de assinaturas do plano premium
-- ============================================
CREATE TABLE subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'pending' | 'canceled' | 'expired'
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    payment_provider VARCHAR(30),           -- 'stripe', 'mercadopago', etc
    external_id     VARCHAR(255),           -- id da assinatura no provedor de pagamento
    amount          INTEGER,                -- valor em centavos
    currency        VARCHAR(10)             -- moeda, ex: 'brl'
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);


-- ============================================
-- Migration 002: refresh_tokens
-- Rode isso no pgAdmin DEPOIS do schema.sql original
-- ============================================
 
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE, -- hash SHA-256 do token (nunca o token puro)
    revoked     BOOLEAN NOT NULL DEFAULT false,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
 
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_analyses_document_created_at
    ON analyses(document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_action_created_at
    ON usage_logs(user_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
    ON refresh_tokens(token_hash, expires_at)
    WHERE revoked = false;

-- Migration 003: processamento assíncrono, privacidade e recursos do produto.
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_consent_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_jobs_next ON jobs(status, run_after, created_at);

CREATE TABLE IF NOT EXISTS login_security (
    email VARCHAR(255) PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_document_deadlines_due_date ON document_deadlines(due_date);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active
    ON password_reset_tokens(token_hash, expires_at) WHERE used_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_plan_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'premium'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_type_check') THEN
        ALTER TABLE documents ADD CONSTRAINT documents_type_check
            CHECK (document_type IN ('contrato', 'exame', 'boleto', 'termo_de_uso', 'outro'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_status_check') THEN
        ALTER TABLE documents ADD CONSTRAINT documents_status_check
            CHECK (status IN ('pending', 'processing', 'done', 'failed'));
    END IF;
END $$;

-- Migration 004: estados completos do pipeline e proteção contra jobs parados.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
UPDATE documents SET status = 'queued', updated_at = NOW() WHERE status = 'pending';
ALTER TABLE documents ADD CONSTRAINT documents_status_check
    CHECK (status IN ('queued', 'processing', 'extracted', 'analyzing', 'done', 'failed'));
CREATE INDEX IF NOT EXISTS idx_documents_processing_guard
    ON documents(status, updated_at) WHERE status IN ('queued', 'processing', 'extracted', 'analyzing');
CREATE INDEX IF NOT EXISTS idx_jobs_document_active
    ON jobs(type, (payload->>'documentId')) WHERE status IN ('queued', 'processing');

-- Migration 005: verificação obrigatória de e-mail.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_active
    ON email_verification_tokens(token_hash, expires_at) WHERE used_at IS NULL;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
