import test from 'node:test';
import assert from 'node:assert/strict';
import { analisarDocumentoComIA, extractDeadlineDate, normalizeAiResult } from '../src/services/aiAnalysisV2Service.js';

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

test('rejeita análise sem resumo e texto acima do limite antes de chamar o provedor', async () => {
    assert.throws(() => normalizeAiResult({ deadlines: [] }), /análise incompleta/i);
    await assert.rejects(analisarDocumentoComIA('x'.repeat(120_001)), /grande demais/i);
});
