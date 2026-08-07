import { BD } from '../../db.js';
import { logger } from '../../config/logger.js';
import { despacharJob } from './cloudTasksService.js';

const INTERVALO_PADRAO_MS = 2_000;

async function tentarDespachar(job) {
    try {
        return await despacharJob(job);
    } catch (erro) {
        // O job já está persistido. Não transforme uma indisponibilidade momentânea
        // do Cloud Tasks em perda do documento; a manutenção tentará novamente.
        logger.error({ err: erro, jobId: job.id }, 'Job persistido, mas ainda não despachado');
        return false;
    }
}

export async function enfileirarJob(type, payload, { maxAttempts = 3, runAfter = new Date() } = {}) {
    const resultado = await BD.query(
        `INSERT INTO jobs (type, payload, max_attempts, run_after)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [type, JSON.stringify(payload), maxAttempts, runAfter]
    );
    const job = resultado.rows[0];
    await tentarDespachar(job);
    return job;
}

export async function enfileirarJobUnico(type, payload, options) {
    const documentId = String(payload.documentId);
    const cliente = await BD.connect();
    let job;
    try {
        await cliente.query('BEGIN');
        await cliente.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [`${type}:${documentId}`]);
        const existente = await cliente.query(`SELECT * FROM jobs WHERE type = $1 AND payload->>'documentId' = $2 AND status IN ('queued', 'processing') ORDER BY created_at DESC LIMIT 1`, [type, documentId]);
        if (existente.rows[0]) {
            job = existente.rows[0];
        } else {
            const { maxAttempts = 3, runAfter = new Date() } = options || {};
            const resultado = await cliente.query(
                `INSERT INTO jobs (type, payload, max_attempts, run_after)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [type, JSON.stringify(payload), maxAttempts, runAfter]
            );
            job = resultado.rows[0];
        }
        await cliente.query('COMMIT');
    } catch (erro) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        throw erro;
    } finally {
        cliente.release();
    }
    if (job.status === 'queued') await tentarDespachar(job);
    return job;
}

export async function buscarJobPendente(id) {
    const cliente = await BD.connect();
    try {
        await cliente.query('BEGIN');
        const parametros = [];
        const filtroId = id ? 'AND id = $1' : '';
        if (id) parametros.push(id);
        const resultado = await cliente.query(
            `WITH proximo AS (
                SELECT id FROM jobs
                 WHERE status = 'queued' AND run_after <= NOW() ${filtroId}
                 ORDER BY created_at
                 FOR UPDATE SKIP LOCKED LIMIT 1
             )
             UPDATE jobs SET status = 'processing', locked_at = NOW()
              WHERE id IN (SELECT id FROM proximo)
              RETURNING *`,
            parametros
        );
        await cliente.query('COMMIT');
        return resultado.rows[0] || null;
    } catch (erro) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        throw erro;
    } finally {
        cliente.release();
    }
}

async function concluirJob(id) {
    await BD.query(
        `UPDATE jobs SET status = 'completed', completed_at = NOW(), locked_at = NULL
         WHERE id = $1`,
        [id]
    );
}

async function falharJob(job, erro) {
    const tentativas = job.attempts + 1;
    const retryable = !erro.statusCode || erro.statusCode >= 500 || erro.statusCode === 408;
    const acabou = !retryable || tentativas >= job.max_attempts;
    const esperaMs = Math.min(60_000, 1_000 * (2 ** tentativas));
    await BD.query(
        `UPDATE jobs
            SET attempts = $2,
                status = $3,
                locked_at = NULL,
                run_after = NOW() + ($4 * INTERVAL '1 millisecond'),
                last_error = $5
          WHERE id = $1`,
        [job.id, tentativas, acabou ? 'failed' : 'queued', esperaMs, String(erro.message || erro).slice(0, 1_000)]
    );
    if (acabou && job.payload?.documentId) {
        const message = erro.statusCode && erro.statusCode < 500 ? String(erro.message).slice(0, 500) : 'Não conseguimos processar seu documento. Toque para tentar novamente.';
        await BD.query(`UPDATE documents SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2 AND status <> 'done'`, [message, job.payload.documentId]);
    }
    return acabou ? 'failed' : 'retry_scheduled';
}

async function processarJob(job, processadores) {
    const processador = processadores[job.type];
    if (!processador) return falharJob(job, new Error(`Tipo de job não suportado: ${job.type}`));

    const heartbeat = setInterval(() => {
        BD.query(`UPDATE jobs SET locked_at = NOW() WHERE id = $1 AND status = 'processing'`, [job.id])
            .catch((err) => logger.warn({ err, jobId: job.id }, 'Falha ao renovar o bloqueio do job'));
        if (job.payload?.documentId) {
            BD.query(`UPDATE documents SET updated_at = NOW() WHERE id = $1 AND status IN ('processing', 'analyzing')`, [job.payload.documentId])
                .catch((err) => logger.warn({ err, jobId: job.id }, 'Falha ao renovar o processamento do documento'));
        }
    }, 60_000);
    try {
        await processador(job.payload, job);
        await concluirJob(job.id);
        return 'completed';
    } catch (erro) {
        logger.error({ err: erro, jobId: job.id }, 'Falha no processamento do job');
        return falharJob(job, erro);
    } finally {
        clearInterval(heartbeat);
    }
}

export async function executarJobPorId(id, processadores) {
    const job = await buscarJobPendente(id);
    if (!job) {
        const existente = await BD.query('SELECT status, run_after FROM jobs WHERE id = $1', [id]);
        if (!existente.rows[0]) return 'not_found';
        if (existente.rows[0].status === 'queued') return 'not_ready';
        return 'ignored';
    }
    return processarJob(job, processadores);
}

export async function recuperarJobsInterrompidos() {
    await BD.query(
        `UPDATE jobs SET status = 'queued', locked_at = NULL
         WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '15 minutes'`
    );
}

export async function despacharJobsPendentes(limite = 50) {
    const resultado = await BD.query(
        `SELECT * FROM jobs WHERE status = 'queued' ORDER BY run_after, created_at LIMIT $1`,
        [Math.min(Math.max(limite, 1), 100)]
    );
    const despachos = await Promise.allSettled(resultado.rows.map((job) => despacharJob(job)));
    const falhas = despachos.filter((item) => item.status === 'rejected');
    for (const falha of falhas) logger.error({ err: falha.reason }, 'Falha ao redespechar job pendente');
    return { encontrados: resultado.rowCount, despachados: despachos.length - falhas.length, falhas: falhas.length };
}

export function iniciarWorker(processadores, { intervaloMs = INTERVALO_PADRAO_MS } = {}) {
    let executando = false;
    const ciclo = async () => {
        if (executando) return;
        executando = true;
        try {
            await recuperarJobsInterrompidos();
            const job = await buscarJobPendente();
            if (job) await processarJob(job, processadores);
        } catch (erro) {
            logger.error({ err: erro }, 'Falha no worker de jobs');
        } finally {
            executando = false;
        }
    };

    const timer = setInterval(ciclo, intervaloMs);
    ciclo();
    return () => clearInterval(timer);
}
