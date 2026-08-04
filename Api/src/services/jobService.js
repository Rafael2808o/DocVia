import { BD } from '../../db.js';
import { logger } from '../../config/logger.js';

const INTERVALO_PADRAO_MS = 2_000;

export async function enfileirarJob(type, payload, { maxAttempts = 3, runAfter = new Date() } = {}) {
    const resultado = await BD.query(
        `INSERT INTO jobs (type, payload, max_attempts, run_after)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [type, JSON.stringify(payload), maxAttempts, runAfter]
    );
    return resultado.rows[0];
}

export async function buscarJobPendente() {
    const cliente = await BD.connect();
    try {
        await cliente.query('BEGIN');
        const resultado = await cliente.query(
            `WITH proximo AS (
                SELECT id FROM jobs
                 WHERE status = 'queued' AND run_after <= NOW()
                 ORDER BY created_at
                 FOR UPDATE SKIP LOCKED LIMIT 1
             )
             UPDATE jobs SET status = 'processing', locked_at = NOW()
              WHERE id IN (SELECT id FROM proximo)
              RETURNING *`
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
    const acabou = tentativas >= job.max_attempts;
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
}

export async function recuperarJobsInterrompidos() {
    await BD.query(
        `UPDATE jobs SET status = 'queued', locked_at = NULL
         WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '15 minutes'`
    );
}

export function iniciarWorker(processadores, { intervaloMs = INTERVALO_PADRAO_MS } = {}) {
    let executando = false;
    const ciclo = async () => {
        if (executando) return;
        executando = true;
        let job;
        try {
            await recuperarJobsInterrompidos();
            job = await buscarJobPendente();
            if (!job) return;
            const processador = processadores[job.type];
            if (!processador) throw new Error(`Tipo de job não suportado: ${job.type}`);
            await processador(job.payload, job);
            await concluirJob(job.id);
        } catch (erro) {
            logger.error({ err: erro }, 'Falha no worker de jobs');
            if (job) await falharJob(job, erro);
        } finally {
            executando = false;
        }
    };

    const timer = setInterval(ciclo, intervaloMs);
    ciclo();
    return () => clearInterval(timer);
}
