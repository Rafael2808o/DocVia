# DocVia Mobile

Aplicativo Expo/React Native para leitura segura de documentos com a API DocVia.

## Executar

1. Use Node.js 22.13 ou superior (requisito do Expo SDK 57).
2. Copie `.env.example` para `.env` e defina `EXPO_PUBLIC_API_URL`.
3. Execute `npm install` e `npm run android`.

Para o emulador Android local, a URL padrão é `http://10.0.2.2:3000`. Em aparelho físico, use o IP local da máquina ou uma URL HTTPS pública.

## Configurar o backend em um só lugar

O app usa um único ponto de configuração:

- `Mobile/DocVia/.env`
- `Mobile/DocVia/src/config.ts`

No `.env`, defina:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
```

Se você mudar o backend para outro servidor, troque apenas essa URL.

### Usando Supabase

Se o backend estiver em Supabase (por exemplo, em uma Edge Function ou proxy), basta apontar o mesmo `EXPO_PUBLIC_API_URL` para o endpoint público:

```env
EXPO_PUBLIC_API_URL=https://<seu-projeto>.supabase.co/functions/v1/docvia
```

O app continuará chamando os mesmos caminhos da API:

- `/auth/login`
- `/auth/register`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/users/me`
- `/documents`
- `/documents/:id/analysis`
- etc.

Se você usar Supabase apenas como banco de dados e mantiver o backend separado, não precisa mudar o app além da URL do backend.

## Ponto único de lógica

O arquivo `Mobile/DocVia/src/api.ts` já lê essa URL e faz todas as chamadas HTTP para a API. Não há outra configuração espalhada pelo app.

## Segurança

- Tokens ficam apenas no `expo-secure-store`; documentos não são persistidos pelo aplicativo.
- A API é a autoridade de segurança. Proteção contra abuso exige rate limiting distribuído, bloqueio de conta, quotas atômicas, WAF, observabilidade, validação de arquivos e Play Integrity no backend.
- Nunca adicione chaves privadas ao `.env` do Expo: toda variável `EXPO_PUBLIC_*` pode ser lida no aplicativo.

## Arquitetura

- `App.js`: ponto de entrada e navegação do aplicativo.
- `src/pages`: telas separadas, como `Login.js`, `Register.js`, `ForgotPassword.js`, `Home.js` e `Upload.js`.
- `src/components`: componentes reutilizáveis de interface.
- `src/styles`: cores e estilos centralizados.
- `src/services`: sessão segura e cliente HTTP.
- `src/config/api.js`: único local para entender/configurar a URL da API.
- A API precisa estar com a migration `Api/migrations/003_background_privacy.sql` aplicada para jobs, privacidade e radar de prazos.

## Pendências externas

Google Play Billing, Play Integrity, FCM remoto, Supabase Storage/URLs assinadas e publicação exigem contas e credenciais reais. O app não simula pagamentos.
