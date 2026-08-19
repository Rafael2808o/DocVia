# DocVia

**Organize documentos, compreenda informações importantes e acompanhe prazos em um só lugar.**

O DocVia é um aplicativo móvel para pessoas que querem lidar com documentos do dia a dia com mais clareza e menos preocupação. O produto permite enviar ou digitalizar arquivos, extrair texto, obter análises assistidas por IA e acompanhar prazos relevantes, como vencimentos de boletos.

## Teste o projeto

**[Abrir a central pública do DocVia](https://docvia-privacidade.pages.dev/baixar/)**

- **iPhone, iPad, Android ou computador:** abra a versão web diretamente pelo navegador, sem instalação.
- **Android:** baixe o APK 1.0.6 assinado, hospedado de forma permanente no portal.
- **iOS nativo:** preparado para TestFlight; a emissão depende das credenciais Apple Developer do titular.

O portal reúne as opções de teste, a política de privacidade, os termos de uso e a exclusão de conta em um endereço estável para demonstrações acadêmicas e avaliação do projeto.

## Principais recursos

- Cadastro, login e sessão segura com tokens de acesso e renovação.
- Recuperação de senha por e-mail, integrada ao provedor transacional configurado.
- Upload ou captura de PDFs e imagens de documentos.
- Extração de texto de PDFs e OCR para imagens.
- Análise assistida por IA para destacar informações importantes.
- Resumo de contratos e leitura de dados de boletos.
- Histórico de documentos e detalhes de cada item.
- Radar de prazos e notificações locais.
- Exportação e exclusão de dados da conta.
- Política de privacidade acessível dentro do aplicativo.

## Princípios do produto

O DocVia foi pensado para documentos pessoais e, por isso, prioriza:

- **Clareza:** linguagem simples, hierarquia visual e informações acionáveis.
- **Confiança:** dados sensíveis não devem ser expostos em telas, logs ou repositórios.
- **Velocidade:** o caminho entre adicionar um documento e entender o que importa deve ser curto.
- **Controle:** a pessoa usuária mantém acesso ao histórico, à exportação e à exclusão de seus dados.

## Arquitetura

```text
DocVia/
├── Api/                 API REST em Node.js e Express
├── Mobile/DocVia/       Aplicativo Expo e React Native
├── LegalSite/           Páginas institucionais e legais
├── Docs/                Documentação técnica, operação e publicação
├── Builds/               Artefatos locais de build
└── render.yaml          Configuração de serviço no Render
```

### Tecnologias principais

| Camada        | Tecnologias                                      |
| ------------- | ------------------------------------------------ |
| Aplicativo    | Expo, React Native, TypeScript, Expo SecureStore |
| API           | Node.js, Express, Zod, JWT, PostgreSQL           |
| Documentos    | Multer, PDF parsing, Tesseract OCR               |
| IA            | Gemini, OpenAI ou Cloudflare Workers AI          |
| Armazenamento | Local no desenvolvimento; R2 ou S3 em produção   |
| E-mail        | Brevo, Resend ou SMTP                            |
| Qualidade     | Node Test Runner, ESLint, Prettier e Expo Doctor |

## Comece localmente

Use o Node.js 22 LTS para atender aos requisitos do aplicativo e da API.

### API

```bash
cd Api
npm install
```

Crie `Api/.env` com a conexão PostgreSQL, um `JWT_SECRET` de 32 ou mais caracteres e a credencial do provedor de IA selecionado.

```bash
npm start
npm test
```

A API local é iniciada, por padrão, em `http://localhost:3000`. A documentação interativa fica disponível em `/docs`.

### Aplicativo móvel

```bash
cd Mobile/DocVia
npm install
```

Crie `Mobile/DocVia/.env` e informe a URL da API:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
```

Use `10.0.2.2` no emulador Android. Em um aparelho físico, informe o IP local da máquina ou uma URL HTTPS pública.

```bash
npm run android
# ou
npm start
```

Validações disponíveis:

```bash
npm run typecheck
npm run lint
npm run format:check
```

## Configuração de produção

Em produção, a API exige HTTPS, origens CORS restritas, armazenamento privado de objetos e credenciais reais para os serviços usados. Consulte:

- [Guia de publicação da API](Api/deploy/README.md)
- [Guia do aplicativo móvel](Mobile/DocVia/README.md)
- [Guia de produção com Supabase](Docs/SUPABASE_PRODUCTION.md)

Nunca inclua chaves, senhas, tokens ou arquivos `.env` no Git.

### E-mail transacional

O cadastro valida a sintaxe, rejeita provedores descartáveis conhecidos e exige que o domínio publique servidores MX capazes de receber mensagens. A conta entra imediatamente após o cadastro; a confirmação por link não bloqueia o acesso. Essa validação confirma o domínio, mas somente o envio de uma mensagem pode comprovar que uma caixa postal específica existe e pertence à pessoa.

A recuperação de senha continua exigindo um provedor transacional aprovado (Brevo, Resend ou SMTP). Sem ele, o sistema registra a solicitação de forma segura, mas não há como entregar o link de redefinição ao usuário.

## Endpoints principais

| Área         | Endpoints                                                             |
| ------------ | --------------------------------------------------------------------- |
| Autenticação | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` |
| Recuperação  | `POST /auth/forgot-password`, `/auth/reset-password`                  |
| Verificação   | `POST /auth/verify-email`, `/auth/resend-verification`                |
| Conta        | `GET /users/me`, `GET /users/me/export`, `DELETE /users/me`           |
| Documentos   | `POST /documents`, `GET /documents`, `GET /documents/:id`             |
| Análises     | `POST /analyses/:id/analyze`, `GET /analyses/:id/analysis`            |
| Prazos       | `GET /documents/deadlines/upcoming`                                   |
| Saúde        | `GET /health/live`, `GET /health/ready`                               |

Consulte `/docs` na API em execução para o contrato completo.

## Segurança e privacidade

- Tokens do aplicativo são mantidos no armazenamento seguro do dispositivo.
- A API aplica validação de entrada, autenticação, limite de requisições e bloqueio temporário após tentativas de login excessivas.
- Os documentos devem usar armazenamento privado e URLs autenticadas em produção.
- Antes de processar documentos reais com IA, confirme as condições de privacidade e retenção do provedor escolhido.

## Estado do projeto

O repositório usa a branch `master` como fonte única de desenvolvimento. As funcionalidades de aplicativo e API são verificadas localmente; publicação em loja, faturamento real, integridade do dispositivo e notificações remotas dependem de contas e credenciais externas.

## Contribuição

1. Crie uma branch a partir de `master`.
2. Faça mudanças pequenas e objetivas.
3. Execute os testes e validações relacionados à sua alteração.
4. Não envie segredos, builds locais ou arquivos de configuração privada.
5. Abra uma revisão descrevendo o problema, a solução e como ela foi testada.

## Licença

Consulte os arquivos de licença existentes em cada componente do repositório antes de redistribuir ou reutilizar o projeto.
