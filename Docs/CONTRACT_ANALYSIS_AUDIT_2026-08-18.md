# Auditoria técnica da análise contratual — 18/08/2026

## Escopo e fluxo mapeado

O fluxo ativo é `POST /documents` → armazenamento privado → job de extração →
`documentTextService` (PDF/OCR/tabelas) → job de análise → provedor de IA →
normalização determinística → `documentSemanticsService` → transação de
persistência → API autenticada → projeções da análise na interface móvel.

Havia também um segundo `documentProcessingService` legado, não usado pelo
servidor, com estados e regras de cota diferentes. Ele foi removido para evitar
que voltasse a ser conectado por engano.

## Causas raiz e riscos encontrados

1. A classificação semântica usava palavras em uma janela textual ampla. Isso
   permitia que `crédito` contaminasse o total seguinte e que um termo distante
   classificasse percentuais de forma incorreta.
2. Conflito significava, na prática, apenas “dois valores diferentes”. Escopo,
   condição e período não participavam da comparabilidade.
3. A estrutura financeira era composta principalmente por rótulo e valor. Não
   havia uma representação intermediária validada nem relações de agregação.
4. Cotações cobriam somente `R$ 5,00/USD`; `5,00 BRL/USD` podia escapar da
   classificação especializada.
5. Memórias de cálculo e totais não modelavam explicitamente base, crédito e
   resultado, elevando o risco de dupla contagem.
6. Marcadores `[[TABLE]]` eram necessários internamente, mas o detalhe do
   documento devolvia o texto bruto e podia exibi-los.
7. Reanálise acrescentava análises e prazos. Embora a leitura escolhesse o item
   mais recente, dados antigos permaneciam persistidos e prazos podiam duplicar.
8. Dois jobs simultâneos podiam analisar o mesmo documento e o último commit
   sobrescrever semanticamente o primeiro.
9. A resposta JSON do provedor era apenas parseada; não havia schema formal.
10. Resumos e alertas críticos vindos da IA não possuíam proteção determinística
    suficiente contra números inventados ou regras condicionais apresentadas
    como fatos atuais.
11. O projeto Expo possuía somente distribuição Android configurada. APK é um
    formato exclusivo do Android e não pode funcionar no iPhone.

## Arquitetura depois da refatoração

Cada entidade determinística agora possui ID, tipo de dado, papel semântico,
valor normalizado, moeda/unidade, polaridade, escopo, seção, cláusula, anexo,
período, vigência relativa, recorrência, condição, proveniência, confiança e
relações. A origem tabular inclui página, tabela, linha e coluna quando presentes.

O pipeline mantém separadas as responsabilidades:

1. extração estrutural do PDF/OCR;
2. identificação lexical de valores, percentuais, cotações e datas;
3. classificação semântica por segmento e contexto estrutural;
4. resolução de escopo e período;
5. construção e validação de relações financeiras;
6. detecção de conflitos somente entre entidades comparáveis;
7. validação Zod e invariantes determinísticas;
8. projeção da mesma estrutura para custos, resumo, prazos e avisos.

## Correções implementadas

- SLA, crédito de SLA, multa, juros, desconto, reajuste, comissão, imposto,
  retenção, franquia, participação, limite e percentual condicional possuem
  papéis distintos.
- Percentual e cotação não possuem moeda de custo; invariantes rejeitam essa
  mistura.
- A polaridade é resolvida pelo segmento sintático imediatamente associado ao
  valor, não por toda a frase.
- `gross/subtotal - credit = net total` é uma relação auditável e validada.
- Preço unitário preserva quantidade, unidade, preço, subtotal e validação
  dimensional da linha.
- Fórmula cambial é isolada por seus operadores e unidades; valores vizinhos não
  entram na expressão.
- Escopos ou períodos diferentes não geram conflito automático.
- Conteúdo instrucional/ilustrativo é excluído das obrigações financeiras.
- Datas de próxima ocorrência mensal são marcadas como `DERIVED` e a UI informa
  que foram calculadas.
- Regras condicionais não são promovidas a evento crítico atual.
- Alertas críticos da IA sem evidência textual direta são rebaixados; conflitos
  críticos determinísticos exigem fonte e confiança mínima.
- Alegações numéricas do resumo sem correspondência no texto-fonte são removidas.
- JSON da IA e a análise intermediária são validados com Zod.
- Sanitização de tokens internos ocorre na API e novamente na interface.
- Reprocessamento apaga análises e prazos antigos dentro da mesma transação; o
  status `done` somente é gravado no commit final.
- Um advisory lock por documento impede duas análises simultâneas.
- URLs completas de storage deixaram de ser registradas nos logs de upload e
  extração.
- Expo recebeu bundle identifier/build number iOS, perfis EAS Android+iOS e
  comandos de build/submissão.
- O site ganhou `/baixar`, com APK Android e espaço seguro para o link
  TestFlight/App Store, sem alegar que APK funciona no iPhone.

## Testes e evidências

- API: 65 testes aprovados.
- Regressões novas: SLA, conteúdo instrucional, contaminação de polaridade,
  bruto-crédito-total, escopos distintos, períodos não sobrepostos, cotação
  BRL/USD, fronteira cambial, tokens internos, proveniência tabular, resumo sem
  evidência, alerta crítico sem evidência e 500 casos gerados de formatos
  monetários.
- Mobile: TypeScript e ESLint aprovados; Expo Doctor 21/21.
- Bundles Hermes: exportação iOS e Android aprovada (2.957 módulos em cada).
- Site: build aprovado e 7 testes aprovados, incluindo `/baixar`, aplicação web
  e transmissão ordenada das partes do APK.
- Navegador: página `/baixar` validada em desktop e viewport 390×844, sem erros
  ou avisos no console.
- Android: APK EAS assinado da versão 1.0.6 (código 7), com 90.482.160 bytes,
  estrutura ZIP Android válida (`AndroidManifest.xml`, `classes.dex` e
  `resources.arsc`) e SHA-256
  `0B1CF4A0E99E7678A01279B801EA646F5B828639C5EEB977CA09278EF15C8BF8`.
- Distribuição: página pública estável em
  `https://docvia-privacidade.pages.dev/baixar/`, aplicação web em `/app/` e APK
  permanente em `/downloads/DocVia-1.0.6.apk`. O arquivo público foi baixado
  novamente após a publicação e manteve os mesmos 90.482.160 bytes e SHA-256 do
  artefato assinado.

## Limitações e possíveis falsos positivos/negativos

- PDF não fornece uma árvore semântica universal; tabelas sem borda ou OCR muito
  degradado ainda podem perder linha/coluna ou associar cabeçalho incorretamente.
- Escopos expressos somente por linguagem implícita ou referências cruzadas muito
  longas podem permanecer `DOCUMENT` e exigir revisão humana.
- Períodos relativos complexos (“do aceite parcial até a homologação definitiva”)
  ainda não são convertidos a intervalos comparáveis sem datas dos eventos.
- Fórmulas em várias páginas, sem operadores explícitos, são preservadas como
  entidades, mas não são validadas como equação para evitar falsa memória.
- Cláusulas de prevalência são extraídas, porém a revogação automática de cada
  entidade depende de correspondência inequívoca; casos ambíguos permanecem como
  possível divergência.
- Nenhuma análise por IA é infalível. Entidades importantes mantêm fonte e
  confiança para revisão, e a interface continua exibindo o aviso profissional.
- O build iOS instalável depende de certificado e perfil da conta Apple
  Developer. O código e o bundle iOS foram validados, mas a credencial não pode
  ser criada de modo não interativo sem autenticação Apple.

## Melhorias futuras

- Persistir entidades em tabelas relacionais versionadas, além do JSON auditável.
- Adicionar parser de layout com bounding boxes para tabelas e notas de rodapé.
- Implementar grafo completo de referências cruzadas e revogação por aditivos.
- Executar corpus anonimizado de contratos reais com métricas de precisão/recall
  por papel semântico.
- Adicionar testes E2E em dispositivos físicos Android e iOS e teste de carga do
  pipeline com banco PostgreSQL de staging.
