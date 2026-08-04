import { mkdir, unlink, writeFile, readFile } from 'node:fs/promises';
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

function arquivoCorrespondeAoMime(file) {
    const buffer = file.buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;

    if (file.mimetype === 'application/pdf') {
        return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    }
    if (file.mimetype === 'image/png') {
        return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    return false;
}

function nomeSeguro(nome) {
    return path.basename(nome).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
}

export async function salvarArquivo(file) {
    const extensao = MIME_EXTENSOES[file.mimetype];
    if (!extensao) throw new AppError('Tipo de arquivo não permitido', 400);
    if (!arquivoCorrespondeAoMime(file)) {
        throw new AppError('O conteúdo do arquivo não corresponde ao tipo informado', 400);
    }

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

export async function lerArquivoPorUrl(url) {
    const nome = nomeArquivoDaUrl(url);
    if (!nome || nome === '.' || nome === '..') {
        throw new AppError('Arquivo do documento não encontrado', 404);
    }
    try {
        return await readFile(path.join(env.STORAGE_DIR, nome));
    } catch (erro) {
        if (erro.code === 'ENOENT') throw new AppError('Arquivo do documento não encontrado', 404);
        throw erro;
    }
}
