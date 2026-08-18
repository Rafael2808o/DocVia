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
