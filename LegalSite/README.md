# DocVia — páginas públicas

Central pública necessária para o lançamento do DocVia na Google Play:

- política de privacidade;
- termos de uso;
- instruções e canal para exclusão de conta.

Produção: [docvia-privacidade.pages.dev](https://docvia-privacidade.pages.dev)

A identidade acompanha o aplicativo: ícone em fita `d/v`, azul-petróleo `#147D92`, turquesa `#62D4C7` e fundo `#071316`.

## Desenvolvimento

Requer Node.js 22.13 ou superior.

```bash
npm ci
npm run dev
npm test
```

Nome do controlador e e-mail de privacidade podem ser substituídos pelas variáveis documentadas em `.env.example`.

O link único `/baixar/` usa `NEXT_PUBLIC_ANDROID_INSTALL_URL` para o APK/EAS e
`NEXT_PUBLIC_IOS_INSTALL_URL` para o TestFlight/App Store. O botão iOS permanece
desabilitado até existir uma build válida da Apple, evitando prometer um APK
incompatível a usuários de iPhone.

## Publicação

```bash
npm run build:pages
npx wrangler pages deploy dist-pages --project-name docvia-privacidade --branch main
```
