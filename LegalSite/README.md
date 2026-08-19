# DocVia — páginas públicas

Central pública de demonstração e lançamento do DocVia:

- versão web para Safari, Chrome e computadores;
- download permanente do APK Android assinado;
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

O link único `/baixar/` oferece a aplicação web em `/app/`, o APK permanente em
`/downloads/DocVia-1.0.6.apk` e usa `NEXT_PUBLIC_IOS_INSTALL_URL` para um futuro
TestFlight/App Store. Como o Pages limita cada arquivo a 25 MiB, o build empacota
o APK validado em quatro partes e um Worker as transmite sequencialmente. O
SHA-256 é conferido antes de cada publicação.

Antes do build do portal, exporte o aplicativo web de produção:

```powershell
cd ..\Mobile\DocVia
$env:EAS_BUILD_PROFILE='production'
$env:EXPO_PUBLIC_API_URL='https://docvia-api.onrender.com'
npx expo export --platform web --output-dir dist-web-release
```

## Publicação

```bash
npm test
npx wrangler pages deploy dist-pages --project-name docvia-privacidade --branch main
```
