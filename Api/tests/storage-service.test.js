import assert from 'node:assert/strict';
import test from 'node:test';
import { lerArquivoPorUrl, removerArquivo, salvarArquivo } from '../src/services/storageService.js';

const pngMinimo = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x00,
]);

test('armazenamento local salva, lê e remove por URL privada da API', async () => {
    const salvo = await salvarArquivo({ mimetype: 'image/png', buffer: pngMinimo });
    try {
        assert.match(salvo.url, /^\/uploads\/documents\//);
        assert.deepEqual(await lerArquivoPorUrl(salvo.url), pngMinimo);
        assert.deepEqual(await lerArquivoPorUrl(salvo.caminho), pngMinimo);
    } finally {
        await removerArquivo(salvo.caminho);
    }
    await assert.rejects(() => lerArquivoPorUrl(salvo.url), { statusCode: 404 });
});

test('armazenamento local bloqueia referências fora da raiz configurada', async () => {
    await assert.rejects(() => removerArquivo('../package.json'), { statusCode: 400 });
    await assert.rejects(() => lerArquivoPorUrl('../package.json'), { statusCode: 400 });
});
