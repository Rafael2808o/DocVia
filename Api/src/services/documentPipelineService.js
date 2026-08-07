import { BD } from '../../db.js';
import { AppError } from '../../utils/erros.js';
import { extrairTexto } from './documentTextService.js';
import { analisarDocumentoComIA } from './aiAnalysisV2Service.js';
import { lerArquivoPorUrl } from './storageService.js';
import { reservarUsoNaTransacao } from './usoService.js';
import { enfileirarJobUnico } from './jobService.js';
import { logger } from '../../config/logger.js';

const FAIL_MESSAGE = 'Não conseguimos processar seu documento. Toque para tentar novamente.';
const setState = (id, status, error = null) => BD.query(`UPDATE documents SET status = $2, error_message = $3, updated_at = NOW() WHERE id = $1`, [id, status, error]);

export async function extrairTextoDoDocumento({ documentId }) {
    const resultado = await BD.query('SELECT id, user_id, storage_url, mime_type, status, extracted_text FROM documents WHERE id = $1', [documentId]);
    const documento = resultado.rows[0];
    if (!documento) throw new AppError('Documento não encontrado', 404);
    if (['extracted', 'analyzing', 'done'].includes(documento.status) && documento.extracted_text?.trim()) {
        return enfileirarJobUnico('analyze_document', { documentId, userId: documento.user_id });
    }
    await setState(documentId, 'processing');
    try {
        logger.info({ documentId, mime: documento.mime_type, storageUrl: documento.storage_url }, 'Iniciando extração de documento');
        const buffer = await lerArquivoPorUrl(documento.storage_url);
        const texto = await extrairTexto({ buffer, mimetype: documento.mime_type || 'application/pdf' });
        if (!texto?.trim()) throw new AppError('Não foi possível extrair texto deste arquivo. Verifique se a imagem está legível e tente novamente.', 422);
        await BD.query(`UPDATE documents SET extracted_text = $1, status = 'extracted', error_message = NULL, updated_at = NOW() WHERE id = $2`, [texto, documentId]);
        await enfileirarJobUnico('analyze_document', { documentId, userId: documento.user_id });
    } catch (erro) {
        await setState(documentId, 'failed', String(erro.message || FAIL_MESSAGE).slice(0, 500));
        throw erro;
    }
}

export async function analisarDocumentoEmSegundoPlano({ documentId, userId }) {
    const resultado = await BD.query('SELECT id, original_name, storage_url, document_type, extracted_text, status FROM documents WHERE id = $1 AND user_id = $2', [documentId, userId]);
    const documento = resultado.rows[0];
    if (!documento) throw new AppError('Documento não encontrado', 404);
    if (documento.status === 'done') return;
    if (!documento.extracted_text?.trim()) throw new AppError('O documento ainda não possui texto extraído para análise', 422);
    await setState(documentId, 'analyzing');
    try {
        const resultadoIA = await analisarDocumentoComIA(documento.extracted_text, documento.document_type);
        const generatedTitle = String(resultadoIA.title || resultadoIA.summary || '').split(/[.!?]/)[0].trim().slice(0, 60);
        const cliente = await BD.connect();
        try {
            await cliente.query('BEGIN');
            const usuario = await cliente.query('SELECT plan FROM users WHERE id = $1 FOR UPDATE', [userId]);
            if (!await reservarUsoNaTransacao(cliente, userId, usuario.rows[0]?.plan ?? 'free')) throw new AppError('Limite diário de análises atingido. Faça upgrade para o plano premium.', 429);
            await cliente.query(`INSERT INTO analyses (document_id, summary, deadlines, costs, warnings, raw_ai_response) VALUES ($1, $2, $3, $4, $5, $6)`, [documentId, resultadoIA.summary, JSON.stringify(resultadoIA.deadlines), JSON.stringify(resultadoIA.costs), JSON.stringify(resultadoIA.warnings), JSON.stringify({ provider_response: resultadoIA.raw, action_items: resultadoIA.action_items, evidence: resultadoIA.evidence })]);
            for (const prazo of resultadoIA.deadlines) if (/^\d{4}-\d{2}-\d{2}$/.test(prazo.data || '')) await cliente.query('INSERT INTO document_deadlines (document_id, description, due_date) VALUES ($1, $2, $3)', [documentId, prazo.descricao || 'Prazo identificado', prazo.data]);
            await cliente.query(`UPDATE documents SET original_name = CASE WHEN storage_url = 'text://manual-entry' AND original_name = 'Texto digitado' AND $2 <> '' THEN $2 ELSE original_name END, status = 'done', error_message = NULL, updated_at = NOW() WHERE id = $1`, [documentId, generatedTitle]);
            await cliente.query('COMMIT');
        } catch (erro) { await cliente.query('ROLLBACK'); throw erro; } finally { cliente.release(); }
    } catch (erro) { await setState(documentId, 'failed', String(erro.message || FAIL_MESSAGE).slice(0, 500)); throw erro; }
}

export async function expirarDocumentosParados() {
    const resultado = await BD.query(`UPDATE documents SET status = 'failed', error_message = $1, updated_at = NOW() WHERE status IN ('queued', 'processing', 'extracted', 'analyzing') AND updated_at < NOW() - INTERVAL '5 minutes' RETURNING id`, [FAIL_MESSAGE]);
    if (resultado.rowCount) logger.warn({ documentIds: resultado.rows.map((item) => item.id) }, 'Timeout guard finalizou documentos parados');
}
