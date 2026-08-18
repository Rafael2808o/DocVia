import { Footer, LegalShell } from "../site-components";

export const metadata = {
  title: "Baixar DocVia | Android e iPhone",
  description: "Links oficiais de instalação do DocVia para Android e iPhone.",
};

const androidUrl = process.env.NEXT_PUBLIC_ANDROID_INSTALL_URL || "https://expo.dev/artifacts/eas/vAwFSlSdD1fOeac_PmmrLlp9UDXsL25YjQwRGUI1mx8.apk";
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
        <section className="download-grid" aria-label="Opções de instalação">
          <article className="action-box">
            <h2>Android</h2>
            <p>Versão 1.0.6 (código 7), assinada pelo Expo EAS.</p>
            <a className="button" href={androidUrl} rel="noreferrer">Baixar APK para Android</a>
          </article>
          <article className="action-box">
            <h2>iPhone e iPad</h2>
            <p>Instalação pela distribuição oficial da Apple. APK não é compatível com iOS.</p>
            {iosUrl ? <a className="button" href={iosUrl} rel="noreferrer">Abrir no TestFlight</a> : <span className="button disabled-link" aria-disabled="true">TestFlight em preparação</span>}
          </article>
        </section>
        <div className="notice">Não instale arquivos enviados por terceiros. No iPhone, use somente TestFlight ou App Store. O endereço direto do APK é temporário; esta página será mantida como o ponto oficial de download.</div>
      </main>
      <Footer />
    </LegalShell>
  );
}
