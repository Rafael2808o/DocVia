# Pacote de lançamento Google Play — DocVia

Atualizado em 7 de agosto de 2026.

## Estado objetivo

**Decisão atual: NÃO PRONTO PARA PUBLICAR.** O código e a identidade estão preparados para staging, mas ainda não existe API pública configurada, AAB assinado, teste Android real nem aprovação pública das páginas legais. Nenhum desses itens pode ser validado apenas no repositório.

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
| Arquivos e documentos | Sim | Funcionalidade solicitada pelo usuário | Armazenamento deve ser privado no R2. |
| Conteúdo de texto | Sim | OCR e análise solicitada | Enviado ao provedor de IA; confirmar enquadramento como prestador de serviço e DPA. |
| Atividade no app | Sim, limitada | Limite de análises, segurança e operação | Registro `analysis_created`; sem publicidade. |
| Diagnósticos e metadados técnicos | Sim, limitados | Segurança, prevenção a fraude e estabilidade | Confirmar retenção dos logs do Cloud Run antes de preencher o formulário. |
| Dados financeiros | Não | — | Pagamentos desativados no lançamento. |
| Saúde | Não no lançamento | — | Tipo `exame` removido da UI e recusado pela API. |
| Fotos/vídeos da galeria | Não como acesso amplo | — | O seletor de arquivos do sistema entrega apenas o item escolhido. |
| Localização, contatos, publicidade e rastreamento | Não | — | Não há SDK de anúncios/analytics no app atual. |

Declarações que só podem ser marcadas depois do deploy e teste:

- dados criptografados em trânsito: **sim**, somente quando API e páginas usarem HTTPS;
- solicitação de exclusão: **sim**, após tornar pública a página de exclusão e validar a remoção no banco e storage;
- compartilhamento com terceiros: revisar o contrato do provedor de IA. Transferências a prestadores de serviço podem ter tratamento específico no formulário, mas não devem ser omitidas sem base contratual;
- práticas de segurança independentes: não declarar auditoria/certificação que não foi realizada.

## Infraestrutura de baixo custo preparada

### Supabase PostgreSQL

1. Criar o projeto e escolher região apropriada.
2. Executar `Docs/supabase-bootstrap.sql` no SQL Editor.
3. Obter a connection string de servidor/pooler com SSL.
4. Guardá-la no Secret Manager como `docvia-database-url`.
5. Não expor a senha no app mobile nem usar as tabelas pela Data API.
6. Testar backup e restauração antes de dados reais.

### Cloudflare R2

1. Criar bucket privado.
2. Criar token limitado somente ao bucket.
3. Preencher `R2_ACCOUNT_ID` e `R2_BUCKET` no ambiente.
4. Guardar access key e secret key no Secret Manager.
5. Não tornar o bucket público: downloads passam pela API autenticada.

### API no Google Cloud Run

1. Instalar Google Cloud CLI e entrar na conta.
2. Criar projeto e vincular uma conta de faturamento, mesmo pretendendo ficar dentro da franquia gratuita.
3. Criar os segredos listados em `Api/deploy/README.md`.
4. Copiar `cloud-run.env.yaml.example` para `cloud-run.env.yaml` e preencher os valores restantes.
5. Executar `Api/deploy/deploy-cloud-run.ps1 -ProjectId SEU_PROJETO`.
6. Criar o Cloud Scheduler para `POST /internal/jobs/maintenance` sem expor `JOB_RUNNER_SECRET`.
7. Definir alertas de orçamento. Franquia gratuita não é garantia de custo zero.

### E-mail e IA

- Configurar remetente real no Resend, com domínio verificado, e testar recuperação de senha. Um endereço Gmail não pode simplesmente ser usado como domínio remetente de produção.
- Ativar uma configuração do provedor de IA compatível com documentos pessoais, revisar termos/DPA e confirmar `AI_PAID_TIER_CONFIRMED=true` somente depois disso.
- O limite global padrão de 250 análises por 24 horas é uma trava de custo, não um orçamento financeiro garantido.

## Geração do AAB

O computador atual não tem Java 17+/Android SDK e não está autenticado no Expo. O caminho mais simples é EAS Build:

```powershell
cd "D:\Codes\Projeto Docvia\Mobile\DocVia"
npx eas-cli login
npx eas-cli build:configure
$env:EXPO_PUBLIC_API_URL="https://SUA-API.run.app"
npx eas-cli build --platform android --profile production
```

O ícone já foi aprovado e substituiu os assets Expo padrão. Antes do build, execute novamente:

```powershell
npm run lint
npm run typecheck
npx expo-doctor
npx expo prebuild --platform android --no-install
```

O projeto atual gera target SDK 36, compatível com a exigência anunciada para novos apps a partir de 31 de agosto de 2026.

## Ordem segura de publicação

- [x] Aprovar/aplicar a nova identidade visual e exportar ícone Play 512 × 512, ícones adaptativos e feature graphic 1024 × 500.
- [ ] Aprovar visualmente a composição final da feature graphic antes do upload.
- [ ] Tornar públicas e testar as páginas de privacidade, termos e exclusão.
- [ ] Configurar Supabase, R2, e-mail, IA e segredos.
- [ ] Publicar a API e validar `/health/live` e `/health/ready`.
- [ ] Testar cadastro, recuperação, login, texto, PDF, câmera, OCR, prazos, notificações, exportação e exclusão com dados sintéticos.
- [ ] Gerar AAB de produção e conferir permissões no App Bundle Explorer.
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
