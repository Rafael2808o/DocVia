/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- A exportação estática exige navegação nativa e assets diretos. */
import { hasPendingLegalIdentity, siteConfig } from "./site-config";

export function Brand() {
  return <a href="/" className="brand" aria-label="DocVia, página inicial"><img className="brand-icon" src="/favicon.png" alt="" aria-hidden="true" width="38" height="38" />DocVia</a>;
}

export function LegalShell({ children }: { children: React.ReactNode }) {
  return <div className="site"><div className="wrap"><div className="topbar"><Brand /><nav className="topnav" aria-label="Navegação principal"><a href="/baixar/">Baixar</a><a href="/privacidade/">Privacidade</a><a href="/termos/">Termos</a><a href="/excluir-conta/">Excluir conta</a></nav></div>{hasPendingLegalIdentity ? <div className="pending" role="alert">Versão de preparação: informe o responsável legal e o e-mail público antes da publicação.</div> : null}{children}</div></div>;
}

export function DocumentHeader({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return <header className="document-header"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="document-lead">{lead}</p><div className="meta"><span>VERSÃO 1.0</span><span>ATUALIZADA EM {siteConfig.updatedAt.toUpperCase()}</span></div></header>;
}

export function Footer() { return <footer><div className="footer-row"><span>© 2026 DocVia · {siteConfig.controller}</span><div className="footer-links"><a href="/baixar/">Baixar</a><a href="/privacidade/">Privacidade</a><a href="/termos/">Termos</a><a href="/excluir-conta/">Excluir conta</a></div></div></footer>; }
