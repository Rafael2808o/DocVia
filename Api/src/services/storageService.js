import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/erros.js';

const MIME_EXTENSOES = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
};

function nomeSeguro(nome) {
    return path.basename(nome).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
}

export async function salvarArquivo(file) {
    const extensao = MIME_EXTENSOES[file.mimetype];
    if (!extensao) throw new AppError('Tipo de arquivo não permitido', 400);

    await mkdir(env.STORAGE_DIR, { recursive: true });
    const nome = `${crypto.randomUUID()}-${nomeSeguro(file.originalname || `documento${extensao}`)}`;
    const caminho = path.join(env.STORAGE_DIR, nome);
    await writeFile(caminho, file.buffer, { flag: 'wx' });

    return { caminho, url: `${env.STORAGE_PUBLIC_URL}/${encodeURIComponent(nome)}` };
}

export async function removerArquivo(caminho) {
    if (!caminho) return;
    await unlink(caminho).catch(() => undefined);
}

export function nomeArquivoDaUrl(url) {
    try {
        const nome = path.basename(new URL(url, 'http://local').pathname);
        return nome || null;
    } catch {
        return null;
    }
}