import test from 'node:test';
import assert from 'node:assert/strict';
import { analisarDocumentoComIA, extractDeadlineDate, normalizeAiResult, normalizeCostItems } from '../src/services/aiAnalysisV2Service.js';

test('normaliza datas ISO, brasileiras e vencimentos mensais', () => {
    const now = new Date(2026, 7, 7);
    assert.equal(extractDeadlineDate('vence em 2026-09-20', now), '2026-09-20');
    assert.equal(extractDeadlineDate('vence em 21/09/2026', now), '2026-09-21');
    assert.equal(extractDeadlineDate('vencimento todo dia 15', now), '2026-08-15');
    assert.equal(extractDeadlineDate('vencimento todo dia 2', now), '2026-09-02');
    assert.equal(extractDeadlineDate('data inválida 31/02/2026', now), null);
});

test('normaliza a estrutura variável retornada pelo provedor de IA', () => {
    const result = normalizeAiResult({
        title: ' Um contrato ', summary: ' Resumo objetivo ',
        deadlines: ['Vencimento todo dia 15', { description: 'Assinar', due_date: '20/09/2026' }],
        costs: ['Tarifa não informada', { descricao: 'Mensalidade', valor: 'R$ 10,00' }],
        warnings: ['Leia com atenção', { description: 'Multa alta', priority: 'critical' }],
        action_items: [{ description: 'Confirmar valor' }], evidence: ['Cláusula 3'],
    }, 'contrato', new Date(2026, 7, 7));
    assert.equal(result.summary, 'Resumo objetivo');
    assert.deepEqual(result.deadlines[0], { descricao: 'Vencimento todo dia 15', data: '2026-08-15', recorrencia: 'mensal' });
    assert.equal(result.deadlines[1].data, '2026-09-20');
    assert.equal(result.costs[1].amount, 'R$ 10,00');
    assert.equal(result.warnings[1].prioridade, 'critico');
    assert.deepEqual(result.action_items, ['Confirmar valor']);
});

test('recupera do texto-fonte o dia de uma recorrência mensal omitido pelo provedor', () => {
    const result = normalizeAiResult({
        summary: 'Resumo',
        deadlines: [{ descricao: 'Vencimento do pagamento mensal', data: null, recorrencia: 'mensal' }],
    }, 'contrato', new Date(2026, 7, 7), 'O pagamento vence todo dia 15 de cada mês.');
    assert.deepEqual(result.deadlines[0], {
        descricao: 'Vencimento do pagamento mensal',
        data: '2026-08-15',
        recorrencia: 'mensal',
    });
});

test('completa término contratual por extenso e pagamento mensal omitidos pelo provedor', () => {
    const result = normalizeAiResult({
        summary: 'Resumo',
        deadlines: [{ descricao: 'Renovação do contrato', data: null }],
    }, 'contrato', new Date(2026, 7, 17), 'O contrato terá término em 17 de agosto de 2027. O pagamento deverá ser realizado até o dia 10 de cada mês.');
    assert.deepEqual(result.deadlines, [
        { descricao: 'Renovação do contrato', data: '2027-08-17' },
        { descricao: 'Pagamento mensal até o dia 10', data: '2026-09-10', recorrencia: 'mensal' },
    ]);
});

test('remove custo duplicado e calcula multa e juros quando a base está clara', () => {
    const source = `Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor mensal de R$ 2.500,00.
      Em caso de atraso, poderá ser aplicada multa de 2% sobre o valor devido, acrescida de juros de 1% ao mês.`;
    const costs = normalizeCostItems([
        { description: 'Valor mensal de R$ 2.500,00', amount: 2500 },
        { description: 'Valor mensal', amount: 'R$ 2.500,00' },
        { description: 'Multa de 2% sobre o valor devido', amount: 0 },
        { description: 'Juros de 1% ao mês', amount: '0' },
    ], source);
    assert.deepEqual(costs, [
        { description: 'Valor mensal', amount: 'R$ 2.500,00' },
        { description: 'Multa de 2% sobre o valor devido', amount: 'R$ 50,00 (2% de R$ 2.500,00)' },
        { description: 'Juros de 1% ao mês', amount: 'R$ 25,00/mês (1% de R$ 2.500,00)' },
    ]);
});

test('não exibe zero inventado quando a base percentual não está disponível', () => {
    assert.deepEqual(normalizeCostItems([
        { description: 'Multa de 2% sobre o valor devido', amount: 0 },
        { description: 'Tarifa administrativa', amount: 0 },
    ]), [
        { description: 'Multa de 2% sobre o valor devido', amount: '2% sobre o valor devido' },
        { description: 'Tarifa administrativa', amount: '' },
    ]);
});

test('rejeita análise sem resumo e texto acima do limite antes de chamar o provedor', async () => {
    assert.throws(() => normalizeAiResult({ deadlines: [] }), /análise incompleta/i);
    await assert.rejects(analisarDocumentoComIA('x'.repeat(120_001)), /grande demais/i);
});
