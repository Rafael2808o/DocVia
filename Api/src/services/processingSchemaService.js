import { BD } from '../../db.js';

export async function garantirSchemaProcessamento() {
    await BD.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await BD.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active
        ON password_reset_tokens(token_hash, expires_at) WHERE used_at IS NULL`);
    await BD.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()');
    await BD.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT');
    await BD.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT');
    await BD.query('ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check');
    await BD.query("UPDATE documents SET status = 'queued', updated_at = NOW() WHERE status = 'pending'");
    await BD.query("ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status IN ('queued', 'processing', 'extracted', 'analyzing', 'done', 'failed'))");
    await BD.query("CREATE INDEX IF NOT EXISTS idx_documents_processing_guard ON documents(status, updated_at) WHERE status IN ('queued', 'processing', 'extracted', 'analyzing')");
    await BD.query("CREATE INDEX IF NOT EXISTS idx_jobs_document_active ON jobs(type, (payload->>'documentId')) WHERE status IN ('queued', 'processing')");
}

export async function verificarSchemaProcessamento() {
    const resultado = await BD.query(`
        SELECT
            to_regclass('public.users') IS NOT NULL AS users,
            to_regclass('public.documents') IS NOT NULL AS documents,
            to_regclass('public.analyses') IS NOT NULL AS analyses,
            to_regclass('public.usage_logs') IS NOT NULL AS usage_logs,
            to_regclass('public.subscriptions') IS NOT NULL AS subscriptions,
            to_regclass('public.refresh_tokens') IS NOT NULL AS refresh_tokens,
            to_regclass('public.jobs') IS NOT NULL AS jobs,
            to_regclass('public.login_security') IS NOT NULL AS login_security,
            to_regclass('public.document_deadlines') IS NOT NULL AS document_deadlines,
            to_regclass('public.password_reset_tokens') IS NOT NULL AS password_reset_tokens,
            EXISTS (
                SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'storage_path'
            ) AS storage_path
    `);
    const faltando = Object.entries(resultado.rows[0] || {}).filter(([, existe]) => !existe).map(([nome]) => nome);
    if (faltando.length) throw new Error(`Schema incompleto. Aplique Docs/supabase-bootstrap.sql antes de iniciar: ${faltando.join(', ')}`);
}
