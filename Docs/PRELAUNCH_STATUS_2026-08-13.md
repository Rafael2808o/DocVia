# Estado de pré-lançamento do DocVia — 13/08/2026

## Decisão atual

**Não pronto para publicação pública.** A aplicação e a infraestrutura gratuita estão operacionais, mas a publicação ainda depende de ações pessoais obrigatórias do proprietário: concluir a conta da Play Console e pagar a taxa única de USD 25, fornecer um endereço completo para a verificação, concluir a configuração do e-mail de recuperação e cumprir o teste fechado exigido pela Google para contas pessoais novas.

## Infraestrutura confirmada

- API: `https://docvia-api.onrender.com` (Render Free).
- Banco: Supabase Free em São Paulo, com papel exclusivo da API, SSL e Data API desativada.
- Arquivos: bucket privado do Supabase Storage via S3; downloads passam pela API autenticada.
- IA: Cloudflare Workers AI no limite gratuito, com limite global diário de 100 análises.
- Páginas legais: Cloudflare Pages, com privacidade, termos e exclusão de conta públicas.
- Pagamentos no app: desativados nesta versão.

## Evidências executadas

- API: 21/21 testes automatizados aprovados; `npm audit --omit=dev` sem vulnerabilidades.
- Mobile: TypeScript e ESLint aprovados; Expo Doctor 20/20 e dependências compatíveis com SDK 57.
- Android: AAB de produção assinado pelo EAS concluído e baixado em `Builds/DocVia-1.0.0-1.aab` (61.435.173 bytes; SHA-256 `02AC8865FB10B10E5D3EC3CEA09F1AE5BFB56EA09587A57D834C5BC3BF59211C`). A estrutura contém manifesto, DEX, quatro arquiteturas nativas e assinatura RSA.
- Android instalável: APK interno concluído e baixado em `Builds/DocVia-1.0.0-preview.apk` (90.309.536 bytes; SHA-256 `4B415E9BC39FBE98E82830EDADEDE4E1E6DE50B2772DE1854F2B515C9E64610D`). A estrutura contém manifesto, DEX e bibliotecas para ARM64, ARMv7 e x86_64. O build EAS `a3ec64c4-3c1b-48df-881e-d7512f80aa48` terminou com status `FINISHED`.
- Produção real: cadastro, login, refresh token, isolamento entre usuários, consentimento, upload privado, criação por texto, processamento assíncrono, IA, prazos, exportação e exclusão completa de conta aprovados.
- Segurança: MIME falso bloqueado; tipo sensível `exame` bloqueado; respostas privadas usam `Cache-Control: private, no-store`; rotas internas exigem segredo.
- Acessibilidade web: auditoria WCAG A/AA sem violações na tela testada após correção do indicador de carregamento.
- Teste visual: onboarding, cadastro/login, início, envio, progresso em cinco etapas, documentos, detalhe, prazos e perfil verificados em viewport 430×932.
- Evidência da correção de prazo: `Docs/TestEvidence/prazos-15-setembro.png`.
- Capturas da ficha: seis imagens em `Docs/PlayStoreAssets/screenshot-*.png`.

## Correções de maior impacto

- Progresso agora conta somente etapas concluídas, em incrementos de 20%.
- Prazo recorrente preserva a primeira data futura informada; 15/09/2026 não aparece mais como 15/08.
- Exclusão de conta remove corretamente jobs, documentos, análises e usuário.
- Consultas de jobs respeitam a propriedade do usuário.
- Respostas autenticadas não podem ser armazenadas em cache compartilhado.
- Timeout móvel tolera o cold start do Render Free.
- Build EAS não envia `.env` local e sempre usa a API HTTPS de produção.
- Indicadores de carregamento têm nome acessível.
- Pacotes oficiais do Expo atualizados para os patches recomendados do SDK 57.

## Pendências que exigem o proprietário

1. Completar o endereço do perfil de pagamentos da Google; o perfil atual foi recusado como incompleto.
2. Pagar a taxa única de USD 25 da Play Console. Nenhuma cobrança foi feita durante esta preparação.
3. Verificar identidade/telefone conforme solicitado pela Google.
4. Manter pelo menos 12 testadores inscritos no teste fechado por 14 dias contínuos e depois pedir acesso à produção.
5. Instalar e testar o APK de preview em aparelhos Android físicos antes de promover o AAB para produção.
6. Informar/confirmar o endereço comercial completo no provedor gratuito de e-mail para concluir a ativação da recuperação de senha.

## Riscos restantes

- Render Free entra em suspensão e a primeira requisição pode demorar dezenas de segundos.
- Supabase Free pode pausar por inatividade e possui limites de armazenamento/banco.
- O limite gratuito da IA pode ser atingido; a API bloqueia novas análises em vez de gerar cobrança.
- O `npm audit` do app móvel ainda reporta avisos transitivos em ferramentas Expo/Metro. O Expo Doctor passa 20/20; as correções sugeridas pelo npm fariam downgrade incompatível, portanto não foram aplicadas.
- Resumos de IA podem reproduzir trechos em vez de condensá-los; o aviso de limitação continua visível e conteúdo importante deve ser conferido no documento original.

## Recuperação de senha

- Senha de app exclusiva `DocVia API Render` criada na Conta Google com autenticação em duas etapas.
- Credencial SMTP salva como segredo no Render e nunca adicionada ao repositório.
- Autenticação SMTP foi validada localmente, e o fluxo `/auth/forgot-password` respondeu 202 sem revelar se o endereço existe.
- O envio em produção **não foi concluído**: o [Render Free bloqueia oficialmente as portas SMTP 25, 465 e 587](https://render.com/docs/free). Os logs confirmaram `ENETUNREACH`/`ETIMEDOUT`, e nenhum e-mail chegou à caixa de entrada.
- Gmail API foi ativada no projeto Google Cloud e um cliente OAuth de teste foi criado, mas a última autorização da conta foi bloqueada pela política de segurança do navegador automatizado e não foi contornada.
- O backend já possui transporte HTTPS para Brevo e Resend. O caminho gratuito viável é concluir a conta Brevo, gerar uma chave e configurar `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY` e o remetente no Render.
- As contas temporárias usadas nos ensaios de SMTP foram removidas após os testes.

## Conta fictícia para revisão

A conta de revisão foi criada diretamente em produção, com um contrato totalmente fictício. As credenciais não ficam versionadas no Git e devem ser inseridas apenas no campo **Acesso ao app** da Play Console.
