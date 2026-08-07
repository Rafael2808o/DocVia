import { CloudTasksClient } from '@google-cloud/tasks';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

let cliente;

function obterCliente() {
    if (!cliente) cliente = new CloudTasksClient();
    return cliente;
}

export async function despacharJob(job) {
    if (env.JOB_MODE !== 'cloud-tasks') return false;

    const client = obterCliente();
    const parent = client.queuePath(env.GCP_PROJECT_ID, env.GCP_LOCATION, env.CLOUD_TASKS_QUEUE);
    const runAfter = new Date(job.run_after || Date.now());
    const task = {
        httpRequest: {
            httpMethod: 'POST',
            url: `${env.CLOUD_RUN_SERVICE_URL.replace(/\/$/, '')}/internal/jobs/${job.id}/execute`,
            headers: {
                'Content-Type': 'application/json',
                'X-DocVia-Job-Secret': env.JOB_RUNNER_SECRET,
            },
            body: Buffer.from('{}').toString('base64'),
        },
    };
    if (runAfter.getTime() > Date.now() + 1_000) {
        task.scheduleTime = { seconds: Math.floor(runAfter.getTime() / 1_000) };
    }

    await client.createTask({ parent, task });
    logger.info({ jobId: job.id, type: job.type }, 'Job enviado ao Cloud Tasks');
    return true;
}
