# DocVia API - Guia Completo

Este README documenta a arquitetura do backend, configuração do PostgreSQL, integração Stripe, rotas de documentos, webhooks e como preparar o projeto para produção.

## 1. Visão geral do projeto

O backend do DocVia é uma API REST em Node.js + Express que oferece:

- autenticação JWT
- upload e armazenamento de documentos
- extração de texto em PDF / OCR
- análise de documentos via IA
- histórico de uso e limite diário
- cobrança premium com Stripe
- leitura de boletos e resumo de contratos

O código principal está em `Api/`.

## 2. Banco de dados

O banco deve ser PostgreSQL. Use o arquivo `Docs/schema.sql` para criar as tabelas e índices necessários.

### Tabelas principais

- `users` — contas de usuário, plano (`free` ou `premium`)
- `documents` — arquivos enviados e metadados
- `analyses` — resultados de IA para documentos
- `usage_logs` — controle de limite diário
- `subscriptions` — histórico de assinaturas premium
- `refresh_tokens` — tokens de refresh JWT

### Importante

- Se você já rodou o SQL antes e recebeu erro de índice duplicado, atualize o arquivo `Docs/schema.sql` e rode novamente.
- O backend não cria o banco automaticamente; você precisa executar o SQL no pgAdmin ou outro client.

## 3. Configuração de ambiente

Crie um arquivo `.env` em `Api/` com estas variáveis:

```env
NODE_ENV=development
PORT=3000
DB_USER=postgres
DB_HOST=localhost
DB_PASSWORD=senha
DB_NAME=DocVia
DB_PORT=5432
JWT_SECRET=algumsegredocom32caracteres...
AI_PROVIDER=gemini
GEMINI_API_KEY=sua-chave-gemini
OPENAI_API_KEY=
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
API_URL=http://localhost:3000
API_VERSION=1.0.0
CORS_ORIGINS=*
STORAGE_DIR=./storage
STORAGE_PUBLIC_URL=/uploads
OCR_ENABLED=true
OCR_LANGUAGE=por
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=8
FAILED_LOGIN_MAX_ATTEMPTS=5
FAILED_LOGIN_LOCKOUT_MS=900000
```

### Observações

- `PAYMENT_PROVIDER` precisa ser `stripe` para usar o fluxo de assinatura.
- `JWT_SECRET` deve ter no mínimo 32 caracteres.
- `OCR_ENABLED=true` ativa OCR em imagens; PDFs usam `pdf-parse`.

## 4. Instalação e execução

No diretório `Api/`:

```bash
npm install
npm start
```

Para rodar testes:

```bash
npm test
```

## 5. Rotas principais

### Autenticação

- `POST /auth/register` — cria conta
- `POST /auth/login` — faz login e retorna `access_token` + `refresh_token`
- `POST /auth/refresh` — renova token de acesso
- `POST /auth/logout` — revoga refresh token

### Usuário

- `GET /users/me` — dados do usuário autenticado

### Billing / Assinatura

#### `GET /billing/plan`

Retorna o plano atual do usuário e a assinatura ativa.

#### `POST /billing/checkout`

Inicia checkout premium.

Corpo JSON:

```json
{
  "payment_method": "card",
  "customer_name": "Nome do Cliente",
  "customer_email": "cliente@example.com"
}
```

Resposta:

- `payment_intent_id`
- `client_secret`
- `status`
- `boleto_url` (se boleto)
- `amount`
- `currency`

#### `POST /billing/confirm`

Confirma o pagamento verificando o `PaymentIntent` no Stripe.

Corpo JSON:

```json
{
  "payment_intent_id": "pi_..."
}
```

#### `POST /billing/cancel`

Cancela a assinatura ativa e rebaixa o usuário para `free`.

#### `GET /billing/subscriptions`

Retorna histórico de assinaturas do usuário.

#### `POST /billing/webhook`

Recebe eventos Stripe e processa `payment_intent.succeeded`.

## 6. Fluxo Stripe e webhook

### Checkout

1. Cliente chama `POST /billing/checkout`
2. Backend cria um `PaymentIntent` Stripe
3. O Stripe retorna `payment_intent_id` e `client_secret`
4. Backend grava `subscriptions` com `status = 'pending'`

### Confirmação manual

1. Cliente chama `POST /billing/confirm`
2. Backend consulta Stripe para conferir o status do `payment_intent`
3. Se `succeeded`, o sistema ativa a assinatura e atualiza `users.plan` para `premium`

### Webhook webhooks

1. Configure Stripe para enviar eventos para:

```text
https://<seu-dominio>/billing/webhook
```

2. Habilite o evento:

- `payment_intent.succeeded`

3. No backend, o webhook valida `stripe-signature` usando `STRIPE_WEBHOOK_SECRET`.
4. Quando o evento é recebido, o backend ativa automaticamente a assinatura.

### Diferença entre `confirm` e webhook

- `confirm` é chamado pelo cliente para confirmar pagamento manualmente.
- Webhook é o caminho seguro e recomendado: Stripe informa o backend diretamente.

## 7. Rotas de documento e IA

### Upload de documento

- `POST /documents`
- Autenticação obrigatória
- Envia `multipart/form-data` com campo `arquivo`
- Aceita PDF, JPG e PNG
- Campo extra: `document_type` com valores:
  - `contrato`
  - `exame`
  - `boleto`
  - `termo_de_uso`
  - `outro`

### Listar documentos

- `GET /documents`

### Detalhes do documento

- `GET /documents/{id}`

### Download de arquivo

- `GET /documents/{id}/file`

### Extrair boleto

- `GET /documents/{id}/boleto`
- Retorna `due_date`, `amount` e `raw_text`
- Só funciona para documentos com `document_type === 'boleto'`

### Resumo de contrato

- `GET /documents/{id}/contract-summary`
- Só funciona para documentos com `document_type === 'contrato'`
- Usa IA para gerar resumo especializado

## 8. Sugestões de produção

### Segurança

- Use HTTPS em produção
- Não exponha `JWT_SECRET` ou chaves Stripe
- Limite origem CORS apenas aos domínios do app

### Stripe

- Use chaves de produção `sk_live_...` em produção
- Ative `STRIPE_WEBHOOK_SECRET` correto
- Valide o endpoint webhook e monitore falhas

### Banco de dados

- Faça backup antes de rodar migrações
- Use `CREATE TABLE IF NOT EXISTS` para não quebrar em atualizações

## 9. Debug e validação

### Verificar configurações

Execute:

```bash
cd Api
node -e "import { env } from './config/env.js'; console.log(env);"
```

### Testar webhook localmente

Use o Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/billing/webhook
```

E depois gere um evento:

```bash
stripe trigger payment_intent.succeeded
```

## 10. Observações finais

- O fluxo atual de Stripe funciona como assinatura premium de 30 dias após pagamento.
- Para uma assinatura recorrente real, seria necessário migrar para a API de `subscriptions` do Stripe.
- O backend já protege rotas com JWT e rate limiting.

---

Se quiser, posso também gerar um `README` específico para o ambiente de desenvolvimento local com exemplos de requests `curl` e Postman.