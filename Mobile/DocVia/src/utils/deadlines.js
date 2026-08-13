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
