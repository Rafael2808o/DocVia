import crypto from 'node:crypto';
import { Router } from 'express';
import { env } from '../../config/env.js';
import { asyncHandler, AppError } from '../../utils/erros.js';
import { executarJobPorId, recuperarJobsInterrompidos, despacharJobsPendentes } from '../services/jobService.js';
import { extrairTextoDoDocumento, analisarDocumentoEmSegundoPlano, expirarDocumentosParados } from '../services/documentPipelineService.js';

const router = Router();
const processadores = {
    extract_document_text: extrairTextoDoDocumento,
    analyze_document: analisarDocumentoEmSegundoPlano,
};

function segredoValido(recebido) {
    if (!recebido || !env.JOB_RUNNER_SECRET) return false;
    const esperado = Buffer.from(env.JOB_RUNNER_SECRET);
    const informado = Buffer.from(String(recebido));
    return esperado.length === informado.length && crypto.timingSafeEqual(esperado, informado);
}

router.use((req, res, next) => {
    if (!segredoValido(req.get('X-DocVia-Job-Secret'))) return next(new AppError('Não autorizado', 401));
    return next();
});

router.post('/jobs/:id/execute', asyncHandler(async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
        throw new AppError('Job inválido', 400);
    }
    const status = await executarJobPorId(req.params.id, processadores);
    if (status === 'not_ready' || status === 'retry_scheduled') {
        return res.status(503).json({ message: 'Job reagendado' });
    }
    return res.status(204).send();
}));

router.post('/jobs/maintenance', asyncHandler(async (req, res) => {
    await recuperarJobsInterrompidos();
    await expirarDocumentosParados();
    const dispatch = await despacharJobsPendentes();
    return res.status(dispatch.falhas ? 503 : 200).json({ dispatch });
}));

export default router;
