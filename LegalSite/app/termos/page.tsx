import { DocumentHeader, Footer, LegalShell } from "../site-components";
import { siteConfig } from "../site-config";

export const metadata = { title: "Termos de Uso" };

export default function Terms() {
  return <LegalShell><main className="document"><DocumentHeader eyebrow="TERMOS" title="Termos de Uso" lead="Estas regras descrevem o funcionamento do DocVia e os cuidados necessários ao utilizar análises automatizadas de documentos." />
    <div className="legal-grid"><aside className="side"><strong>Operador do serviço</strong>{siteConfig.controller}<br />Contato: {siteConfig.email}</aside><article className="copy">
      <section><h2>1. Aceitação e elegibilidade</h2><p>Ao criar uma conta ou usar o DocVia, você concorda com estes termos e com a Política de Privacidade. O serviço é destinado a maiores de 18 anos.</p></section>
      <section><h2>2. O que o DocVia oferece</h2><p>O DocVia recebe arquivos ou textos, extrai conteúdo, gera resumos informativos, identifica possíveis prazos, valores, alertas e permite organizar os resultados. Recursos podem ser alterados para melhorar segurança, qualidade ou conformidade.</p></section>
      <section><h2>3. Limites da análise</h2><div className="notice"><strong>O DocVia não presta consultoria jurídica, financeira, contábil ou médica.</strong> Resultados automatizados podem conter erros, interpretações incompletas ou prazos incorretos. Confira sempre o documento original e procure um profissional qualificado antes de tomar decisões relevantes.</div></section>
      <section><h2>4. Responsabilidades do usuário</h2><ul><li>enviar somente documentos que você tenha autorização para tratar;</li><li>não enviar conteúdo ilegal, malicioso ou que viole direitos de terceiros;</li><li>conferir a exatidão dos resultados e dos prazos;</li><li>proteger senha e aparelho e informar suspeitas de acesso indevido;</li><li>manter dados cadastrais corretos.</li></ul></section>
      <section><h2>5. Uso proibido</h2><p>É proibido tentar contornar limites, explorar vulnerabilidades, automatizar abuso, interferir no serviço, acessar dados de terceiros ou utilizar os resultados para fraude, discriminação ou atividade ilegal.</p></section>
      <section><h2>6. Disponibilidade e conta gratuita</h2><p>A versão inicial é gratuita e possui limites de uso. Serviços de infraestrutura podem sofrer indisponibilidade, manutenção ou limitações. Não há promessa de disponibilidade ininterrupta.</p></section>
      <section><h2>7. Propriedade intelectual</h2><p>Você mantém os direitos sobre os documentos enviados. Concede ao DocVia apenas a autorização necessária para processá-los e entregar o serviço solicitado. O aplicativo, marca, interface e tecnologia permanecem protegidos por seus respectivos direitos.</p></section>
      <section><h2>8. Suspensão e encerramento</h2><p>Contas podem ser limitadas ou suspensas em caso de abuso, risco de segurança ou violação destes termos. Você pode excluir sua conta e dados a qualquer momento pelo aplicativo ou pelo canal indicado na página de exclusão.</p></section>
      <section><h2>9. Lei aplicável e contato</h2><p>Aplicam-se as leis brasileiras, incluindo o Código de Defesa do Consumidor quando cabível e a LGPD. Contato: <strong>{siteConfig.email}</strong>.</p></section>
    </article></div></main><Footer /></LegalShell>;
}
