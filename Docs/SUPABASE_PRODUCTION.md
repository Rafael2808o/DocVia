# Supabase de producao do DocVia

Configuracao concluida em 13 de agosto de 2026.

## Projeto

- Organizacao: `DocVia`
- Projeto: `DocVia`
- Referencia: `ppcfpgyehltwtwrfhiwd`
- Regiao: Sao Paulo (`sa-east-1`)
- Plano: Free
- Banco: PostgreSQL, database `postgres`
- Pooler: Transaction, porta `6543`
- Host: `aws-0-sa-east-1.pooler.supabase.com`

## Seguranca aplicada

- SSL obrigatorio para todas as conexoes do banco.
- Validacao do certificado ativa com a CA oficial do Supabase.
- Papel exclusivo da API: `docvia_api`, sem superusuario, sem criar banco e
  sem criar papeis; limite de 20 conexoes.
- Data API (REST/GraphQL) desativada, pois o app usa apenas a API Node/Express.
- RLS ativado nas dez tabelas.
- Sem permissoes de tabela para `anon`, `authenticated` ou `service_role`.
- Criacao de objetos no schema `public` revogada do papel `PUBLIC`.
- Privilegios padrao endurecidos para novas tabelas, sequencias e funcoes.

O papel `docvia_api` usa `BYPASSRLS` deliberadamente. Ele e usado somente no
servidor, que valida o usuario proprietario em cada rota. A senha nunca deve ser
colocada no app mobile, no Git ou em arquivo publico.

## Configuracao da API

Armazene a URI completa no Secret Manager com o nome
`docvia-database-url`. O formato e:

```text
postgresql://docvia_api.ppcfpgyehltwtwrfhiwd:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

Variaveis publicas obrigatorias:

```text
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA_FILE=/app/config/certs/supabase-prod-ca-2021.crt
DB_POOL_MAX=5
AUTO_MIGRATE=false
```

O certificado publico esta em
`Api/config/certs/supabase-prod-ca-2021.crt`. A senha do banco nao esta no
repositorio e deve ser inserida diretamente no gerenciador de segredos do
provedor onde a API for hospedada.

## Evidencias de validacao

- Bootstrap reaplicado com sucesso, confirmando idempotencia.
- Dez tabelas encontradas e com RLS ativo.
- Papel da API com DML nas dez tabelas e sem privilegios administrativos.
- Papeis do Data API sem SELECT nas dez tabelas.
- Conexao sem SSL rejeitada pelo servidor.
- Conexao da propria implementacao `Api/db.js` aprovada com SSL verificado.
- Fluxo transacional testado: usuario, documento, analise, prazo, uso,
  assinatura, refresh token, reset de senha, job e seguranca de login.
- Relacionamentos e exclusao em cascata aprovados.
- Transacao de teste revertida; nenhum dado de teste permaneceu.
- Security Advisor: zero alertas de nivel warning/error; somente informacoes
  esperadas sobre RLS sem policies, pois a Data API esta desativada.

## Operacao

- O plano Free nao oferece a mesma retencao de backup e garantias de um plano
  pago. Antes de receber dados reais, defina rotina de exportacao e teste de
  restauracao.
- Se a API for migrada para outro provedor, atualize apenas o segredo
  `docvia-database-url`; nao altere o app mobile.
- Para rotacionar a senha da API, altere o papel `docvia_api`, publique uma nova
  versao do segredo e reinicie a API.
