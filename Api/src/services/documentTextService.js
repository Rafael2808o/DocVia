import { env } from '../../config/env.js';

export async function extrairTexto(file) {
    if (file.mimetype === 'application/pdf') {
        const moduloPdf = await import('pdf-parse');
        const pdfParse = moduloPdf.default;
        const resultado = await pdfParse(file.buffer);
        return resultado.text.trim() || null;
    }

    if (env.OCR_ENABLED) {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker(env.OCR_LANGUAGE);
        try {
            const resultado = await worker.recognize(file.buffer);
            return resultado.data.text.trim() || null;
        } finally {
            await worker.terminate();
        }
    }

    return null;
}