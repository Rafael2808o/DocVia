# Auditoria de pre-lançamento - DocVia

Data da auditoria: 7 de agosto de 2026  
Escopo: app Expo/React Native, API Node/Express, PostgreSQL, processamento assíncrono, OCR/IA, documentos, autenticação, notificações, privacidade, pagamentos, dependências e preparação Android/Google Play.

## Decisão executiva

**NÃO PRONTO.**

O app ficou significativamente mais seguro e consistente e os fluxos centrais de cadastro, login, texto, PDF, IA e prazos funcionaram em teste visual real. O repositório agora contém configuração Android, bootstrap Supabase, storage R2 privado, fila Cloud Tasks, container/deploy Cloud Run, páginas legais e pacote de publicação. Ainda existem bloqueadores externos: infraestrutura não provisionada, remetente de e-mail e IA não homologados, páginas legais ainda privadas, ícone de produto aguardando aprovação e ausência de AAB assinado testado em Android real.

### Atualização de preparação para produção

- Application ID definido como `br.com.docvia.app`, versão `1.0.0` e `versionCode` 1.
- Manifesto Android regenerado: câmera e notificações presentes; galeria, armazenamento amplo, microfone e overlay explicitamente removidos.
- Target SDK gerado pelo React Native/Expo: API 36.
- Lançamento inicial definido como gratuito; rotas mutáveis de pagamento retornam indisponível quando `PAYMENT_PROVIDER=none`.
- Tipo sensível `exame` removido da UI e bloqueado pela API até homologação específica.
- Site legal versão 1 salvo e implantado em URL definitiva, ainda com autenticação privada aguardando aprovação para abertura pública.
- O novo ícone foi aprovado e aplicado; launcher adaptativo, monochrome, splash, ícone Play 512 × 512 e feature graphic 1024 × 500 foram gerados.
- `Docs/GOOGLE_PLAY_RELEASE_2026.md` contém ficha da loja, Data Safety preliminar, implantação e ordem de lançamento.

## Evidências executadas

- API: **20/20 testes aprovados** após a bateria final.
- Dependências da API: **0 vulnerabilidades conhecidas** no `npm audit --omit=dev`.
- Mobile: ESLint sem erros ou avisos.
- Mobile: TypeScript `tsc --noEmit` aprovado. A cobertura é limitada porque `App.tsx` usa `@ts-nocheck` e grande parte do app ainda está em JavaScript.
- Expo Doctor: **20/20 verificações aprovadas**.
- Export JavaScript Android/Hermes: concluído; bundle final de aproximadamente **4,8 MB**.
- Build AAB local: bloqueado porque o computador possui somente Java 8 e não tem Android SDK. O EAS também não está autenticado; o export JavaScript Android foi aprovado.
- Auditoria mobile: **12 alertas moderados** numa cadeia interna do Expo/Xcode/`uuid` (incluindo módulos Expo diretos que dependem da mesma cadeia). Nenhum alerta alto/crítico. A correção forçada incompatível não foi aplicada.
- Banco: tabelas e contagens inspecionadas; a tabela ausente de reset de senha foi criada sem apagar dados.
- Teste visual: onboarding, validação de formulários, cadastro, login, logout, recuperação com e-mail inexistente, busca/filtros, upload por texto, upload de PDF, retry, progresso, detalhes, custos, avisos, texto extraído, prazos, central de notificações, perfil, privacidade e proteção da exclusão.
- Console Web: nenhuma exceção; apenas avisos de desenvolvimento do React Native Web.
- Nenhum pagamento foi realizado e nenhum dado existente foi excluído.

### Dados fictícios criados

- Conta: `audit.docvia.20260807.001@example.com`.
- Documentos: `Contrato Fictício de Teste`, `Contrato Fictício de Regressão` e `contrato-ficticio-upload.pdf`.
- O PDF falhou inicialmente por defeito real no parser, foi corrigido e reprocessado com sucesso no mesmo documento.
- Os registros foram mantidos porque a auditoria não tinha autorização para excluí-los.

## Problemas corrigidos

### C-01 - Progresso contava etapa apenas iniciada

- Severidade: alta.
- Onde: `Mobile/DocVia/src/screens/UploadV2.js`.
- Reprodução: iniciar uma análise e observar a porcentagem enquanto a próxima etapa está ativa.
- Impacto: mostrava 80% com somente três etapas concluídas.
- Causa: o estado ativo era contado como concluído.
- Correção: cada uma das cinco etapas agora vale 20% somente depois de concluída.
- Evidência: 0% sem etapas concluídas, 40% com duas, 60% com três e 100% com cinco.

### C-02 - Recorrência mensal e data deslocada por fuso

- Severidade: alta.
- Onde: normalização da IA, utilitários de datas, detalhes, Home e tela de prazos.
- Reprodução: analisar texto com `todo dia 15` e `30/09/2026`.
- Impacto: o dia 15 não aparecia no calendário e 30/09 era exibido como 29/09.
- Causa: resposta incompleta do provedor para recorrência e interpretação de `YYYY-MM-DD` como UTC.
- Correção: recuperação do dia no texto-fonte, materialização da próxima ocorrência e parsing local de datas sem horário.
- Evidência: `15 de ago. · recorrência mensal`, `30 de set.` e card visível no calendário do dia 15.

### C-03 - Upload de PDF sempre podia falhar no Node ESM

- Severidade: bloqueador funcional.
- Onde: `Api/src/services/documentTextService.js` e dependência `pdf-parse`.
- Reprodução: enviar PDF válido. A versão 1.1.1 tentou abrir o arquivo interno `test/data/05-versions-space.pdf`; depois rejeitou PDF válido com `bad XRef entry`.
- Impacto: fluxo central de PDF quebrado.
- Causa: entrypoint com efeito colateral e PDF.js muito antigo.
- Correção: atualização para `pdf-parse 2.4.5`, nova API `PDFParse`, limite de páginas e destruição garantida do parser.
- Evidência: teste automatizado adicionado; extração real de 335 caracteres e reprocessamento visual concluído em 100%.

### C-04 - Cota de IA debitada depois do custo externo

- Severidade: alta.
- Onde: pipeline e serviço de uso da API.
- Reprodução: disparar análises concorrentes perto do limite diário.
- Impacto: chamadas pagas poderiam ocorrer antes de a cota ser recusada.
- Causa: validação posterior ao provedor.
- Correção: reserva atômica antes da chamada e liberação em falhas.

### C-05 - Jobs duplicados e condições de corrida

- Severidade: alta.
- Onde: `jobService`, rotas e pipeline.
- Reprodução: acionar upload/retry simultaneamente.
- Impacto: processamento e cobrança duplicados.
- Causa: ausência de exclusão mútua por documento/tipo.
- Correção: enqueue único com advisory lock transacional e heartbeat do worker.

### C-06 - Falha transitória marcava documento como falho cedo demais

- Severidade: alta.
- Onde: pipeline e worker.
- Reprodução: provocar erro temporário antes da última tentativa.
- Impacto: UI oferecia retry enquanto o job ainda podia se recuperar.
- Causa: estado do documento atualizado dentro do pipeline.
- Correção: somente falha final/não recuperável marca o documento; timeout de processamento e heartbeat adicionados.

### C-07 - Resposta de IA insuficientemente normalizada

- Severidade: alta.
- Onde: `aiAnalysisV2Service`.
- Impacto: arrays, prioridades, datas e recorrências inconsistentes quebravam a UI.
- Correção: contrato estruturado, normalização defensiva, limites e testes de regressão.

### C-08 - Armazenamento desnecessário da resposta crua do provedor

- Severidade: alta, privacidade.
- Onde: pipeline e tabela `analyses`.
- Impacto: retenção adicional de conteúdo potencialmente pessoal.
- Correção: novas análises guardam apenas metadados do provedor, ações e evidências normalizadas.
- Observação: registros antigos não foram alterados/excluídos.

### C-09 - Listagem expunha caminho interno e texto integral

- Severidade: alta.
- Onde: `GET /documents` e respostas de upload.
- Impacto: ampliação desnecessária de dados sensíveis em memória/logs/cliente.
- Correção: projeções explícitas e sanitização; texto completo somente no detalhe autenticado.

### C-10 - Resumo de contrato repetia chamada de IA sem necessidade

- Severidade: alta.
- Onde: rota de resumo contratual.
- Impacto: custo e bypass indireto de cota.
- Correção: rota retorna exclusivamente a análise já persistida.

### C-11 - Retry de entrada manual tentava extração de arquivo

- Severidade: média.
- Correção: se já existe texto extraído, o retry agenda diretamente `analyze_document`.

### C-12 - Reset de senha sem tabela e consumo não transacional

- Severidade: bloqueador funcional/alta segurança.
- Onde: schema, inicialização e serviço de reset.
- Impacto: recurso quebrado; token podia ser consumido antes da troca de senha terminar.
- Correção: criação idempotente da tabela e transação única.

### C-13 - Exclusão de conta deixava dados auxiliares

- Severidade: alta, LGPD.
- Onde: rota de usuário.
- Impacto: jobs e segurança de login podiam permanecer após exclusão.
- Correção: remoção transacional explícita desses registros.

### C-14 - Exportação de dados incompleta

- Severidade: média.
- Correção: inclui texto, metadados de análise, prazos, uso e assinaturas; arquivo binário é obtido no endpoint autenticado próprio.

### C-15 - Produção iniciava com configuração insegura/incompleta

- Severidade: alta.
- Onde: `Api/config/env.js` e exemplos de ambiente.
- Correção: fail-fast para HTTPS, URLs legais, contato de privacidade, e-mail/reset, provedor de IA e suporte a `DB_SSL`.

### C-16 - Limites insuficientes de PDF/OCR/IA

- Severidade: alta, disponibilidade/custo.
- Correção: limite de páginas, timeout de OCR e limite de caracteres enviados à IA.

### C-17 - Refresh tokens novos duravam 365 dias

- Severidade: alta.
- Correção: novos tokens expiram em 30 dias.
- Observação: os tokens antigos continuam existentes até limpeza aprovada.

### C-18 - Permissões e notificações

- Severidade: alta para Play Store/UX.
- Correção: alertas iniciam desligados, canal Android é criado antes da permissão, agendamento só ocorre após análise concluída, permissões não usadas removidas/bloqueadas e backup Android desativado.
- Evidência: central informa corretamente quando alertas estão desativados.

### C-19 - Rótulos enganosos e ausência de disclaimer

- Severidade: alta para produto regulado.
- Correção: status/avisos reais substituem rótulos fixos e detalhes exibem que IA pode errar e não substitui orientação jurídica, financeira ou médica.

### C-20 - Privacidade, onboarding e redefinição

- Severidade: média/alta.
- Correção: tela de privacidade, links no cadastro/perfil, persistência do onboarding, scheme `docvia`, deep link de reset e fluxo para digitar código.

### C-21 - Dependências e compatibilidade Expo

- Severidade: alta.
- Correção: pacotes Expo alinhados ao SDK 57, pacotes não usados removidos, `expo-clipboard`/`expo-sharing` adequados adicionados e Expo Doctor passou 20/20.

### C-22 - Acessibilidade básica dos painéis

- Severidade: média.
- Correção: todos os `Sheet` agora têm botão de fechar acessível e marcação de modal.

### C-23 - Downloads sem timeout e URL revogada cedo

- Severidade: média.
- Correção: timeout/autenticação na requisição binária; no Web o link é anexado e a URL é revogada com atraso.
- Limitação: o download Web ainda não foi capturado no navegador automatizado e continua pendente de validação manual. O caminho Android nativo é diferente e não foi executado em aparelho.

## Problemas pendentes

### B-01 - Identidade visual Android

- Severidade: bloqueador.
- Severidade: resolvido.
- Situação: package `br.com.docvia.app`, versão, `versionCode`, ícone aprovado, variantes adaptativas/monocromáticas, splash e ícone Play estão definidos.
- Evidência: `expo prebuild` gerou os mipmaps e splash nativos; lint, typecheck e Expo Doctor permaneceram aprovados.

### B-02 - Páginas legais ainda não estão públicas

- Severidade: bloqueador.
- Onde: `LegalSite` e configuração de acesso do Sites.
- Situação: política, termos e exclusão foram construídos/testados com Rafael de Oliveira Silva e `zrafaelxd07@gmail.com`; a versão 1 está implantada, mas exige login.
- Impacto: a Play Store e usuários externos não conseguem acessar os documentos.
- Recomendação: obter aprovação explícita e alterar o acesso para público; depois testar sem sessão.

### B-03 - API mobile aponta para HTTP/LAN

- Severidade: bloqueador.
- Onde: `.env` mobile atual.
- Impacto: build fora da rede local não funciona; tráfego HTTP pode ser bloqueado ou interceptado.
- Recomendação: provisionar domínio HTTPS público e preencher o ambiente de produção.

### B-04 - R2 privado preparado, mas não provisionado

- Severidade: bloqueador.
- Situação: adaptador R2 privado e download autenticado foram implementados; faltam bucket, credenciais e teste real.
- Impacto: sem provisionamento a produção não inicia; storage local continua inadequado para Cloud Run.
- Recomendação: criar bucket privado, token mínimo, política de retenção e teste de upload/download/exclusão.

### B-05 - Tratamento de documentos sensíveis pelo provedor de IA não aprovado

- Severidade: bloqueador de privacidade.
- Impacto: contratos e exames podem conter dados pessoais, financeiros e de saúde.
- Causa: não há evidência no repositório de plano pago/DPA, região, retenção ou exclusão do uso para treinamento/revisão humana.
- Recomendação: confirmar contrato/DPA e configuração paga do Gemini ou desabilitar documentos sensíveis; considerar redação de PII antes do envio. O tipo `Exame` exige revisão jurídica e clínica adicional.

### B-06 - Pagamentos removidos do escopo inicial

- Severidade: resolvido para o lançamento gratuito; volta a ser bloqueador se houver monetização.
- Situação: UI de compra removida e endpoints mutáveis bloqueados por `PAYMENT_PROVIDER=none`.
- Recomendação: não habilitar Stripe para recursos digitais Android. Se monetizar depois, implementar Google Play Billing e nova auditoria.

### B-07 - AAB assinado e testes nativos não executados

- Severidade: bloqueador.
- Impacto: permissões, notificacões Android 13+, câmera, seletor, compartilhamento, deep links, assinatura e target SDK não foram validados no artefato final.
- Causa: Android SDK ausente no computador.
- Recomendação: instalar SDK/Android Studio com aprovação ou usar EAS Build; testar AAB em internal testing e pelo menos um Android 13 e um Android recente.

### A-01 - Exclusão de arquivo e banco não é atômica

- Severidade: alta.
- Onde: exclusão de documento/conta.
- Reprodução: falhar filesystem entre remoção do arquivo e commit do banco.
- Impacto: arquivo órfão ou banco apontando para arquivo ausente.
- Recomendação: outbox/tombstone, job de limpeza idempotente e auditoria de órfãos.

### A-02 - Rate limit somente em memória

- Severidade: alta.
- Impacto: limites inconsistentes em múltiplas instâncias e perda ao reiniciar; `trust proxy=1` depende da topologia correta.
- Recomendação: Redis/serviço compartilhado, chave por conta+IP e configuração de proxy documentada/testada.

### A-03 - Cloud Tasks preparado, mas não validado em produção

- Severidade: alta.
- Situação: produção exige `JOB_MODE=cloud-tasks`; jobs ficam persistidos no banco, possuem claim idempotente, heartbeat, retry e endpoint interno protegido.
- Risco restante: fila, permissões IAM, manutenção e comportamento em restart ainda não foram testados numa conta Google Cloud real.
- Recomendação: executar teste de falha/retry, backlog, duplicidade, DLQ e alerta antes de dados reais.

### A-04 - Recuperação de senha de produção não configurada

- Severidade: alta.
- Impacto: usuário real não recebe o e-mail.
- Recomendação: configurar remetente/domínio, URL universal/app link, SPF/DKIM/DMARC e teste end-to-end.

### A-05 - Tokens antigos e crescimento da tabela

- Severidade: alta.
- Evidência: havia 49 refresh tokens para quatro usuários antes dos testes; novos tokens agora duram 30 dias.
- Impacto: superfície de sessão e crescimento indefinido.
- Recomendação: revogação por família/rotação, limite por dispositivo e job de expurgo. Exige aprovação antes de apagar registros existentes.

### A-06 - Download Web e download Android não aprovados ponta a ponta

- Severidade: alta para a função de portabilidade.
- Evidência: endpoint autenticado respondeu sem erro visível, mas o navegador automatizado não iniciou um download observável; Android não foi executado.
- Recomendação: teste manual em Chrome/Opera e teste nativo. Para Web de produção, considerar URL de download temporária/assinada ou File System Access API com fallback.

### A-07 - Sem observabilidade e plano operacional demonstrados

- Severidade: alta.
- Impacto: falhas de OCR/IA, backlog, custo e vazamento podem passar despercebidos.
- Recomendação: erros, traces, métricas de fila, custo por provedor, alertas, runbooks, backup e teste de restauração.

### M-01 - `hoje` significa janela móvel de 24 horas

- Severidade: média.
- Impacto: UX e suporte inconsistentes com dia civil brasileiro.
- Recomendação: definir timezone de negócio e usar início/fim do dia ou renomear para `nas últimas 24 horas`.

### M-02 - Migrations sem versionamento formal

- Severidade: média.
- Impacto: startup executa DDL e não registra versão/rollback.
- Recomendação: ferramenta de migrations, tabela de versões, rollout compatível e backup antes de mudanças.

### M-03 - Swagger parcialmente desatualizado

- Severidade: média.
- Exemplos: status assíncronos e alguns formatos de resposta.
- Impacto: integrações e QA usam contrato incorreto.
- Recomendação: OpenAPI gerado/validado em CI e testes de contrato.

### M-04 - Cobertura de testes mobile insuficiente

- Severidade: média.
- Impacto: lint/typecheck não protegem fluxos e grande parte do app é JavaScript.
- Recomendação: testes unitários de datas/progresso, React Native Testing Library, Maestro/Detox e remoção gradual de `@ts-nocheck`.

### M-05 - Acessibilidade incompleta

- Severidade: média.
- Evidência: vários textos de 8-11 px, navegação por ícone e modais sem gestão completa de foco.
- Recomendação: fonte dinâmica, contraste WCAG, alvos de 48 dp, TalkBack, ordem/foco de modal e testes com movimento reduzido.

### M-06 - Exportação de conta pode exceder limites de compartilhamento

- Severidade: média.
- Impacto: JSON grande em `Share.share` pode falhar ou expor conteúdo ao app escolhido.
- Recomendação: gerar arquivo compactado temporário, explicar o destino e incluir inventário/manifesto.

### M-07 - Alertas moderados na cadeia Expo

- Severidade: média.
- Impacto: vulnerabilidade `uuid` chega por ferramenta Xcode/config-plugins.
- Recomendação: acompanhar atualização oficial do Expo SDK 57; não usar `npm audit fix --force`, que propõe downgrade incompatível.

### M-08 - Retenção depende somente da exclusão pelo usuário

- Severidade: média, LGPD.
- Recomendação: prazos por categoria, expurgo automático, legal hold documentado e evidência de deleção em backups/provedores.

### M-09 - Notificações são exclusivamente locais

- Severidade: média/produto.
- Impacto: reinstalação, troca de aparelho ou limpeza do app perde agendamentos; alterações no servidor não propagam.
- Recomendação: decidir se o produto exige push server-side; se sim, tokens, consentimento, revogação e fila de notificação.

### Bx-01 - Artefatos locais de auditoria

- Severidade: baixa.
- Onde: `tmp/pdfs/contrato-ficticio-upload.pdf` e PNG renderizado.
- Causa: o ambiente bloqueou a exclusão de binários por política de ferramenta.
- Impacto: somente sujeira local; ambos são sintéticos e não contêm dados pessoais.
- Recomendação: removê-los manualmente quando conveniente.

### Bx-02 - Projeto Android gerado localmente

- Severidade: baixa.
- Onde: `Mobile/DocVia/android/` (ignorado pelo Git).
- Causa: `expo prebuild` usado para inspecionar o manifesto e tentar o build nativo.
- Impacto: somente espaço em disco e possibilidade de confusão num projeto Expo managed.
- Recomendação: remover manualmente se a equipe não pretende manter o diretório nativo versionado; ele pode ser regenerado pelo Expo.

## Checklist Google Play

### Build e identidade

- [x] Definir `applicationId` como `br.com.docvia.app`.
- [x] Definir `versionCode` 1 e versão `1.0.0`.
- [x] Confirmar target SDK 36 no projeto Android gerado.
- [ ] Gerar AAB de produção assinado.
- [ ] Validar Play App Signing, certificado SHA-256 e deep/app links.
- [ ] Testar AAB no Internal testing em aparelhos reais.

### Privacidade e segurança

- [ ] Tornar pública a política de privacidade HTTPS já implantada e confirmar o contato.
- [ ] Tornar pública a página Web de exclusão já implantada.
- [ ] Preencher Data Safety conforme fluxos reais e SDKs.
- [ ] Aprovar DPA/subprocessadores/transferência internacional e retenção.
- [ ] Confirmar criptografia, backups e restauração.
- [ ] Fazer pentest e teste de autorização entre contas.

### Funcional

- [x] Cadastro/login/logout testados com conta fictícia.
- [x] Upload de texto e PDF testados.
- [x] Retry de PDF testado.
- [x] IA, progresso e prazos recorrentes testados.
- [x] Limites de MIME e autenticação cobertos por testes.
- [ ] Câmera, galeria, OCR de imagem e notificadores testados em Android.
- [ ] Download/compartilhamento testado em Android e navegadores-alvo.
- [ ] Recuperação com e-mail real de staging e app link testada.
- [ ] Exclusão e exportação testadas em staging com verificação no banco/storage/backups.

### Pagamentos e políticas

- [x] Decidir lançamento inicial gratuito, sem pagamentos.
- [ ] Implementar/validar compras, restauração, cancelamento e eventos server-side se houver plano pago.
- [ ] Declarar corretamente recursos jurídicos/médicos e evitar promessas de diagnóstico ou aconselhamento profissional.
- [ ] Preparar credenciais/instruções para revisão da Play Store.

### Operação

- [ ] Provisionar a produção HTTPS e o adaptador R2 privado já implementado.
- [ ] Migrations versionadas.
- [ ] Fila/worker durável.
- [ ] Rate limit compartilhado.
- [ ] Monitoramento, alertas, runbook e rollback.
- [ ] Backup e restauração ensaiados.
- [ ] Closed testing, staged rollout e canal de suporte.

## Decisões que precisam de aprovação

1. Autorizar tornar públicas as páginas legais já implantadas.
2. Criar/configurar as contas Supabase, R2, Google Cloud, e-mail e IA; segredos nunca entram no Git.
3. Confirmar DPA/plano do provedor de IA. `Exame` permanecerá desativado no lançamento.
4. Entrar no Expo/EAS para gerar e testar o AAB.
5. Autorizar limpeza de refresh tokens/registros antigos e dos dados fictícios de auditoria.

## Melhorias e ideias de produto

- Exibir evidência de cada prazo/custo/aviso com trecho e página do documento.
- Adicionar nível de confiança e uma fila `revisar antes de confiar` para extrações incertas.
- Criar conjunto dourado de documentos sintéticos e avaliação contínua de OCR/IA antes de trocar prompt/modelo.
- Redigir CPF, e-mail, telefone e outros identificadores antes do envio ao provedor de IA quando não forem necessários.
- Permitir editar/confirmar prazo detectado, registrar recorrência e sincronizar com calendário.
- Mostrar histórico de versões da análise, modelo usado e momento da confirmação do usuário.
- Criar painel de privacidade com retenção por documento e exclusão automática configurável.
- Oferecer modo de análise sem armazenamento permanente para documentos sensíveis.

## Fontes oficiais relevantes

- Requisitos de target API: https://support.google.com/googleplay/android-developer/answer/11926878
- Política de dados do usuário: https://support.google.com/googleplay/android-developer/answer/10144311
- Exclusão de conta: https://support.google.com/googleplay/android-developer/answer/13327111
- Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Pagamentos Google Play: https://support.google.com/googleplay/android-developer/answer/10281818
- Termos do Gemini API: https://ai.google.dev/gemini-api/terms
- Documentação Expo SDK 57: https://docs.expo.dev/versions/v57.0.0/
- Parser PDF atualizado: https://github.com/mehmet-kozan/pdf-parse
