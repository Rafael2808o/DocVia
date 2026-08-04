import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { salvarArquivo } from '../src/services/storageService.js';

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

test('muitas tentativas de login retornam 429', async () => {
    for (let i = 0; i < 8; i += 1) {
        await request(app).post('/auth/login').send({ email: 'alvo@example.com', senha: 'senhaerrada' });
    }

    const resposta = await request(app).post('/auth/login').send({ email: 'alvo@example.com', senha: 'senhaerrada' });

    assert.equal(resposta.status, 429);
    assert.match(resposta.body.message, /Muitas tentativas/);
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

test('token só é aceito no esquema Bearer', async () => {
    const token = jwt.sign({ id_usuario: '00000000-0000-0000-0000-000000000000' }, env.JWT_SECRET);
    const resposta = await request(app).get('/users/me').set('Authorization', `Basic ${token}`);
    assert.equal(resposta.status, 401);
});

test('UUID inválido é rejeitado antes da consulta ao banco', async () => {
    const token = jwt.sign({ id_usuario: '00000000-0000-0000-0000-000000000000' }, env.JWT_SECRET);
    const resposta = await request(app).get('/documents/nao-e-uuid').set('Authorization', `Bearer ${token}`);
    assert.equal(resposta.status, 400);
    assert.match(resposta.body.message, /UUID válido/);
});

test('upload rejeita conteúdo que não corresponde ao MIME declarado', async () => {
    await assert.rejects(
        salvarArquivo({
            mimetype: 'application/pdf',
            originalname: 'arquivo.pdf',
            buffer: Buffer.from('isto não é um PDF'),
        }),
        { message: 'O conteúdo do arquivo não corresponde ao tipo informado' }
    );
});
