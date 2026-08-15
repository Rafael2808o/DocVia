import { mkdir, unlink, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/erros.js';

const MIME_EXTENSOES = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
};

let clienteObjetos;

function configuracaoObjetos() {
    if (env.STORAGE_PROVIDER === 's3') {
        return {
            bucket: env.S3_BUCKET,
            scheme: 's3',
            client: {
                region: env.S3_REGION,
                endpoint: env.S3_ENDPOINT,
                forcePathStyle: env.S3_FORCE_PATH_STYLE,
                credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
            },
        };
    }
    return {
        bucket: env.R2_BUCKET,
        scheme: 'r2',
        client: {
            region: 'auto',
            endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
        },
    };
}

function obterClienteObjetos() {
    if (!clienteObjetos) clienteObjetos = new S3Client(configuracaoObjetos().client);
    return clienteObjetos;
}

function pngValido(buffer) {
    if (buffer.length < 33 || !buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return false;
    let offset = 8;
    let encontrouCabecalho = false;
    let encontrouFim = false;
    const dadosCompactados = [];

    try {
        while (offset + 12 <= buffer.length) {
            const tamanho = buffer.readUInt32BE(offset);
            const tipo = buffer.subarray(offset + 4, offset + 8).toString('ascii');
            const inicioDados = offset + 8;
            const fimDados = inicioDados + tamanho;
            if (fimDados + 4 > buffer.length) return false;
            if (tipo === 'IHDR') encontrouCabecalho = tamanho === 13;
            if (tipo === 'IDAT') dadosCompactados.push(buffer.subarray(inicioDados, fimDados));
            if (tipo === 'IEND') {
                encontrouFim = tamanho === 0;
                break;
            }
            offset = fimDados + 4;
        }
        if (!encontrouCabecalho || !encontrouFim || dadosCompactados.length === 0) return false;
        inflateSync(Buffer.concat(dadosCompactados));
        return true;
    } catch {
        return false;
    }
}

export function arquivoCorrespondeAoMime(file) {
    const buffer = file.buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;

    if (file.mimetype === 'application/pdf') {
        return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    }
    if (file.mimetype === 'image/png') {
        return pngValido(buffer);
    }
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    return false;
}

function criarChave(extensao) {
    const agora = new Date();
    return `documents/${agora.getUTCFullYear()}/${String(agora.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}${extensao}`;
}

function chaveObjetoDaReferencia(referencia) {
    if (!referencia) return null;
    const { bucket, scheme } = configuracaoObjetos();
    if (!String(referencia).startsWith(`${scheme}://`)) return null;
    try {
        const url = new URL(referencia);
        if (url.hostname !== bucket) return null;
        return decodeURIComponent(url.pathname.replace(/^\/+/, '')) || null;
    } catch {
        return null;
    }
}

function caminhoLocalSeguro(referencia) {
    if (!referencia) throw new AppError('Referência de arquivo inválida', 400);
    const raiz = path.resolve(env.STORAGE_DIR);
    const valor = String(referencia);
    const prefixoPublico = `/${String(env.STORAGE_PUBLIC_URL).replace(/^\/+|\/+$/g, '')}/`;
    let alvo;
    if (valor.startsWith(prefixoPublico) || /^https?:\/\//i.test(valor)) {
        const nome = nomeArquivoDaUrl(valor);
        alvo = path.resolve(raiz, nome || 'arquivo-invalido');
    } else if (path.isAbsolute(valor)) {
        alvo = path.resolve(valor);
    } else {
        const partes = valor.split(/[\\/]+/);
        if (partes.includes('..')) throw new AppError('Referência de arquivo inválida', 400);
        const caminhoRelativoAoProcesso = path.resolve(valor);
        if (caminhoRelativoAoProcesso.startsWith(`${raiz}${path.sep}`)) {
            alvo = caminhoRelativoAoProcesso;
        } else {
            alvo = path.resolve(raiz, valor);
        }
    }
    if (alvo === raiz || !alvo.startsWith(`${raiz}${path.sep}`)) {
        throw new AppError('Referência de arquivo inválida', 400);
    }
    return alvo;
}

export async function salvarArquivo(file) {
    const extensao = MIME_EXTENSOES[file.mimetype];
    if (!extensao) throw new AppError('Tipo de arquivo não permitido', 400);
    if (!arquivoCorrespondeAoMime(file)) {
        throw new AppError('O conteúdo do arquivo não corresponde ao tipo informado', 400);
    }

    const chave = criarChave(extensao);
    if (env.STORAGE_PROVIDER !== 'local') {
        const { bucket, scheme } = configuracaoObjetos();
        await obterClienteObjetos().send(new PutObjectCommand({
            Bucket: bucket,
            Key: chave,
            Body: file.buffer,
            ContentType: file.mimetype,
            CacheControl: 'private, no-store',
            Metadata: { source: 'docvia-api' },
        }));
        return { caminho: chave, url: `${scheme}://${bucket}/${chave}` };
    }

    await mkdir(env.STORAGE_DIR, { recursive: true });
    const caminho = path.resolve(env.STORAGE_DIR, chave.replaceAll('/', path.sep));
    await mkdir(path.dirname(caminho), { recursive: true });
    await writeFile(caminho, file.buffer, { flag: 'wx' });
    return { caminho, url: `${env.STORAGE_PUBLIC_URL}/${chave}` };
}

export async function removerArquivo(referencia) {
    if (!referencia || referencia === 'text://manual-entry') return;
    const chaveObjeto = chaveObjetoDaReferencia(referencia) || (env.STORAGE_PROVIDER !== 'local' && !path.isAbsolute(referencia) ? referencia : null);
    if (chaveObjeto) {
        await obterClienteObjetos().send(new DeleteObjectCommand({ Bucket: configuracaoObjetos().bucket, Key: chaveObjeto }));
        return;
    }
    const alvo = caminhoLocalSeguro(referencia);
    await unlink(alvo).catch((erro) => {
        if (erro.code !== 'ENOENT') throw erro;
    });
}

export function nomeArquivoDaUrl(url) {
    const chaveObjeto = chaveObjetoDaReferencia(url);
    if (chaveObjeto) return chaveObjeto;
    try {
        const pathname = decodeURIComponent(new URL(url, 'http://local').pathname);
        const prefixo = `/${String(env.STORAGE_PUBLIC_URL).replace(/^\/+|\/+$/g, '')}/`;
        const nome = (pathname.startsWith(prefixo) ? pathname.slice(prefixo.length) : pathname.replace(/^\/+/, ''));
        return nome && nome !== '.' && nome !== '..' ? nome : null;
    } catch {
        return null;
    }
}

export async function lerArquivoPorUrl(url) {
    const chaveObjeto = chaveObjetoDaReferencia(url);
    if (chaveObjeto) {
        try {
            const resposta = await obterClienteObjetos().send(new GetObjectCommand({ Bucket: configuracaoObjetos().bucket, Key: chaveObjeto }));
            if (!resposta.Body) throw new AppError('Arquivo do documento não encontrado', 404);
            return Buffer.from(await resposta.Body.transformToByteArray());
        } catch (erro) {
            if (erro.name === 'NoSuchKey' || erro.$metadata?.httpStatusCode === 404) throw new AppError('Arquivo do documento não encontrado', 404);
            throw erro;
        }
    }

    try {
        const caminho = caminhoLocalSeguro(url);
        return await readFile(caminho);
    } catch (erro) {
        if (erro.code === 'ENOENT') throw new AppError('Arquivo do documento não encontrado', 404);
        throw erro;
    }
}
