import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { criarTokenVerificacao, consumirTokenVerificacao } from '../src/services/emailVerificationService.js';

test('token de verificação é aleatório e somente o hash vai para o banco', async () => {
    const calls = [];
    const cliente = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };
    const token = await criarTokenVerificacao('00000000-0000-4000-8000-000000000001', cliente);

    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(calls.length, 2);
    assert.match(calls[0].sql, /used_at = NOW\(\)/);
    assert.equal(calls[1].params[1], crypto.createHash('sha256').update(token).digest('hex'));
    assert.notEqual(calls[1].params[1], token);
    assert.match(calls[1].sql, /24 hours/);
});

test('token de verificação válido é consumido uma única vez', async () => {
    const token = 'a'.repeat(64);
    const cliente = {
        query: async (sql, params) => {
            assert.match(sql, /used_at IS NULL/);
            assert.match(sql, /expires_at > NOW\(\)/);
            assert.equal(params[0], crypto.createHash('sha256').update(token).digest('hex'));
            return { rows: [{ user_id: '00000000-0000-4000-8000-000000000001' }] };
        },
    };
    assert.equal(await consumirTokenVerificacao(token, cliente), '00000000-0000-4000-8000-000000000001');
});
