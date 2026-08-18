import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEmailDomain } from '../src/services/emailDomainService.js';

test('aceita domínio de e-mail com servidor MX', async () => {
    const calls = [];
    const domain = await validateEmailDomain('Pessoa@GMAIL.COM', async (value) => {
        calls.push(value);
        return [{ priority: 10, exchange: 'smtp.google.com' }];
    });
    assert.equal(domain, 'gmail.com');
    assert.deepEqual(calls, ['gmail.com']);
});

test('rejeita domínios fictícios, descartáveis e sem MX', async () => {
    await assert.rejects(validateEmailDomain('pessoa@example.com', async () => []), /domínio real/i);
    await assert.rejects(validateEmailDomain('pessoa@mailinator.com', async () => []), /domínio real/i);
    await assert.rejects(validateEmailDomain('pessoa@dominio-sem-email.test', async () => []), /domínio real/i);
    await assert.rejects(validateEmailDomain('pessoa@empresa.com.br', async () => []), /não está preparado/i);
});
