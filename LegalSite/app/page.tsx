import Link from "next/link";
import { Brand, Footer, LegalShell } from "./site-components";

export const metadata = {
  title: "DocVia | Privacidade e suporte",
  description: "Central pública de privacidade, termos e exclusão de conta do DocVia.",
};

export default function Home() {
  return (
    <LegalShell>
      <header className="hero">
        <Brand />
        <div className="hero-copy">
          <span className="eyebrow">CENTRAL DE TRANSPARÊNCIA</span>
          <h1>Seus documentos.<br /><em>Suas escolhas.</em></h1>
          <p>Entenda como o DocVia trata seus dados e encontre caminhos diretos para exercer seus direitos.</p>
        </div>
      </header>
      <main className="cards" aria-label="Documentos e controles">
        <Link className="nav-card" href="/privacidade"><span>01</span><h2>Política de Privacidade</h2><p>Dados coletados, finalidades, fornecedores, segurança e seus direitos.</p><b>Consultar →</b></Link>
        <Link className="nav-card" href="/termos"><span>02</span><h2>Termos de Uso</h2><p>Regras do serviço, limites da inteligência artificial e responsabilidades.</p><b>Consultar →</b></Link>
        <Link className="nav-card accent" href="/excluir-conta"><span>03</span><h2>Excluir conta e dados</h2><p>Exclusão pelo aplicativo ou solicitação pelo canal de privacidade.</p><b>Solicitar →</b></Link>
      </main>
      <Footer />
    </LegalShell>
  );
}
