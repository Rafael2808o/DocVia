-- Estrutura opcional para confirmação futura de e-mail.
-- Enquanto não houver um provedor transacional operacional, contas existentes
-- e novas permanecem ativas para não bloquear o acesso ao aplicativo.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified_at'
    ) THEN
        ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

ALTER TABLE users ALTER COLUMN email_verified_at SET DEFAULT NOW();
UPDATE users SET email_verified_at = NOW() WHERE email_verified_at IS NULL;

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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON email_verification_tokens FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON email_verification_tokens FROM authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        REVOKE ALL ON email_verification_tokens FROM service_role;
    END IF;
END $$;
