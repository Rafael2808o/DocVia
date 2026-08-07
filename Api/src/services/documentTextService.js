import { env } from '../../config/env.js';
import { AppError } from '../../utils/erros.js';
import path from 'node:path';

export async function extrairTexto(file) {
    if (file.mimetype === 'application/pdf') {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: file.buffer });
        try {
            const resultado = await parser.getText({ first: env.PDF_MAX_PAGES + 1 });
            if (resultado.total > env.PDF_MAX_PAGES) throw new AppError(`O PDF excede o limite de ${env.PDF_MAX_PAGES} páginas. Divida o arquivo e tente novamente.`, 422);
            return resultado.text.trim() || null;
        } finally {
            await parser.destroy();
        }
    }

    if (env.OCR_ENABLED) {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker(env.OCR_LANGUAGE, 1, env.TESSERACT_PATH ? {
            langPath: path.resolve(env.TESSERACT_PATH),
            gzip: false,
            cacheMethod: 'readOnly',
        } : {});
        let timeout;
        try {
            const resultado = await Promise.race([
                worker.recognize(file.buffer),
                new Promise((resolve, reject) => { timeout = setTimeout(() => reject(new AppError('O OCR demorou demais. Tente uma imagem menor ou mais nítida.', 504)), env.OCR_TIMEOUT_MS); }),
            ]);
            return resultado.data.text.trim() || null;
        } finally {
            clearTimeout(timeout);
            await worker.terminate();
        }
    }

    return null;
}
