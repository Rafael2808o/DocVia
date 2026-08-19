import { Footer, LegalShell } from "../site-components";

export const metadata = {
  title: "Baixar DocVia | Android e iPhone",
  description: "Links oficiais de instalação do DocVia para Android e iPhone.",
};

const androidUrl = process.env.NEXT_PUBLIC_ANDROID_INSTALL_URL || "/downloads/DocVia-1.0.6.apk";
const iosUrl = process.env.NEXT_PUBLIC_IOS_INSTALL_URL || "";

export default function DownloadPage() {
  return (
    <LegalShell>
      <main className="document">
        <header className="document-header">
          <span className="eyebrow">INSTALAÇÃO OFICIAL</span>
          <h1>Baixe o <em>DocVia.</em></h1>
          <p className="document-lead">Escolha o sistema do aparelho. O aplicativo e a conta são os mesmos; apenas o formato de instalação muda.</p>
        </header>
        <section className="download-grid three-options" aria-label="Opções para usar o DocVia">
          <article className="action-box featured-option">
            <span className="option-label">QUALQUER APARELHO</span>
            <h2>Abrir no navegador</h2>
            <p>Funciona pelo Safari, Chrome ou computador, sem instalar nada.</p>
            <a className="button" href="/app/">Usar o DocVia agora</a>
          </article>
          <article className="action-box">
            <span className="option-label">INSTALAÇÃO</span>
            <h2>Android</h2>
            <p>Versão 1.0.6 (código 7), assinada pelo Expo EAS.</p>
            <a className="button" href={androidUrl} rel="noreferrer">Baixar APK para Android</a>
          </article>
          <article className="action-box">
            <span className="option-label">APPLE</span>
            <h2>iPhone e iPad</h2>
            <p>Use agora pelo navegador. A instalação nativa será liberada exclusivamente pelo TestFlight.</p>
            <a className="button secondary standalone" href="/app/">Abrir versão web</a>
            {iosUrl ? <a className="button" href={iosUrl} rel="noreferrer">Abrir no TestFlight</a> : <span className="button disabled-link" aria-disabled="true">TestFlight em preparação</span>}
          </article>
        </section>
        <div className="notice"><strong>Para enviar ao professor:</strong> compartilhe somente o endereço desta página. No iPhone/iPad ele pode abrir a versão web sem instalar nada; no Android pode escolher entre a versão web e o APK permanente. APK não é compatível com iOS.</div>
      </main>
      <Footer />
    </LegalShell>
  );
}
