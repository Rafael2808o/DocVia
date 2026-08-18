-- DocVia: bootstrap idempotente para um projeto Supabase novo.
-- Execute no SQL Editor do Supabase antes de publicar a API.
-- A API usa conexão PostgreSQL no servidor; nenhuma tabela fica acessível
-- diretamente pelos papéis anon/authenticated do Supabase.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Somente papeis explicitamente autorizados podem criar objetos no schema.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    auth_provider VARCHAR(20) NOT NULL DEFAULT 'email',
    plan VARCHAR(20) NOT NULL DEFAULT 'free',
    privacy_consent_at TIMESTAMPTZ,
    email_verified_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(30) NOT NULL,
    storage_url TEXT NOT NULL,
    storage_path TEXT,
    mime_type VARCHAR(100),
    extracted_text TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    deadlines JSONB NOT NULL DEFAULT '[]'::jsonb,
    costs JSONB NOT NULL DEFAULT '[]'::jsonb,
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_ai_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    payment_provider VARCHAR(30),
    external_id VARCHAR(255),
    amount INTEGER,
    currency VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    revoked BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.jobs (
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

CREATE TABLE IF NOT EXISTS public.login_security (
    email VARCHAR(255) PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.users ALTER COLUMN email_verified_at SET DEFAULT now();
UPDATE public.users SET email_verified_at = now() WHERE email_verified_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_plan_check') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'premium'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_provider_check') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_auth_provider_check CHECK (auth_provider IN ('email', 'google', 'apple'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_type_check') THEN
        ALTER TABLE public.documents ADD CONSTRAINT documents_type_check CHECK (document_type IN ('contrato', 'exame', 'boleto', 'termo_de_uso', 'outro'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_status_check') THEN
        ALTER TABLE public.documents ADD CONSTRAINT documents_status_check CHECK (status IN ('queued', 'processing', 'extracted', 'analyzing', 'done', 'failed'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_status_check') THEN
        ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (status IN ('queued', 'processing', 'completed', 'failed'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_attempts_check') THEN
        ALTER TABLE public.jobs ADD CONSTRAINT jobs_attempts_check CHECK (attempts >= 0 AND max_attempts BETWEEN 1 AND 10);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_amount_check') THEN
        ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_amount_check CHECK (amount IS NULL OR amount >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_processing_guard ON public.documents(status, updated_at) WHERE status IN ('queued', 'processing', 'extracted', 'analyzing');
CREATE INDEX IF NOT EXISTS idx_analyses_document_created_at ON public.analyses(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_action_created_at ON public.usage_logs(user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON public.refresh_tokens(token_hash, expires_at) WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_jobs_next ON public.jobs(status, run_after, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_document_active ON public.jobs(type, (payload->>'documentId')) WHERE status IN ('queued', 'processing');
CREATE INDEX IF NOT EXISTS idx_login_security_locked ON public.login_security(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_deadlines_due_date ON public.document_deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active ON public.password_reset_tokens(token_hash, expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_active ON public.email_verification_tokens(token_hash, expires_at) WHERE used_at IS NULL;

-- Defesa adicional: impede acesso pelo Data API do Supabase. A API do DocVia
-- acessa essas tabelas somente pela conexão PostgreSQL do servidor.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
        REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
        REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM service_role;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM service_role;
        REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM service_role;
    END IF;
END $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM %I', data_api_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', data_api_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I', data_api_role);
        END IF;
    END LOOP;
END $$;

COMMIT;
