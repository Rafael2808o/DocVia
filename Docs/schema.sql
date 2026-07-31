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
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'canceled' | 'expired'
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    payment_provider VARCHAR(30),           -- 'stripe', 'mercadopago', etc
    external_id     VARCHAR(255)            -- id da assinatura no provedor de pagamento
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);


-- ============================================
-- Migration 002: refresh_tokens
-- Rode isso no pgAdmin DEPOIS do schema.sql original
-- ============================================
 
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE, -- hash SHA-256 do token (nunca o token puro)
    revoked     BOOLEAN NOT NULL DEFAULT false,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
 
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
 


 CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_analyses_document_created_at
    ON analyses(document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_action_created_at
    ON usage_logs(user_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
    ON refresh_tokens(token_hash, expires_at)
    WHERE revoked = false;

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