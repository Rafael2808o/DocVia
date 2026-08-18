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

export function normalizeDeadlines(items, sourceText = '', now = new Date()) {
  const result = (Array.isArray(items) ? items : []).map((item) => ({
    descricao: deadlineDescription(item),
    data: deadlineDate(item, now),
    ...(typeof item === 'object' && String(item?.recorrencia || item?.recurrence || '').toLowerCase() === 'mensal' ? { recorrencia: 'mensal' } : {}),
  }));
  const source = String(sourceText || '');
  const endMatch = source.match(/(?:t[eé]rmino|encerramento|fim\s+da\s+vig[eê]ncia)[^.!?\n]{0,80}?((?:[0-3]?\d)[/-](?:[0-1]?\d)[/-]\d{4}|[0-3]?\d\s+de\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4})/i);
  const endDate = extractDueDate(endMatch?.[1], now);
  if (endDate) {
    const related = result.find((item) => /renova|t[eé]rmino|encerr|fim\s+da\s+vig[eê]ncia/i.test(item.descricao));
    if (related && !related.data) related.data = endDate;
    else if (!result.some((item) => item.data === endDate)) result.push({ descricao: 'Término da vigência do contrato', data: endDate });
  }
  const paymentMatch = source.match(/pagamento[^.!?\n]{0,120}?(?:at[eé]|vence(?:r[aá])?)\s+(?:o|no)?\s*dia\s+([1-9]|[12]\d|3[01])\s+de\s+cada\s+m[eê]s/i);
  const paymentDay = Number(paymentMatch?.[1] || 0);
  if (paymentDay && !result.some((item) => /pagamento|mensalidade/i.test(item.descricao) && item.recorrencia === 'mensal')) {
    result.push({ descricao: `Pagamento mensal até o dia ${paymentDay}`, data: extractDueDate(`todo dia ${paymentDay}`, now), recorrencia: 'mensal' });
  }
  return result;
}
