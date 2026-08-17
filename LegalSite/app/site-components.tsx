import Link from "next/link";
import Image from "next/image";
import { hasPendingLegalIdentity, siteConfig } from "./site-config";

export function Brand() { return <Link href="/" className="brand" aria-label="DocVia, página inicial"><Image className="brand-icon" src="/favicon.png" alt="" aria-hidden="true" width={38} height={38} priority />DocVia</Link>; }

export function LegalShell({ children }: { children: React.ReactNode }) {
  return <div className="site"><div className="wrap"><div className="topbar"><Brand /><nav className="topnav" aria-label="Navegação principal"><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos</Link><Link href="/excluir-conta">Excluir conta</Link></nav></div>{hasPendingLegalIdentity ? <div className="pending" role="alert">Versão de preparação: informe o responsável legal e o e-mail público antes da publicação.</div> : null}{children}</div></div>;
}

export function DocumentHeader({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return <header className="document-header"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="document-lead">{lead}</p><div className="meta"><span>VERSÃO 1.0</span><span>ATUALIZADA EM {siteConfig.updatedAt.toUpperCase()}</span></div></header>;
}

export function Footer() { return <footer><div className="footer-row"><span>© 2026 DocVia · {siteConfig.controller}</span><div className="footer-links"><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos</Link><Link href="/excluir-conta">Excluir conta</Link></div></div></footer>; }
