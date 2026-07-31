import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../app.js';

test('Swagger fica disponível', async () => {
    const resposta = await request(app).get('/docs/');
    assert.equal(resposta.status, 200);
    assert.match(resposta.text, /Swagger UI/);
});

test('login valida corpo ausente sem consultar o banco', async () => {
    const resposta = await request(app).post('/auth/login').send({});
    assert.equal(resposta.status, 400);
    assert.equal(resposta.body.message, 'Dados inválidos');
    assert.ok(Array.isArray(resposta.body.erros));
});

test('rota protegida exige token', async () => {
    const resposta = await request(app).get('/users/me');
    assert.equal(resposta.status, 401);
    assert.equal(resposta.body.message, 'Token não fornecido');
});

test('download de documento exige token', async () => {
    const resposta = await request(app).get('/documents/00000000-0000-0000-0000-000000000000/file');
    assert.equal(resposta.status, 401);
});

test('rota desconhecida retorna 404', async () => {
    const resposta = await request(app).get('/rota-inexistente');
    assert.equal(resposta.status, 404);
    assert.match(resposta.body.message, /Rota GET/);
});