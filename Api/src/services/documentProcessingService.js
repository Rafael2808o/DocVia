import { BD } from '../../db.js';
import { AppError } from '../../utils/erros.js';
import { extrairTexto } from './documentTextService.js';
import { analisarDocumentoComIA } from './iaService.js';
import { lerArquivoPorUrl } from './storageService.js';
import { reservarUsoNaTransacao } from './usoService.js';

export async function extrairTextoDoDocumento({ documentId }) {
    const resultado = await BD.query(
        'SELECT id, storage_url, mime_type FROM documents WHERE id = $1', [documentId]
    );
    const documento = resultado.rows[0];
    if (!documento) throw new AppError('Documento não encontrado', 404);

    const buffer = await lerArquivoPorUrl(documento.storage_url);
    const texto = await extrairTexto({ buffer, mimetype: documento.mime_type || 'application/pdf' });
    await BD.query(
        'UPDATE documents SET extracted_text = $1, status = $2 WHERE id = $3',
        [texto, texto ? 'pending' : 'failed', documentId]
    );
}

export async function analisarDocumentoEmSegundoPlano({ documentId, userId }) {
    const documentoResultado = await BD.query(
        'SELECT id, document_type, extracted_text FROM documents WHERE id = $1 AND user_id = $2',
        [documentId, userId]
    );
    const documento = documentoResultado.rows[0];
    if (!documento) throw new AppError('Documento não encontrado', 404);
    if (!documento.extracted_text?.trim()) {
        throw new AppError('O documento ainda não possui texto extraído para análise', 422);
    }

    const resultadoIA = await analisarDocumentoComIA(documento.extracted_text, documento.document_type);
    const cliente = await BD.connect();
    try {
        await cliente.query('BEGIN');
        const usuario = await cliente.query('SELECT plan FROM users WHERE id = $1 FOR UPDATE', [userId]);
        const plano = usuario.rows[0]?.plan ?? 'free';
        const podeUsar = await reservarUsoNaTransacao(cliente, userId, plano);
        if (!podeUsar) throw new AppError('Limite diário de análises atingido. Tente novamente após a renovação da cota.', 429);

        await cliente.query('UPDATE documents SET status = $1 WHERE id = $2', ['processing', documentId]);
        const analise = await cliente.query(
            `INSERT INTO analyses (document_id, summary, deadlines, costs, warnings, raw_ai_response)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [documentId, resultadoIA.summary, JSON.stringify(resultadoIA.deadlines), JSON.stringify(resultadoIA.costs),
                JSON.stringify(resultadoIA.warnings), JSON.stringify({
                    provider_response: resultadoIA.raw,
                    action_items: resultadoIA.action_items,
                    evidence: resultadoIA.evidence,
                })]
        );
        for (const prazo of resultadoIA.deadlines) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(prazo.data || '')) {
                await cliente.query('INSERT INTO document_deadlines (document_id, description, due_date) VALUES ($1, $2, $3)', [documentId, prazo.descricao || 'Prazo identificado', prazo.data]);
            }
        }
        await cliente.query('UPDATE documents SET status = $1 WHERE id = $2', ['done', documentId]);
        await cliente.query('COMMIT');
        return analise.rows[0];
    } catch (erro) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        await BD.query('UPDATE documents SET status = $1 WHERE id = $2', ['failed', documentId]).catch(() => undefined);
        throw erro;
    } finally {
        cliente.release();
    }
}
