# Prompt de Direção de Produto e Interface — DocVia

Use o texto abaixo como briefing para uma IA de design, uma pessoa de produto ou uma implementação de interface. Ele foi escrito a partir de princípios observados no Notion — hierarquia, foco e composição modular — e no Google Keep — captura rápida, organização leve e lembretes. A referência é funcional; não copie marcas, layouts, nomes, ícones ou elementos proprietários desses produtos.

---

## Prompt

Atue como um **Product Designer sênior especializado em aplicativos móveis de alta confiança**. Redesenhe e evolua o **DocVia**, um aplicativo brasileiro para organizar documentos pessoais, entender informações relevantes com apoio de IA e não perder prazos.

### Objetivo do produto

Transformar documentos confusos — contratos, boletos, exames, termos e arquivos pessoais — em uma experiência clara, tranquila e acionável. A pessoa usuária deve conseguir adicionar um documento em segundos, compreender o que importa e saber se existe uma ação ou prazo pendente.

### Público e contexto

- Pessoas no Brasil que acumulam documentos digitais e não querem depender de pastas, e-mails ou anotações soltas.
- Usuários podem estar ansiosos, com pressa ou sem familiaridade jurídica ou técnica.
- O aplicativo lida com informações potencialmente sensíveis; confiança e clareza são mais importantes que efeitos visuais chamativos.

### Direção visual

- Crie uma identidade própria para o DocVia: contemporânea, sóbria, acolhedora e precisa.
- Use interface escura como base, com superfícies em camadas sutis, excelente contraste e uma cor de destaque azul-petróleo para ações primárias e estados de confiança.
- Priorize tipografia legível, espaçamento generoso, ícones simples e microinterações discretas.
- Não use gradientes excessivos, cards genéricos em excesso, sombras pesadas, vidro decorativo, excesso de bordas ou linguagem visual de fintech genérica.
- Use cor como apoio semântico: atenção para prazos próximos, sucesso para ações concluídas, neutro para informações arquivadas. Nunca dependa apenas de cor para comunicar estado.

### Ícone e identidade visual

Crie um ícone original para o DocVia que comunique **clareza sobre documentos**, **organização** e **confiança**, sem recorrer aos clichês de pasta, folha A4, scanner, lupa, cérebro, cadeado ou escudo literal.

- Desenvolva um símbolo proprietário, geométrico e memorável, baseado na ideia de uma informação complexa que se torna clara e organizada.
- O ícone deve funcionar sozinho em tamanhos pequenos, especialmente no ícone de aplicativo Android, sem depender do nome da marca, letras minúsculas ou detalhes finos.
- Use uma composição simples, com poucos elementos, contraste alto e formas bem definidas. Prefira uma marca sólida, com acabamento vetorial e intenção de design editorial.
- A paleta deve partir do fundo profundo do DocVia e do azul-petróleo da marca, podendo incluir um único tom claro de apoio. Evite arco-íris, brilho plástico, neon, 3D, mockup de celular, reflexos, sombras artificiais, excesso de textura e estética futurista genérica.
- Não gere texto dentro da imagem. Não use marcas, símbolos ou referências reconhecíveis de Notion, Google Keep, Google Drive, Apple Files, Adobe Scan ou concorrentes.
- A imagem final precisa parecer um ícone criado por uma marca de produto madura: limpo, único, intencional e pronto para exportação como PNG quadrado e ícone adaptativo.

**Prompt específico para gerar o ícone:**

> Crie um ícone de aplicativo premium e original para “DocVia”, um aplicativo brasileiro de organização inteligente de documentos. Desenvolva um símbolo abstrato e geométrico que sugira clareza, estrutura e orientação, como camadas de informação se alinhando em um caminho visual simples. Use fundo quase preto com azul-petróleo sofisticado e um único acento claro discreto. Estilo de identidade visual editorial e tecnológico, vetorial, minimalista, alto contraste, formas robustas, sem texto, sem letras, sem pasta, sem folha de papel literal, sem scanner, sem lupa, sem escudo, sem cérebro, sem cadeado, sem gradiente chamativo, sem brilho, sem 3D, sem mockup. O resultado deve parecer criado por uma equipe de branding experiente para um produto confiável e moderno, ser reconhecível em 48×48 pixels e ter composição centralizada em formato quadrado.

### Princípios de experiência

1. **Captura sem atrito:** o botão principal deve permitir câmera, galeria, arquivo ou texto manual em no máximo uma decisão adicional.
2. **Entendimento antes de complexidade:** depois do processamento, mostre primeiro um resumo objetivo, os pontos importantes e as ações sugeridas; detalhes técnicos ficam progressivamente disponíveis.
3. **Organização leve:** permita tipos de documento, etiquetas, favoritos, busca e filtros sem transformar o produto em um gerenciador burocrático.
4. **Prazos acionáveis:** apresente uma linha do tempo clara, destaque o que exige atenção e permita concluir, adiar ou abrir o documento relacionado.
5. **Confiança explícita:** explique com linguagem humana quando um documento está sendo processado, quando a análise é assistida por IA e quais dados permanecem privados.
6. **Controle da pessoa usuária:** ofereça histórico, exportação e exclusão de dados de forma visível e compreensível.

### Arquitetura de informação

Projete as seguintes áreas:

- **Início:** visão de hoje com saudação discreta, ação principal de adicionar documento, prazos próximos, documentos recentes e um estado vazio útil.
- **Documentos:** busca persistente, filtros por tipo, status e prazo; lista com leitura rápida e opção de grade somente se ela trouxer benefício real.
- **Adicionar documento:** fluxo curto com captura, seleção de tipo opcional, confirmação de privacidade e feedback de processamento.
- **Detalhe do documento:** título, origem, status, resumo de IA, pontos importantes, dados estruturados quando disponíveis, prazo, arquivo original e ações seguras.
- **Prazos:** calendário ou lista temporal de fácil leitura, agrupada por urgência; ações de concluir, adiar e abrir contexto.
- **Perfil e privacidade:** conta, preferências de notificação, política de privacidade, exportação de dados, exclusão de conta e sair.

### Estados obrigatórios

Desenhe estados completos, não apenas a tela ideal:

- Carregamento com contexto do que está acontecendo.
- Documento em fila, processando, concluído e com falha recuperável.
- Sem documentos, sem resultados de busca e sem prazos próximos.
- Erros de rede, permissão de câmera negada e sessão expirada.
- Acesso de recuperação de senha por link.
- Feedback de sucesso com próxima ação clara, sem pop-ups desnecessários.

### Interações e comportamento

- Navegação inferior simples com, no máximo, cinco destinos principais.
- Ação de adicionar documento sempre acessível, porém sem cobrir conteúdo importante.
- Busca rápida, filtros fáceis de remover e ordenação compreensível.
- Gestos apenas como atalhos: toda ação importante deve ter alternativa visível e acessível.
- Use confirmação apenas para ações destrutivas ou difíceis de reverter.
- Preserve contexto ao voltar de detalhes, filtros e fluxos de upload.
- **Não alterar a barra de navegação atual do aplicativo.** Preserve integralmente sua estrutura, posição, comportamento, itens e interação; qualquer evolução visual deve acontecer no conteúdo das telas e nos componentes fora dela.

### Acessibilidade e qualidade

- Alvos de toque confortáveis, contraste compatível com WCAG AA e texto escalável.
- Rótulos claros para leitores de tela; ícones nunca podem ser a única explicação de uma ação.
- Português do Brasil consistente, direto e sem capitalização desnecessária.
- Datas, moedas e prazos devem seguir convenções brasileiras.
- Trate documentos e resultados de IA como conteúdo sensível: não exponha dados em notificações ou prévias sem consentimento.

### Entregáveis esperados

1. Mapa de navegação do aplicativo.
2. Design system compacto: cores, tipografia, espaçamento, componentes, ícones e estados.
3. Wireframes de baixa fidelidade para todos os fluxos principais.
4. Protótipo de alta fidelidade para Início, Documentos, Adicionar documento, Detalhe, Prazos e Perfil.
5. Especificação de comportamento para carregamento, erro, vazio e sucesso.
6. Checklist de acessibilidade e privacidade.

### Critério de sucesso

Em menos de um minuto, uma pessoa deve conseguir adicionar um documento, entender o status do processamento e perceber claramente onde encontrará os pontos importantes e os próximos prazos. A interface deve parecer confiável e calma, nunca complexa ou alarmista.
