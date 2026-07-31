import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJSDoc from 'swagger-jsdoc';

dotenv.config();

const usuario = {
    type: 'object',
    properties: {
        id_usuario: { type: 'string', format: 'uuid', example: '0f8fad5b-d9cb-469f-a165-70867728950e' },
        nome: { type: 'string', example: 'Ricardo' },
        email: { type: 'string', format: 'email', example: 'ricardo@email.com' },
        plan: { type: 'string', enum: ['free', 'premium'], example: 'free' },
    },
};

const options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'DocVia API',
            version: process.env.API_VERSION || '1.0.0',
            description:
                'API do DocVia para upload e análise de documentos burocráticos com OCR e IA. ' +
                'A resposta da IA é uma ferramenta de apoio e não substitui orientação profissional.',
            contact: { name: 'Equipe DocVia' },
        },
        servers: [{
            url: process.env.API_URL || 'http://localhost:3000',
            description: process.env.API_URL ? 'Ambiente configurado' : 'Ambiente local',
        }],
        tags: [
            { name: 'Autenticação', description: 'Cadastro, login e ciclo de vida dos tokens' },
            { name: 'Usuários', description: 'Dados da conta autenticada' },
            { name: 'Documentos', description: 'Upload, consulta e remoção de documentos' },
            { name: 'Análises', description: 'Análises de documentos com IA' },
            { name: 'Uso', description: 'Consumo da franquia diária do plano' },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Informe somente o access_token no formato Bearer <token>.',
                },
            },
            schemas: {
                Usuario: usuario,
                Resposta_Login: {
                    type: 'object',
                    required: ['message', 'access_token', 'refresh_token', 'usuario'],
                    properties: {
                        message: { type: 'string', example: 'Login realizado com sucesso' },
                        access_token: { type: 'string', description: 'JWT de acesso com validade de 15 minutos' },
                        refresh_token: { type: 'string', description: 'Token de renovação com validade de 30 dias' },
                        usuario: { $ref: '#/components/schemas/Usuario' },
                    },
                },
                Documento: {
                    type: 'object',
                    required: ['id', 'user_id', 'original_name', 'document_type', 'storage_url', 'status', 'created_at'],
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        user_id: { type: 'string', format: 'uuid' },
                        original_name: { type: 'string', example: 'contrato.pdf' },
                        document_type: { type: 'string', enum: ['contrato', 'exame', 'boleto', 'termo_de_uso', 'outro'] },
                        storage_url: { type: 'string', format: 'uri' },
                        extracted_text: { type: 'string', nullable: true },
                        status: { type: 'string', enum: ['pending', 'processing', 'done', 'failed'] },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                ItemPrazo: {
                    type: 'object',
                    properties: {
                        descricao: { type: 'string', example: 'Prazo para pagamento' },
                        data: { type: 'string', example: '2026-08-15' },
                    },
                },
                ItemCusto: {
                    type: 'object',
                    properties: {
                        descricao: { type: 'string', example: 'Valor da mensalidade' },
                        valor: { type: 'string', example: 'R$ 99,90' },
                    },
                },
                ItemAlerta: {
                    type: 'object',
                    properties: { descricao: { type: 'string', example: 'A multa pode ser aplicada após o vencimento' } },
                },
                Analise: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        document_id: { type: 'string', format: 'uuid' },
                        summary: { type: 'string' },
                        deadlines: { type: 'array', items: { $ref: '#/components/schemas/ItemPrazo' } },
                        costs: { type: 'array', items: { $ref: '#/components/schemas/ItemCusto' } },
                        warnings: { type: 'array', items: { $ref: '#/components/schemas/ItemAlerta' } },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                RespostaUso: {
                    type: 'object',
                    required: ['uso_hoje', 'limite_diario', 'restante'],
                    properties: {
                        uso_hoje: { type: 'integer', minimum: 0, example: 2 },
                        limite_diario: { type: 'integer', minimum: 0, example: 5 },
                        restante: { type: 'integer', minimum: 0, example: 3 },
                    },
                },
                ErroValidacao: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', example: 'Dados inválidos' },
                        erros: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    campo: { type: 'string', example: 'email' },
                                    mensagem: { type: 'string', example: 'Email inválido' },
                                },
                            },
                        },
                    },
                },
                Erro_Padrao: {
                    type: 'object',
                    required: ['message'],
                    properties: { message: { type: 'string', example: 'Documento não encontrado' } },
                },
                Mensagem: {
                    type: 'object',
                    required: ['message'],
                    properties: { message: { type: 'string' } },
                },
                RespostaDocumento: {
                    type: 'object',
                    required: ['message', 'documento'],
                    properties: {
                        message: { type: 'string' },
                        documento: { $ref: '#/components/schemas/Documento' },
                    },
                },
                RespostaAnalise: {
                    type: 'object',
                    required: ['message', 'analise'],
                    properties: {
                        message: { type: 'string' },
                        analise: { $ref: '#/components/schemas/Analise' },
                    },
                },
                RespostaRefresh: {
                    type: 'object',
                    required: ['access_token', 'refresh_token'],
                    properties: {
                        access_token: { type: 'string' },
                        refresh_token: { type: 'string' },
                    },
                },
            },
            responses: {
                NaoAutorizado: { description: 'Token não fornecido', content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro_Padrao' } } } },
                Proibido: { description: 'Token inválido ou expirado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro_Padrao' } } } },
                DadosInvalidos: { description: 'Dados inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroValidacao' } } } },
                NaoEncontrado: { description: 'Recurso não encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro_Padrao' } } } },
                ErroInterno: { description: 'Erro interno do servidor', content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro_Padrao' } } } },
            },
        },
    },
    apis: [path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/routes/*.js').replaceAll('\\', '/')],
};

const swaggerSpecGerado = swaggerJSDoc(options);

function corpo(schema) {
    return { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } };
}

function adicionarResposta(operacao, codigo, description, schema) {
    if (!operacao.responses[codigo]) {
        operacao.responses[codigo] = { description };
    }
    if (schema) operacao.responses[codigo].content = corpo(schema);
}

for (const operacoes of Object.values(swaggerSpecGerado.paths || {})) {
    for (const operacao of Object.values(operacoes)) {
        if (!operacao || !operacao.responses) continue;
        adicionarResposta(operacao, '500', 'Erro interno do servidor', 'Erro_Padrao');
        if (operacao.security) {
            adicionarResposta(operacao, '401', 'Token não fornecido', 'Erro_Padrao');
            adicionarResposta(operacao, '403', 'Token inválido ou expirado', 'Erro_Padrao');
        }
    }
}

const respostas = swaggerSpecGerado.paths;
respostas['/auth/refresh'].post.responses['200'] = { description: 'Tokens renovados', content: corpo('RespostaRefresh') };
respostas['/auth/logout'].post.responses['200'] = { description: 'Logout realizado com sucesso', content: corpo('Mensagem') };
respostas['/auth/register'].post.responses['201'] = { description: 'Usuário criado com sucesso', content: corpo('Mensagem') };
respostas['/documents'].post.responses['201'] = { description: 'Documento enviado com sucesso', content: corpo('RespostaDocumento') };
respostas['/documents'].get.responses['200'] = { description: 'Lista de documentos', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Documento' } } } } };
respostas['/documents/{id}'].get.responses['200'] = { description: 'Documento encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Documento' } } } };
respostas['/documents/{id}'].delete.responses['200'] = { description: 'Documento removido', content: corpo('Mensagem') };
respostas['/documents/{id}/analyze'].post.responses['201'] = { description: 'Análise concluída', content: corpo('RespostaAnalise') };
respostas['/documents/{id}/analysis'].get.responses['200'] = { description: 'Análise encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/Analise' } } } };
respostas['/usage'].get.responses['200'] = { description: 'Dados de uso', content: { 'application/json': { schema: { $ref: '#/components/schemas/RespostaUso' } } } };

export const swaggerSpec = swaggerSpecGerado;