ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
UPDATE documents SET status = 'queued', updated_at = NOW() WHERE status = 'pending';
ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status IN ('queued', 'processing', 'extracted', 'analyzing', 'done', 'failed'));
CREATE INDEX IF NOT EXISTS idx_documents_processing_guard ON documents(status, updated_at) WHERE status IN ('queued', 'processing', 'extracted', 'analyzing');
