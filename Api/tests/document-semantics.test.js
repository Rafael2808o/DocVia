import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAiResult } from '../src/services/aiAnalysisV2Service.js';
import { analyzeDocumentSemantics, extractImplementationTerms, parseBrazilianMoney } from '../src/services/documentSemanticsService.js';

const complexContract = `
CLÁUSULA 3.1 — PREÇOS
Mensalidade contratual: R$ 2.500,00. Implantação: R$ 3.400,00.
Serviço adicional: R$ 187,50 por hora. Armazenamento: R$ 90,00 por TB.
Crédito SLA: R$ 410,00. Em caso de atraso, multa de 2% e juros de 1% ao mês, com atualização pelo IPCA.
CLÁUSULA 8.1 — RESCISÃO
O aviso prévio geral será de 30 dias.
CLÁUSULA 8.2 — EXCEÇÃO
Exceto para o módulo P1, o aviso prévio será de 60 dias.
ANEXO II — PREÇOS ATUALIZADOS
Mensalidade contratual: R$ 2.650,00.
A vigência inicia em 01/09/2026. O início do faturamento será em 15/08/2026.
A implantação ocorrerá em até 75 dias úteis após assinatura em 20/08/2026.
`;

test('separa dinheiro, percentual, taxa e índice sem converter 2% em R$ 2', () => {
  const result = analyzeDocumentSemantics(complexContract, { summary: 'Contrato de tecnologia.' }, 'contrato');
  assert.equal(result.financial_items.find((item) => item.type === 'PENALTY_RATE')?.display_value, '2%');
  assert.equal(result.financial_items.find((item) => item.type === 'INTEREST_RATE')?.display_value, '1% ao mês');
  assert.equal(result.financial_items.find((item) => item.type === 'INDEX')?.value, 'IPCA');
  assert.equal(result.financial_items.some((item) => item.currency === 'BRL' && item.value === 2), false);
});

test('preserva crédito como impacto negativo mesmo quando o texto não usa sinal', () => {
  const credit = analyzeDocumentSemantics(complexContract, { summary: 'Resumo.' }, 'contrato').financial_items.find((item) => item.type === 'CREDIT');
  assert.equal(credit.value, -410);
  assert.equal(credit.effect, 'DECREASE');
  assert.match(credit.display_value, /410,00/);
});

test('preserva valores negativos explícitos e formato contábil', () => {
  assert.equal(parseBrazilianMoney('- R$ 862,50'), -862.5);
  assert.equal(parseBrazilianMoney('(R$ 1.200,00)'), -1200);
  assert.equal(parseBrazilianMoney('2%'), null);
});

test('mantém unidade de preço por hora e por terabyte', () => {
  const items = analyzeDocumentSemantics(complexContract, { summary: 'Resumo.' }, 'contrato').financial_items;
  assert.equal(items.find((item) => item.value === 187.5)?.unit, 'HOUR');
  assert.equal(items.find((item) => item.value === 90)?.unit, 'TERABYTE');
});

test('detecta divergência financeira e guarda a origem dos dois valores', () => {
  const conflict = analyzeDocumentSemantics(complexContract, { summary: 'Resumo.' }, 'contrato').conflicts.find((item) => item.type === 'VALUE_CONFLICT');
  assert.equal(conflict.subject, 'Mensalidade contratual');
  assert.deepEqual(conflict.values.map((item) => item.value), [2500, 2650]);
  assert.ok(conflict.values.every((item) => Number.isInteger(item.source.position)));
});

test('classifica prazo geral e exceção específica sem apagar nenhum deles', () => {
  const result = analyzeDocumentSemantics(complexContract, { summary: 'Resumo.' }, 'contrato');
  assert.deepEqual(result.deadline_rules.map((item) => item.duration), [30, 60]);
  assert.deepEqual(result.deadline_rules.map((item) => item.type), ['GENERAL_RULE', 'SPECIFIC_RULE']);
  assert.equal(result.conflicts.some((item) => item.type === 'POSSIBLE_EXCEPTION'), true);
});

test('não transforma duração de implantação na data da assinatura', () => {
  assert.deepEqual(extractImplementationTerms(complexContract), {
    type: 'IMPLEMENTATION_DEADLINE', duration: 75, duration_unit: 'BUSINESS_DAY',
    base_date: '2026-08-20', calculated_date: null,
    description: 'Implantação em até 75 dias úteis após 20/08/2026', confidence: 0.97,
  });
});

test('classifica datas diferentes pela função sem tratá-las como equivalentes', () => {
  const dates = analyzeDocumentSemantics(complexContract, { summary: 'Resumo.' }, 'contrato').dates;
  assert.equal(dates.some((item) => item.type === 'EFFECTIVE_DATE' && item.value === '2026-09-01'), true);
  assert.equal(dates.some((item) => item.type === 'BILLING_START_DATE' && item.value === '2026-08-15'), true);
  assert.equal(dates.some((item) => item.type === 'SIGNATURE_DATE' && item.value === '2026-08-20'), true);
});

test('integra auditoria determinística à resposta da IA e produz avisos acionáveis', () => {
  const result = normalizeAiResult({
    summary: 'Contrato de prestação de serviços.', deadlines: [{ descricao: 'Implantação', data: '2026-08-20' }],
    costs: [{ description: 'Multa', amount: '2%' }], warnings: [],
  }, 'contrato', new Date(2026, 7, 17), complexContract);
  assert.ok(result.structured_analysis.financial_items.length >= 8);
  assert.equal(result.deadlines.some((item) => item.type === 'IMPLEMENTATION_DEADLINE' && item.data === null), true);
  assert.equal(result.costs.some((item) => item.type === 'PENALTY_RATE' && item.amount === '2%'), true);
  assert.equal(result.warnings.some((item) => /divergentes|aviso prévio geral/i.test(item.descricao)), true);
});

test('recompõe linha tabular sem atribuir a unidade do preço ao subtotal', () => {
  const text = 'Archive\t65 TB\tR$ 295,00/TB\tR$ 19.175,00';
  const result = analyzeDocumentSemantics(text, { summary: 'Tabela de preços.' });
  assert.equal(result.financial_items.length, 1);
  const { type, quantity, quantity_unit, unit_price, price_unit, subtotal, unit } = result.financial_items[0];
  assert.deepEqual({ type, quantity, quantity_unit, unit_price, price_unit, subtotal, unit }, { type: 'LINE_ITEM', quantity: 65, quantity_unit: 'TERABYTE', unit_price: 295, price_unit: 'TERABYTE', subtotal: 19175, unit: null });
  assert.equal(result.math_validations[0].status, 'MATCH');
});

test('detecta subtotal matematicamente divergente sem substituir o valor informado', () => {
  const result = analyzeDocumentSemantics('Licenças\t10 usuários\tR$ 25,00/usuário\tR$ 260,00', { summary: 'Tabela.' });
  assert.equal(result.financial_items[0].subtotal, 260);
  assert.equal(result.math_validations[0].calculated_subtotal, 250);
  assert.equal(result.conflicts.some((item) => item.type === 'CALCULATION_MISMATCH'), true);
});

test('usa a unidade da quantidade em tabela quando o preço não repete o sufixo', () => {
  const item = analyzeDocumentSemantics('Usuários excedentes\t46 usuários\tR$ 72,50\tR$ 3.335,00', { summary: 'Tabela.' }).financial_items[0];
  assert.equal(item.unit_price, 72.5);
  assert.equal(item.price_unit, 'USER');
  assert.equal(item.subtotal, 3335);
  assert.equal(item.unit, null);
});

test('preserva precisão de cotação sem tratá-la como preço unitário comum', () => {
  const item = analyzeDocumentSemantics('Cotação aplicável: R$ 5,1874/USD.', { summary: 'Câmbio.' }).financial_items[0];
  const { type, value, precision, base_currency, quote_currency } = item;
  assert.deepEqual({ type, value, precision, base_currency, quote_currency }, { type: 'EXCHANGE_RATE', value: 5.1874, precision: 4, base_currency: 'USD', quote_currency: 'BRL' });
});

test('mantém memória de cálculo como estrutura única', () => {
  const result = analyzeDocumentSemantics('Memória:\nR$ 3.335,00\n+ R$ 763,20\n+ R$ 2.590,00\n+ R$ 852,60\n= R$ 7.540,80', { summary: 'Cálculo.' });
  assert.equal(result.financial_items.length, 0);
  assert.deepEqual(result.calculations[0].components.map((item) => item.value), [3335, 763.2, 2590, 852.6]);
  assert.equal(result.calculations[0].status, 'MATCH');
});

test('mantém valor calculado e faturado quando diferem', () => {
  const result = analyzeDocumentSemantics('Conversão calculada: R$ 1.000,00. Valor informado na fatura: R$ 1.002,00.', { summary: 'Fatura.' });
  assert.equal(result.financial_items.some((item) => item.type === 'CALCULATED_VALUE'), true);
  assert.equal(result.financial_items.some((item) => item.type === 'INVOICE_TOTAL'), true);
  assert.equal(result.financial_reconciliations[0].difference, 2);
});

test('ignora valor explicitamente ilustrativo e não duplica tabela extraída duas vezes', () => {
  const line = 'Backup\t2 TB\tR$ 50,00/TB\tR$ 100,00';
  const source = `EXEMPLO\nValor meramente ilustrativo: R$ 999,00\n${line}\n[[TABLE page=1 index=1]]\n${line}\n[[/TABLE]]`;
  const result = analyzeDocumentSemantics(source, { summary: 'Preços.' });
  assert.equal(result.financial_items.filter((item) => item.type === 'LINE_ITEM').length, 1);
  assert.equal(result.financial_items.some((item) => item.value === 999), false);
});

test('separa obrigação fundamentada de recomendação da análise', () => {
  const source = 'A contratante deverá entregar os acessos necessários.';
  const result = analyzeDocumentSemantics(source, { summary: 'Contrato.', action_items: ['A contratante deverá entregar os acessos necessários', 'Verificar os dados bancários'] });
  assert.equal(result.obligations.length, 1);
  assert.equal(result.recommended_actions.length, 1);
});

test('classifica SLA como disponibilidade e não como desconto', () => {
  const result = analyzeDocumentSemantics('O SLA mensal de disponibilidade será de 99,95%. Crédito de SLA limitado a 5%.', { summary: 'SLA.' });
  assert.equal(result.financial_items.find((item) => item.value === 99.95)?.type, 'SLA_AVAILABILITY');
  assert.notEqual(result.financial_items.find((item) => item.value === 99.95)?.type, 'DISCOUNT');
  assert.equal(result.financial_items.find((item) => item.value === 5)?.type, 'SLA_CREDIT_RATE');
});

test('não cria custo a partir de conteúdo instrucional com percentual e dinheiro', () => {
  const result = analyzeDocumentSemantics('INSTRUÇÕES\nNão transformar 2,75% em R$ 2,75. Apenas para fins ilustrativos.', { summary: 'Instrução.' });
  assert.equal(result.financial_items.length, 0);
});

test('isola polaridade de crédito e total na mesma frase', () => {
  const result = analyzeDocumentSemantics('Após crédito de R$ 42.000,00, o total é R$ 321.100,00.', { summary: 'Valores.' });
  assert.equal(result.financial_items.find((item) => item.value === -42000)?.type, 'CREDIT');
  assert.equal(result.financial_items.find((item) => item.value === 321100)?.type, 'TOTAL');
});

test('relaciona valor bruto menos crédito ao total líquido sem dupla contagem', () => {
  const result = analyzeDocumentSemantics('Soma bruta: R$ 363.100,00. Crédito permanente: R$ 42.000,00. Total após crédito: R$ 321.100,00.', { summary: 'Composição.' });
  const relation = result.relationships.find((item) => item.type === 'BASE_MINUS_CREDIT_EQUALS_TOTAL');
  assert.equal(relation?.status, 'MATCH');
  assert.equal(relation?.calculated_result, 321100);
  assert.equal(result.financial_items.find((item) => item.value === 321100)?.type, 'NET_TOTAL');
});

test('prazos distintos para produtos distintos não geram conflito', () => {
  const result = analyzeDocumentSemantics('Produto A: aviso prévio de 75 dias.\nProduto B: aviso prévio de 45 dias.', { summary: 'Prazos.' });
  assert.equal(result.deadline_rules.length, 2);
  assert.notEqual(result.deadline_rules[0].scope, result.deadline_rules[1].scope);
  assert.equal(result.conflicts.some((item) => item.type === 'DEADLINE_CONFLICT'), false);
});

test('mensalidades de períodos não sobrepostos não geram conflito', () => {
  const result = analyzeDocumentSemantics('Nos primeiros 4 meses, mensalidade de R$ 300.000,00. Do 5º ao 12º mês, mensalidade de R$ 310.000,00. Após mês 12, mensalidade de R$ 318.600,00.', { summary: 'Fases.' });
  assert.equal(result.financial_items.filter((item) => /MONTH/.test(item.period || '')).length, 3);
  assert.equal(result.conflicts.some((item) => item.type === 'VALUE_CONFLICT'), false);
});

test('mensalidades divergentes em períodos sobrepostos continuam comparáveis', () => {
  const result = analyzeDocumentSemantics('Meses 1 a 6: mensalidade de R$ 300.000,00. Meses 5 a 12: mensalidade de R$ 310.000,00.', { summary: 'Fases sobrepostas.' });
  assert.equal(result.conflicts.some((item) => item.type === 'VALUE_CONFLICT'), true);
});

test('preserva cotação BRL por USD sem convertê-la em custo', () => {
  const result = analyzeDocumentSemantics('Cotação contratual: 5,2437 BRL/USD.', { summary: 'Câmbio.' });
  assert.equal(result.financial_items.length, 1);
  assert.deepEqual({ type: result.financial_items[0].type, value: result.financial_items[0].value, currency: result.financial_items[0].currency }, { type: 'EXCHANGE_RATE', value: 5.2437, currency: null });
});

test('valida conversão cambial isolada sem absorver valor vizinho', () => {
  const result = analyzeDocumentSemantics('Referência R$ 10,00.\n18.750 USD × 5,2437 BRL/USD = R$ 98.319,38\nOutra taxa R$ 20,00.', { summary: 'Conversão.' });
  const calculation = result.calculations.find((item) => item.type === 'CURRENCY_CONVERSION');
  assert.equal(calculation?.status, 'MATCH');
  assert.equal(calculation?.components.length, 2);
});

test('remove todos os marcadores internos da estrutura apresentada', () => {
  const result = analyzeDocumentSemantics('[[TABLE page=1 index=1]]\nItem\t1 TB\tR$ 50,00/TB\tR$ 50,00\n[[/TABLE]]', { summary: '[[TABLE]] Resumo [[/TABLE]]' });
  assert.equal(JSON.stringify(result).includes('[[TABLE'), false);
  assert.equal(JSON.stringify(result).includes('[[/TABLE]]'), false);
  assert.deepEqual({ page: result.financial_items[0].source.page, table: result.financial_items[0].source.table, row: result.financial_items[0].source.row }, { page: 1, table: 1, row: 1 });
});

test('fuzz de normalização monetária preserva centavos, separadores e sinal', () => {
  let seed = 173;
  for (let index = 0; index < 500; index += 1) {
    seed = (seed * 48271) % 0x7fffffff;
    const cents = seed % 100_000_000;
    const expected = cents / 100;
    const formatted = expected.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const variants = [`R$ ${formatted}`, `BRL ${formatted}`, `R$\u00a0${formatted}`, `R$ ${formatted.replace(/\./g, ' ')}`];
    for (const variant of variants) assert.equal(parseBrazilianMoney(variant), expected);
    assert.equal(parseBrazilianMoney(`(R$ ${formatted})`), -expected);
  }
});
