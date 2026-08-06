import { BD } from '../../db.js';

export async function garantirSchemaProcessamento() {
    await BD.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()');
    await BD.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT');
    await BD.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT');
    await BD.query('ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check');
    await BD.query("UPDATE documents SET status = 'queued', updated_at = NOW() WHERE status = 'pending'");
    await BD.query("ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status IN ('queued', 'processing', 'extracted', 'analyzing', 'done', 'failed'))");
    await BD.query("CREATE INDEX IF NOT EXISTS idx_documents_processing_guard ON documents(status, updated_at) WHERE status IN ('queued', 'processing', 'extracted', 'analyzing')");
}
