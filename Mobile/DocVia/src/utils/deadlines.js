export function dateKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
}

function validDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function extractDueDate(value, now = new Date()) {
  const raw = String(value || '');
  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso && validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/\b([0-3]?\d)[/-]([0-1]?\d)[/-](\d{4})\b/);
  if (br && validDate(Number(br[3]), Number(br[2]), Number(br[1]))) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  const months = { janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
  const written = raw.toLowerCase().match(/\b([0-3]?\d)\s+de\s+(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})\b/i);
  const writtenMonth = written ? months[written[2].toLowerCase()] : null;
  if (written && validDate(Number(written[3]), writtenMonth, Number(written[1]))) return `${written[3]}-${String(writtenMonth).padStart(2, '0')}-${written[1].padStart(2, '0')}`;
  const recurring = raw.match(/\b(?:todo\s+)?dia\s+([1-9]|[12]\d|3[01])\b/i);
  if (!recurring) return null;
  const day = Number(recurring[1]);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const occurrence = (year, month) => new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()));
  let candidate = occurrence(today.getFullYear(), today.getMonth());
  if (candidate < today) candidate = occurrence(today.getFullYear(), today.getMonth() + 1);
  return dateKey(candidate);
}

export function deadlineDescription(item) {
  return typeof item === 'string' ? item : item?.description || item?.descricao || 'Prazo identificado';
}

export function deadlineDate(item, now = new Date()) {
  const raw = typeof item === 'string' ? item : item?.due_date || item?.data || item?.date || deadlineDescription(item);
  if (typeof item === 'object' && String(item?.recorrencia || item?.recurrence || '').toLowerCase() === 'mensal') {
    const parsed = extractDueDate(raw, now);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (parsed && localDate(parsed) >= today) return parsed;
    const dayFromDate = parsed ? Number(parsed.slice(8, 10)) : null;
    const dayFromText = Number(String(deadlineDescription(item)).match(/\b(?:todo\s+)?dia\s+([1-9]|[12]\d|3[01])\b/i)?.[1] || 0);
    const day = dayFromText || dayFromDate;
    if (day) return extractDueDate(`todo dia ${day}`, now);
  }
  return extractDueDate(raw, now);
}

function textKey(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function deadlineKind(value) {
  const key = textKey(value);
  if (/pagamento|mensalidade|vencimento da parcela/.test(key)) return 'pagamento';
  if (/aviso previo|antecedencia|rescis/.test(key)) return 'aviso-rescisao';
  if (/termino|encerramento|fim da vigencia/.test(key)) return 'termino';
  if (/inicio|comeco/.test(key)) return 'inicio';
  if (/entrega|envio|protocolo/.test(key)) return 'entrega';
  if (/renov/.test(key)) return 'renovacao';
  if (/reuniao|audiencia|evento|apresentacao/.test(key)) return 'evento';
  return key.replace(/\b\d{1,4}\b/g, '').replace(/\s+/g, ' ').trim();
}

function sourceDeadlineCandidates(sourceText, now) {
  const source = String(sourceText || '');
  const candidates = [];
  const datePart = '(?:[0-3]?\\d[/-][0-1]?\\d[/-]\\d{4}|[0-3]?\\d\\s+de\\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\\s+de\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2})';
  const labels = [
    ['Data de início', '(?:in[ií]cio|come[cç]o)'],
    ['Término da vigência', '(?:t[eé]rmino|encerramento|fim\\s+da\\s+vig[eê]ncia)'],
    ['Vencimento', '(?:vencimento|vence(?:r[aá])?|data\\s+limite)'],
    ['Pagamento', '(?:pagamento|pagar|quit(?:a[cç][aã]o|ar))'],
    ['Entrega', '(?:entrega|entregar|envio|enviar|protocolo)'],
    ['Inscrição', '(?:inscri[cç][aã]o|inscrever|matr[ií]cula)'],
    ['Prazo para recurso', '(?:recurso|contesta[cç][aã]o)'],
    ['Correção', '(?:corre[cç][aã]o|corrigir)'],
    ['Confirmação', '(?:confirma[cç][aã]o|confirmar)'],
    ['Assinatura', '(?:assinatura|assinar)'],
    ['Prazo', '(?:prazo|at[eé])'],
    ['Renovação', '(?:renova[cç][aã]o|renovar)'],
    ['Evento', '(?:reuni[aã]o|audi[eê]ncia|evento|prova|apresenta[cç][aã]o)'],
  ];
  for (const [label, keyword] of labels) {
    const expression = new RegExp(`(${keyword}[^.!?\\n]{0,100}?(${datePart})(?:[^.!?\\n]{0,40}?(?:[àa]s?\\s+\\d{1,2}(?::\\d{2}|h(?:\\d{2})?)?))?)`, 'gi');
    for (const match of source.matchAll(expression)) {
      const data = extractDueDate(match[2], now);
      if (!data) continue;
      const time = match[1].match(/(?:às|\bas)\s+(\d{1,2}(?::\d{2}|h(?:\d{2})?)?)/i)?.[1];
      candidates.push({ descricao: `${label}${time ? ` às ${time}` : ''}`, data });
    }
  }
  for (const match of source.matchAll(/(?:anteced[eê]ncia\s+m[ií]nima|aviso\s+pr[eé]vio|comunica[cç][aã]o\s+(?:escrita\s+)?com\s+anteced[eê]ncia)[^.!?\n]{0,50}?(\d+)\s*(?:\([^)]*\)\s*)?(dias?|meses?|anos?)/gi)) {
    candidates.push({ descricao: `Aviso prévio: ${match[1]} ${match[2].toLowerCase()}`, data: null });
  }
  for (const match of source.matchAll(/(?:vig[eê]ncia|prazo)\s+(?:total\s+)?de\s+(\d+)\s*\(?[^)!?\n]{0,30}?\)?\s*(dias?|meses?|anos?)/gi)) {
    candidates.push({ descricao: `Vigência: ${match[1]} ${match[2].toLowerCase()}`, data: null });
  }
  const kindLabel = (sentence) => /entrega|envio|protocolo/i.test(sentence) ? 'Entrega'
    : /pagamento|vencimento|parcela/i.test(sentence) ? 'Pagamento'
      : /reuni[aã]o|audi[eê]ncia|evento|prova|apresenta[cç][aã]o/i.test(sentence) ? 'Evento'
        : /inscri[cç][aã]o|matr[ií]cula/i.test(sentence) ? 'Inscrição' : 'Prazo';
  for (const sentence of source.split(/(?<=[.!?])|\n/).map((value) => value.trim()).filter(Boolean)) {
    const label = kindLabel(sentence);
    const kind = deadlineKind(label);
    if (/\b(?:cancelad[oa]|dispensad[oa]|n[aã]o\s+(?:ser[aá]\s+)?necess[aá]ri[oa])\b/i.test(sentence)) {
      for (let index = candidates.length - 1; index >= 0; index -= 1) if (deadlineKind(candidates[index].descricao) === kind) candidates.splice(index, 1);
      continue;
    }
    if (!/\b(?:prorrogad[oa]|remarcad[oa]|adiad[oa]|antecipad[oa]|alterad[oa]|nova\s+data|novo\s+hor[aá]rio|corrig(?:id[oa]|e-se))\b/i.test(sentence)) continue;
    const updatedDate = extractDueDate(sentence, now);
    if (!updatedDate) continue;
    for (let index = candidates.length - 1; index >= 0; index -= 1) if (deadlineKind(candidates[index].descricao) === kind) candidates.splice(index, 1);
    const time = sentence.match(/(?:às|\bas)\s+(\d{1,2}(?::\d{2}|h(?:\d{2})?)?)/i)?.[1];
    candidates.push({ descricao: `${label} — prazo atualizado${time ? ` às ${time}` : ''}`, data: updatedDate });
  }
  return candidates;
}

function dedupeDeadlines(items) {
  const result = [];
  for (const item of items) {
    const candidate = { ...item, descricao: String(item.descricao || '').replace(/\s+/g, ' ').trim() };
    if (!candidate.descricao) continue;
    const kind = deadlineKind(candidate.descricao);
    const duplicateIndex = result.findIndex((current) => textKey(current.descricao) === textKey(candidate.descricao)
      || (candidate.data && current.data === candidate.data && deadlineKind(current.descricao) === kind)
      || (candidate.data && current.data === candidate.data && (kind === 'prazo' || deadlineKind(current.descricao) === 'prazo'))
      || (candidate.recorrencia && current.recorrencia === candidate.recorrencia && deadlineKind(current.descricao) === kind));
    if (duplicateIndex < 0) result.push(candidate);
    else {
      const current = result[duplicateIndex];
      result[duplicateIndex] = { ...current, ...(candidate.data && !current.data ? { data: candidate.data } : {}), ...(candidate.recorrencia && !current.recorrencia ? { recorrencia: candidate.recorrencia } : {}), descricao: candidate.descricao.length > current.descricao.length ? candidate.descricao : current.descricao };
    }
  }
  return result;
}

export function normalizeDeadlines(items, sourceText = '', now = new Date()) {
  let result = (Array.isArray(items) ? items : []).map((item) => ({
    descricao: deadlineDescription(item),
    data: deadlineDate(item, now),
    ...(typeof item === 'object' && String(item?.recorrencia || item?.recurrence || '').toLowerCase() === 'mensal' ? { recorrencia: 'mensal' } : {}),
  }));
  const source = String(sourceText || '');
  const sourceCandidates = sourceDeadlineCandidates(source, now);
  const sourceDates = new Set(sourceCandidates.map((item) => item.data).filter(Boolean));
  if (source) result = result.filter((item) => !item.data || sourceDates.has(item.data) || item.recorrencia === 'mensal');
  result.push(...sourceCandidates);
  const endMatch = source.match(/(?:t[eé]rmino|encerramento|fim\s+da\s+vig[eê]ncia)[^.!?\n]{0,80}?((?:[0-3]?\d)[/-](?:[0-1]?\d)[/-]\d{4}|[0-3]?\d\s+de\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4})/i);
  const endDate = extractDueDate(endMatch?.[1], now);
  if (endDate) {
    const related = result.find((item) => /t[eé]rmino|encerr|fim\s+da\s+vig[eê]ncia/i.test(item.descricao));
    if (related && !related.data) related.data = endDate;
    else if (!result.some((item) => item.data === endDate)) result.push({ descricao: 'Término da vigência do contrato', data: endDate });
  }
  const paymentMatch = source.match(/pagamento[^.!?\n]{0,120}?(?:at[eé]|vence(?:r[aá])?)\s+(?:o|no)?\s*dia\s+([1-9]|[12]\d|3[01])\s+de\s+cada\s+m[eê]s/i);
  const paymentDay = Number(paymentMatch?.[1] || 0);
  if (paymentDay && !result.some((item) => /pagamento|mensalidade/i.test(item.descricao) && item.recorrencia === 'mensal')) {
    result.push({ descricao: `Pagamento mensal até o dia ${paymentDay}`, data: extractDueDate(`todo dia ${paymentDay}`, now), recorrencia: 'mensal' });
  }
  const implementation = source.match(/implanta[cç][aã]o[^.!?\n]{0,140}?at[eé]\s+(\d+)\s+dias?\s+(?:úteis|uteis)[^.!?\n]{0,100}?(?:assinatura|assinad[oa])[^.!?\n]{0,80}?([0-3]?\d[/-][0-1]?\d[/-]\d{4})/i);
  if (implementation) {
    result = result.filter((item) => !/implanta[cç][aã]o/i.test(item.descricao));
    result.push({
      descricao: `Implantação em até ${implementation[1]} dias úteis após ${implementation[2]}`,
      data: null, type: 'IMPLEMENTATION_DEADLINE', duration: Number(implementation[1]),
      duration_unit: 'BUSINESS_DAY', base_date: extractDueDate(implementation[2], now),
    });
  }
  return dedupeDeadlines(result.filter((item) => item.data || item.recorrencia || /\b(?:\d+\s*(?:horas?|dias?|semanas?|meses?|anos?)|hoje|amanh[aã]|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|fim\s+do\s+m[eê]s|pr[oó]xima\s+semana|[àa]s?\s+\d{1,2}(?::\d{2}|h\d{0,2})?)\b/i.test(item.descricao)));
}
