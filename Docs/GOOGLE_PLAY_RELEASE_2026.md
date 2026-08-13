# Pacote de lançamento Google Play — DocVia

## Atualização de infraestrutura — 13 de agosto de 2026

- [x] Páginas de privacidade, termos e exclusão públicas no Cloudflare Pages.
- [x] Supabase Free criado em São Paulo, schema aplicado e conexão real testada.
- [x] SSL obrigatório, Data API desativada e papel exclusivo da API configurado.
- [x] Supabase Storage privado, Cloudflare Workers AI e API HTTPS no Render Free configurados e testados.
- [ ] Recuperação por e-mail aguarda a ativação de um provedor HTTP gratuito; SMTP não funciona no Render Free.

Detalhes e evidências do banco: `Docs/SUPABASE_PRODUCTION.md`.

Atualizado em 13 de agosto de 2026.

## Estado objetivo

**Decisão atual: NÃO PRONTO PARA PUBLICAÇÃO PÚBLICA.** Código, identidade, API, banco, armazenamento privado, IA, páginas legais e AAB assinado estão preparados e foram testados. Ainda faltam a entrega real do e-mail de recuperação, a conclusão paga/pessoal da conta Play Console, o teste em Android físico e o teste fechado obrigatório da Google.

## Identidade do aplicativo

- Nome: **DocVia**
- Application ID: `br.com.docvia.app`
- Versão inicial: `1.0.0`
- Version code: `1`
- Idioma principal: Português (Brasil)
- Categoria sugerida: Produtividade
- Modelo inicial: gratuito, sem anúncios e sem compras no app
- Responsável publicado: Rafael de Oliveira Silva
- E-mail de suporte e privacidade: `zrafaelxd07@gmail.com`
- Política: `https://docvia-privacidade.pages.dev/privacidade`
- Exclusão de conta: `https://docvia-privacidade.pages.dev/excluir-conta`

O ID de pacote deve ser conferido uma última vez antes de criar o app no Play Console. Depois da primeira publicação ele não pode ser trocado para atualizar o mesmo aplicativo.

## Texto preparado para a ficha da loja

### Descrição curta

> Entenda documentos, acompanhe prazos e veja pontos importantes com clareza.

### Descrição completa

> O DocVia ajuda você a organizar e compreender documentos do dia a dia.
>
> Envie um PDF, uma imagem ou digite um texto para receber uma explicação em linguagem simples. O aplicativo destaca prazos, custos, avisos e próximos passos identificados no conteúdo.
>
> Com o DocVia você pode:
>
> • guardar e consultar seus documentos em um só lugar;  
> • visualizar resumos e pontos importantes;  
> • acompanhar prazos identificados nos documentos;  
> • ativar lembretes locais no aparelho;  
> • consultar o texto extraído e as evidências da análise;  
> • exportar seus dados ou excluir sua conta pelo próprio app.
>
> A primeira versão é gratuita e possui limites de uso para manter o serviço disponível.
>
> As análises são geradas com apoio de inteligência artificial e podem conter erros ou omissões. O DocVia não substitui orientação jurídica, financeira, contábil ou médica. Confirme informações importantes no documento original e procure um profissional qualificado quando necessário.

### Notas para revisão da Google

O revisor deve receber uma conta fictícia dedicada, criada somente no ambiente de produção/staging. Não coloque senha no Git. Forneça no Play Console:

- e-mail e senha da conta de revisão;
- instrução para enviar um texto sintético ou PDF sem dados pessoais;
- aviso de que não há compras no app;
- passos para Perfil → Excluir conta;
- canal de suporte: `zrafaelxd07@gmail.com`.

## Data Safety — rascunho conservador

As respostas finais devem refletir a infraestrutura realmente ativada, os contratos dos provedores e a retenção configurada. Este inventário descreve o código atual.

| Categoria | Coletado | Finalidade | Observação |
|---|---:|---|---|
| Nome | Sim | Gerenciamento da conta e funcionalidade | Informado no cadastro. |
| E-mail | Sim | Conta, login, recuperação e suporte | Não usado para publicidade. |
| Arquivos e documentos | Sim | Funcionalidade solicitada pelo usuário | Armazenamento privado no Supabase Storage; acesso mediado pela API autenticada. |
| Conteúdo de texto | Sim | OCR e análise solicitada | Enviado ao provedor de IA; confirmar enquadramento como prestador de serviço e DPA. |
| Atividade no app | Sim, limitada | Limite de análises, segurança e operação | Registro `analysis_created`; sem publicidade. |
| Diagnósticos e metadados técnicos | Sim, limitados | Segurança, prevenção a fraude e estabilidade | Confirmar a retenção efetiva dos logs do Render antes de preencher o formulário. |
| Dados financeiros | Não | — | Pagamentos desativados no lançamento. |
| Saúde | Não no lançamento | — | Tipo `exame` removido da UI e recusado pela API. |
| Fotos/vídeos da galeria | Não como acesso amplo | — | O seletor de arquivos do sistema entrega apenas o item escolhido. |
| Localização, contatos, publicidade e rastreamento | Não | — | Não há SDK de anúncios/analytics no app atual. |

Declarações confirmadas ou ainda condicionais:

- dados criptografados em trânsito: **sim**; API e páginas públicas usam HTTPS;
- solicitação de exclusão: **sim**; página pública e exclusão no app foram testadas no banco e storage;
- compartilhamento com terceiros: revisar o contrato do provedor de IA. Transferências a prestadores de serviço podem ter tratamento específico no formulário, mas não devem ser omitidas sem base contratual;
- práticas de segurança independentes: não declarar auditoria/certificação que não foi realizada.

## Infraestrutura gratuita ativada

- PostgreSQL: Supabase Free, região São Paulo, conexão SSL, papel `docvia_api`, RLS e Data API desativada.
- Documentos: bucket privado `docvia-documents` no Supabase Storage, com limite de 10 MB e PDF/JPG/PNG.
- API: Render Free em `https://docvia-api.onrender.com`, com health checks e segredos fora do Git.
- IA: Cloudflare Workers AI, cota gratuita e trava global de 100 análises por dia.
- Processamento: fila persistida no PostgreSQL e execução protegida por segredo interno.
- Páginas legais: Cloudflare Pages em `https://docvia-privacidade.pages.dev`.

### E-mail e IA

- Finalizar o cadastro gratuito no Brevo, gerar a chave HTTP e testar a recuperação de senha em produção. O backend já suporta `EMAIL_PROVIDER=brevo`.
- Workers AI está ativo; revisar termos/DPA antes de aceitar documentos pessoais reais.
- O limite global de 100 análises por 24 horas é uma trava operacional e não gera cobrança automática.

## Builds Android concluídos

- AAB de produção: `Builds/DocVia-1.0.0-1.aab`, build EAS `b9812c02-78be-484e-8b2e-7576626cb717`.
- APK de teste interno: `Builds/DocVia-1.0.0-preview.apk`, build EAS `a3ec64c4-3c1b-48df-881e-d7512f80aa48`.
- SDK Expo 57, target SDK 36, TypeScript/ESLint aprovados e Expo Doctor 20/20.

## Ordem segura de publicação

- [x] Aprovar/aplicar a nova identidade visual e exportar ícone Play 512 × 512, ícones adaptativos e feature graphic 1024 × 500.
- [ ] Aprovar visualmente a composição final da feature graphic antes do upload.
- [x] Tornar públicas e testar as páginas de privacidade, termos e exclusão.
- [x] Configurar Supabase, storage privado, IA e segredos.
- [ ] Concluir e testar a recuperação por e-mail via API HTTP.
- [x] Publicar a API e validar `/health/live` e `/health/ready`.
- [x] Testar cadastro, login, texto, PDF, OCR, prazos, exportação e exclusão com dados sintéticos.
- [x] Gerar AAB de produção assinado.
- [ ] Conferir permissões no App Bundle Explorer após criar o app na Play Console.
- [ ] Criar ficha, política, Data Safety, classificação indicativa, público-alvo e declarações de conteúdo no Play Console.
- [ ] Fazer teste interno em Android 13 e Android 16 ou versões mais recentes disponíveis.
- [ ] Se a conta pessoal foi criada após 13/11/2023, manter pelo menos 12 testadores inscritos no teste fechado por 14 dias contínuos.
- [ ] Corrigir feedback, gerar novo `versionCode` e pedir acesso à produção.
- [ ] Publicar inicialmente para uma porcentagem pequena e acompanhar erros/custos.

## Critérios para mudar a decisão para “pronto”

Todos precisam estar verdadeiros:

1. AAB assinado instala e passa nos testes em aparelhos reais.
2. API HTTPS, banco, storage privado, fila e e-mail estão operacionais.
3. Exclusão foi comprovada no banco e no R2.
4. Política e exclusão estão públicas sem login.
5. Data Safety coincide com tráfego e contratos reais.
6. Identidade visual foi aprovada e aplicada. **Concluído.**
7. Teste fechado e acesso à produção foram concluídos quando exigidos pela conta.

## Referências oficiais

- Conta de desenvolvedor e taxa: https://support.google.com/googleplay/android-developer/answer/6112435
- Teste fechado para contas pessoais novas: https://support.google.com/googleplay/android-developer/answer/14151465
- Exclusão de conta: https://support.google.com/googleplay/android-developer/answer/13327111
- Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Target API: https://support.google.com/googleplay/android-developer/answer/11926878
- Assets da ficha: https://support.google.com/googleplay/android-developer/answer/9866151
- EAS Build: https://docs.expo.dev/build/introduction/
