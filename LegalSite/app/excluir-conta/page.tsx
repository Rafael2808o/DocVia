import { DocumentHeader, Footer, LegalShell } from "../site-components";
import { siteConfig } from "../site-config";

export const metadata = { title: "Excluir conta e dados" };

export default function DeleteAccount() {
  const subject = encodeURIComponent("Solicitação de exclusão de conta DocVia");
  const body = encodeURIComponent("Olá, solicito a exclusão da minha conta DocVia. O e-mail cadastrado é: [INFORME AQUI]. Não enviarei minha senha por e-mail.");
  return <LegalShell><main className="document"><DocumentHeader eyebrow="CONTROLE DE DADOS" title="Excluir conta e dados" lead="Você pode apagar sua conta pelo próprio aplicativo. Se não conseguir entrar, use o canal de privacidade abaixo." />
    <div className="legal-grid"><aside className="side"><strong>Prazo de atendimento</strong>Confirmaremos o recebimento e poderemos pedir uma verificação segura de identidade.</aside><article className="copy">
      <section><h2>Exclusão dentro do aplicativo</h2><ol><li>Entre na sua conta DocVia.</li><li>Abra <strong>Perfil</strong>.</li><li>Toque em <strong>Excluir conta</strong>.</li><li>Digite sua senha atual e confirme.</li></ol><p>A exclusão remove a conta, documentos, textos extraídos, análises, prazos, histórico de uso e tokens de sessão associados.</p></section>
      <section><h2>Não consegue acessar o app?</h2><div className="action-box"><h3>Solicite pelo canal de privacidade</h3><p>Envie a solicitação a partir do e-mail cadastrado. Nunca envie sua senha, documentos ou chaves de acesso.</p><a className="button" href={`mailto:${siteConfig.email}?subject=${subject}&body=${body}`}>Solicitar por e-mail</a></div><p>E-mail: <strong>{siteConfig.email}</strong>.</p></section>
      <section><h2>O que pode ser retido</h2><p>Dados podem permanecer por prazo limitado em cópias de segurança protegidas ou quando a retenção for estritamente necessária para cumprir lei, exercer direitos ou prevenir fraude. Nesse período, o uso fica restrito a essas finalidades.</p></section>
      <section><h2>Exclusão de um documento</h2><p>Se quiser manter sua conta e excluir apenas um arquivo, abra o documento no aplicativo e use a opção de exclusão. A análise e os prazos associados também serão removidos.</p></section>
    </article></div></main><Footer /></LegalShell>;
}
