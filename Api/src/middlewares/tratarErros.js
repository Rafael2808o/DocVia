import { logger } from '../../config/logger.js';

// Esse middleware SÓ é chamado quando alguma rota der next(err) ou
// lançar um erro dentro de um asyncHandler. Ele precisa ficar registrado
// por ÚLTIMO no app.js, depois de todas as rotas.
//
// eslint-disable-next-line no-unused-vars
export function tratarErros(err, req, res, next) {
    const ehErroConhecido = err.statusCode !== undefined;
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : (ehErroConhecido ? err.statusCode : 500);

    if (ehErroConhecido) {
        logger.warn({ err }, err.message);
    } else {
        // Erro inesperado (bug, banco fora do ar, etc): loga completo,
        // mas NUNCA devolve o stack trace/detalhes pro usuário.
        logger.error({ err }, 'Erro não tratado');
    }

    const mensagem = err.code === 'LIMIT_FILE_SIZE'
        ? 'Arquivo excede o limite de 10 MB'
        : (ehErroConhecido ? err.message : 'Erro interno do servidor');

    return res.status(statusCode).json({ message: mensagem, ...(ehErroConhecido && err.code ? { code: err.code } : {}) });
}

// Chamado quando nenhuma rota bateu com a URL pedida (404).
export function rotaNaoEncontrada(req, res) {
    return res.status(404).json({ message: `Rota ${req.method} ${req.originalUrl} não encontrada` });
}
