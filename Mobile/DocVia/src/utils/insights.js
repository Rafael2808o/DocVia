function text(value) {
  return String(typeof value === 'string' ? value : value?.descricao || value?.description || value?.title || '').replace(/\s+/g, ' ').trim();
}

function key(value) {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function warningKind(value) {
  const normalized = key(value);
  if (/rescis|encerramento imediato/.test(normalized)) return 'rescisao';
  if (/multa|juros|atraso|inadimpl/.test(normalized)) return 'encargos';
  if (/sigilo|confidencial/.test(normalized)) return 'confidencialidade';
  if (/prazo|vencimento|perda de data/.test(normalized)) return 'prazo';
  return normalized;
}

export function uniqueInsights(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const fingerprint = key(item);
    if (!fingerprint || seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

export function normalizeWarnings(items, sourceText = '') {
  const sourceItems = String(sourceText || '').split(/(?<=[.!?])|\n/).map((value) => value.trim()).filter(Boolean).flatMap((sentence) => {
    if (/descumprimento[^.!?]{0,100}rescis[aã]o|rescis[aã]o\s+imediata/i.test(sentence)) return [{ descricao: sentence, prioridade: /\b(?:se|caso|em\s+caso|poder[aá])\b/i.test(sentence) ? 'atencao' : 'critico' }];
    if (/atraso[^.!?]{0,120}(?:multa|juros)|(?:multa|juros)[^.!?]{0,120}(?:atraso|inadimpl)/i.test(sentence)) return [{ descricao: sentence, prioridade: 'atencao' }];
    return [];
  });
  const result = [];
  const rank = { informativo: 1, atencao: 2, critico: 3 };
  for (const item of [...(Array.isArray(items) ? items : []), ...sourceItems]) {
    const description = text(item);
    if (!description) continue;
    const rawPriority = String(item?.prioridade || item?.priority || '').toLowerCase();
    const prioridade = ['critico', 'crítico', 'critical', 'high', 'alta'].includes(rawPriority) ? 'critico'
      : ['informativo', 'info', 'low', 'baixa'].includes(rawPriority) ? 'informativo' : 'atencao';
    const candidate = { descricao: description, prioridade };
    const concept = warningKind(candidate);
    const index = result.findIndex((current) => warningKind(current) === concept);
    if (index < 0) result.push(candidate);
    else if (rank[prioridade] > rank[result[index].prioridade] || (prioridade === result[index].prioridade && description.length > result[index].descricao.length)) result[index] = candidate;
  }
  return result;
}
