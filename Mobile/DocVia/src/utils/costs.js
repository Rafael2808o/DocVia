function textKey(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
}

export function parseBrl(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const numeric = raw.replace(/[^\d,.-]/g, '');
  if (!numeric || !/\d/.test(numeric)) return null;
  const normalized = numeric.includes(',') ? numeric.replace(/\./g, '').replace(',', '.') : numeric;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatBrl(value) {
  const amount = parseBrl(value);
  return amount !== null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount).replace(/\u00a0/g, ' ')
    : 'Valor não identificado';
}

function sourceBaseAmount(sourceText) {
  const money = '(R\\$\\s*\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?)';
  const patterns = [
    new RegExp(`valor\\s+mensal(?:\\s+de)?\\s*${money}`, 'i'),
    new RegExp(`pag(?:a|ará|ara|amento)[^.!?\\n]{0,100}?${money}`, 'i'),
    new RegExp(`valor\\s+devido(?:\\s+de)?\\s*${money}`, 'i'),
  ];
  for (const pattern of patterns) {
    const amount = parseBrl(String(sourceText || '').match(pattern)?.[1]);
    if (amount && amount > 0) return amount;
  }
  const values = [...String(sourceText || '').matchAll(/R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?/gi)].map((match) => parseBrl(match[0])).filter((amount) => amount > 0);
  return values.length === 1 ? values[0] : null;
}

function costKind(value) {
  const key = textKey(value);
  if (/\bmulta\b/.test(key)) return 'multa';
  if (/\bjuros?\b/.test(key)) return 'juros';
  if (/\b(mensal|mensalidade|pagamento mensal)\b/.test(key)) return 'mensalidade';
  return key;
}

function cleanDescription(value, numericAmount) {
  let result = String(value || '').trim().replace(/\s+/g, ' ');
  if (numericAmount !== null && numericAmount > 0) {
    result = result.replace(/\s*(?::|-)?\s*(?:de\s+)?R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?/gi, '').trim();
  }
  return result.replace(/[\s:;-]+$/, '').trim() || 'Custo';
}

export function normalizeCosts(items, sourceText = '') {
  const baseAmount = sourceBaseAmount(sourceText);
  const sourceItems = [];
  if (baseAmount) sourceItems.push({ description: /mensal/i.test(sourceText) ? 'Valor mensal' : 'Valor principal', amount: formatBrl(baseAmount) });
  for (const match of String(sourceText || '').matchAll(/multa[^.!?\n]{0,90}?(\d+(?:[.,]\d+)?)\s*%[^.!?\n]*/gi)) sourceItems.push({ description: match[0].trim(), amount: `${match[1]}%` });
  for (const match of String(sourceText || '').matchAll(/juros?[^.!?\n]{0,90}?(\d+(?:[.,]\d+)?)\s*%[^.!?\n]*/gi)) sourceItems.push({ description: match[0].trim(), amount: `${match[1]}%` });
  for (const match of String(sourceText || '').matchAll(/(?:taxa|tarifa|honor[aá]rios?|indeniza[cç][aã]o|custo)[^.!?\n]{0,100}?(R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi)) sourceItems.push({ description: match[0].trim(), amount: match[1] });
  const seen = new Set();
  const result = [];
  for (const item of [...(Array.isArray(items) ? items : []), ...sourceItems]) {
    const rawDescription = typeof item === 'string' ? item : item?.description || item?.descricao || item?.title || 'Custo';
    const rawAmount = typeof item === 'string' ? '' : item?.amount ?? item?.value ?? item?.valor ?? '';
    const numericAmount = parseBrl(rawAmount);
    const percentageMatch = `${rawDescription} ${rawAmount}`.match(/(\d+(?:[.,]\d+)?)\s*%/);
    const percentage = percentageMatch ? Number(percentageMatch[1].replace(',', '.')) : null;
    const kind = costKind(rawDescription);
    const description = cleanDescription(rawDescription, numericAmount);
    let amount = '';
    if (percentage && baseAmount && ['multa', 'juros'].includes(kind)) {
      const suffix = kind === 'juros' && /\b(?:ao|por)\s+m[eê]s|mensal/i.test(rawDescription) ? '/mês' : '';
      amount = `${formatBrl(baseAmount * percentage / 100)}${suffix} (${String(percentage).replace('.', ',')}% de ${formatBrl(baseAmount)})`;
    } else if (numericAmount !== null && numericAmount > 0) {
      amount = formatBrl(numericAmount);
    } else if (percentage) {
      amount = `${String(percentage).replace('.', ',')}%${/valor devido/i.test(rawDescription) ? ' sobre o valor devido' : ''}`;
    } else if (String(rawAmount).trim() && numericAmount === null) {
      amount = String(rawAmount).trim();
    }
    const exactKey = `${textKey(description)}|${textKey(amount)}`;
    const semanticKey = `${kind}|${percentage ? `percent-${percentage}` : numericAmount && numericAmount > 0 ? numericAmount.toFixed(2) : textKey(amount)}`;
    if (seen.has(exactKey) || (['multa', 'juros', 'mensalidade'].includes(kind) && seen.has(semanticKey))) continue;
    seen.add(exactKey);
    seen.add(semanticKey);
    result.push({ description, amount });
  }
  return result;
}
