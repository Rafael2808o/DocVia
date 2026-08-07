# Publicação da API

1. Aplique `../../Docs/supabase-bootstrap.sql` em um projeto Supabase novo.
2. Crie um bucket privado `docvia-documents` no Cloudflare R2 e uma chave limitada somente a esse bucket.
3. Ative a cobrança da API Gemini e confirme que o projeto usa a modalidade em que prompts e respostas não são utilizados para melhorar produtos.
4. Verifique um domínio no Resend e escolha o remetente.
5. No Secret Manager do Google Cloud, crie os sete segredos listados em `deploy-cloud-run.ps1`. Nunca coloque os valores no Git.
6. Copie `cloud-run.env.yaml.example` para `cloud-run.env.yaml`, preencha os valores públicos e mantenha esse arquivo fora do Git.
7. Execute `deploy-cloud-run.ps1 -ProjectId SEU_PROJETO`.
8. Crie no Cloud Scheduler uma chamada POST a cada cinco minutos para `/internal/jobs/maintenance`, enviando o cabeçalho `X-DocVia-Job-Secret` com o segredo correspondente.
9. Confirme `GET /health/live` e `GET /health/ready` antes de gerar o AAB.

O serviço é limitado a três instâncias, concorrência quatro e fila com no máximo dois documentos simultâneos para reduzir o risco de cobrança inesperada.
