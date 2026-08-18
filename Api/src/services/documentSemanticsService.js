const MONEY_PATTERN = /(?:\(\s*)?[-−]?\s*(?:R\$|BRL)\s*(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?\s*\)?/gi;
const PERCENT_PATTERN = /(\d+(?:[.,]\d+)?)\s*%/gi;
const INDEX_PATTERN = /\b(IPCA(?:\s+positivo)?|IGP-M|INPC|CDI|SELIC)\b/gi;

function key(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function parseBrazilianMoney(value) {
  const raw = String(value ?? '').trim();
  if (!raw || !/(?:R\$|BRL)/i.test(raw)) return null;
  const negative = /[-−]\s*(?:R\$|BRL)|^\s*\(|\)\s*$/.test(raw);
  const number = raw.replace(/[^\d,.-]/g, '').replace(/^-/, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(number);
  return Number.isFinite(parsed) ? (negative ? -Math.abs(parsed) : parsed) : null;
}

function formatMoney(value) {
  const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(value)).replace(/\u00a0/g, ' ');
  return value < 0 ? `− ${formatted}` : formatted;
}

function contextAt(source, position, length) {
  const startBoundary = Math.max(source.lastIndexOf('\n', position), source.lastIndexOf('.', position), source.lastIndexOf(';', position));
  const candidates = [source.indexOf('\n', position + length), source.indexOf('.', position + length), source.indexOf(';', position + length)].filter((item) => item >= 0);
  const endBoundary = candidates.length ? Math.min(...candidates) + 1 : Math.min(source.length, position + length + 180);
  return source.slice(Math.max(0, startBoundary + 1), endBoundary).replace(/\s+/g, ' ').trim().slice(0, 600);
}

function sourceAt(source, position, text) {
  const prefix = source.slice(Math.max(0, position - 2_000), position);
  const page = Number([...prefix.matchAll(/(?:p[aá]gina|page)\s+(\d+)/gi)].at(-1)?.[1] || 0) || null;
  const clause = [...prefix.matchAll(/(?:cl[aá]usula\s+)?(\d+(?:\.\d+)+)/gi)].at(-1)?.[1] || null;
  const annex = [...prefix.matchAll(/\b(ANEXO\s+[A-Z0-9IVX-]+[^\n]*)/gi)].at(-1)?.[1]?.trim().slice(0, 160) || null;
  const section = [...prefix.matchAll(/^\s*(?:\d+(?:\.\d+)*[.\s-]+)?([A-ZÁÉÍÓÚÇ][A-ZÁÉÍÓÚÇ\s,/-]{4,})$/gm)].at(-1)?.[1]?.trim().slice(0, 160) || null;
  return { position, page, clause, annex, section, text };
}

function unitFrom(context, raw) {
  const nearby = `${raw} ${context}`;
  if (/\/(?:h|hora)|por\s+hora/i.test(nearby)) return 'HOUR';
  if (/por\s+usu[aá]rio/i.test(nearby)) return 'USER';
  if (/por\s+TB|\/TB/i.test(nearby)) return 'TERABYTE';
  if (/por\s+mil\s+chamadas/i.test(nearby)) return 'THOUSAND_CALLS';
  if (/ao\s+m[eê]s|\/m[eê]s|mensal/i.test(nearby)) return 'MONTH';
  if (/ao\s+ano|\/ano|anual/i.test(nearby)) return 'YEAR';
  if (/por\s+dia|\/dia|pro\s+rata\s+die/i.test(nearby)) return 'DAY';
  return null;
}

function financialSubject(context, unit) {
  if (/mensalidade|valor(?:-base)?\s+mensal|total\s+mensal/i.test(context)) return 'Mensalidade contratual';
  if (unit === 'HOUR') return 'Preço por hora';
  if (/implanta[cç][aã]o/i.test(context)) return 'Taxa de implantação';
  const explicitLabel = context.match(/\b((?:cr[eé]dito|desconto|abatimento|estorno|compensa[cç][aã]o)[^:;,.]{0,55})\s*:/i)?.[1];
  if (explicitLabel) return explicitLabel.trim();
  if (/cr[eé]dito\s+SLA/i.test(context)) return 'Crédito SLA';
  const label = context.split(/[:—-]/).find((part) => /[a-záéíóúç]/i.test(part)) || 'Valor financeiro';
  return label.trim().slice(0, 90);
}

function isConditional(context) {
  return /\b(?:em\s+caso|caso|se\s|poder[aá]|ser[aá]\s+aplicad|multa|juros|rescis[aã]o\s+antecipada)\b/i.test(context);
}

function monetaryType(context, amount, unit) {
  if (/cr[eé]dito|desconto|abatimento|estorno|compensa[cç][aã]o/i.test(context) || amount < 0) return 'CREDIT';
  if (/total/i.test(context)) return 'TOTAL';
  if (/parcela|entrada/i.test(context)) return 'INSTALLMENT';
  if (unit) return 'UNIT_PRICE';
  return 'MONEY';
}

function percentageType(context) {
  if (/juros/i.test(context)) return 'INTEREST_RATE';
  if (/multa|penalidade/i.test(context)) return 'PENALTY_RATE';
  if (/limite|limitad[oa]/i.test(context)) return 'LIMIT';
  if (/desconto|abatimento|cr[eé]dito/i.test(context)) return 'DISCOUNT';
  if (/(?:de|sobre)\s+(?:R\$|BRL)/i.test(context)) return 'FORMULA';
  return 'PERCENTAGE';
}

function rateLabel(type) {
  return type === 'INTEREST_RATE' ? 'Juros' : type === 'PENALTY_RATE' ? 'Multa' : type === 'LIMIT' ? 'Limite' : type === 'DISCOUNT' ? 'Desconto' : type === 'FORMULA' ? 'Fórmula financeira' : 'Percentual';
}

function extractFinancialItems(source) {
  const items = [];
  for (const match of source.matchAll(MONEY_PATTERN)) {
    const amount = parseBrazilianMoney(match[0]);
    if (amount === null) continue;
    const context = contextAt(source, match.index, match[0].length);
    const unit = unitFrom(context, match[0]);
    const type = monetaryType(context, amount, unit);
    const credit = type === 'CREDIT';
    const normalizedAmount = credit ? -Math.abs(amount) : amount;
    const subject = financialSubject(context, unit);
    const unitSuffix = unit === 'HOUR' ? ' por hora' : unit === 'USER' ? ' por usuário' : unit === 'TERABYTE' ? ' por TB'
      : unit === 'THOUSAND_CALLS' ? ' por mil chamadas' : unit === 'MONTH' ? ' por mês' : unit === 'YEAR' ? ' por ano' : unit === 'DAY' ? ' por dia' : '';
    items.push({
      label: subject, type, category: credit ? 'credit' : 'value', value: normalizedAmount,
      raw_value: match[0].trim(), display_value: `${formatMoney(normalizedAmount)}${unitSuffix}`, currency: 'BRL', unit,
      effect: credit ? 'DECREASE' : 'INCREASE', conditional: isConditional(context),
      charge_status: isConditional(context) ? 'CONDITIONAL_CHARGE' : credit ? 'CREDIT' : 'ACTUAL_VALUE',
      source: sourceAt(source, match.index, context), confidence: 0.98,
    });
  }
  for (const match of source.matchAll(PERCENT_PATTERN)) {
    const context = contextAt(source, match.index, match[0].length);
    const localPrefix = source.slice(Math.max(0, match.index - 70), match.index);
    const localSuffix = source.slice(match.index, Math.min(source.length, match.index + 80));
    const localContext = `${localPrefix} ${localSuffix}`;
    const nearbyKeywords = [...localPrefix.matchAll(/juros|multa|penalidade|desconto|abatimento|cr[eé]dito|limite|limitad[oa]/gi)];
    const type = nearbyKeywords.length ? percentageType(localPrefix.slice(nearbyKeywords.at(-1).index)) : percentageType(localSuffix);
    const value = Number(match[1].replace(',', '.'));
    const unit = unitFrom(localContext, match[0]);
    items.push({
      label: rateLabel(type), type, category: 'rule', value, raw_value: match[0],
      display_value: `${String(value).replace('.', ',')}%${unit === 'MONTH' ? ' ao mês' : unit === 'YEAR' ? ' ao ano' : ''}`,
      currency: null, unit, effect: type === 'DISCOUNT' ? 'DECREASE' : null,
      conditional: isConditional(context), conditions: /pro\s+rata\s+die/i.test(context) ? ['pro rata die'] : [],
      charge_status: ['PENALTY_RATE', 'INTEREST_RATE'].includes(type) ? 'POTENTIAL_PENALTY' : 'RATE',
      source: sourceAt(source, match.index, context), confidence: 0.97,
    });
  }
  for (const match of source.matchAll(INDEX_PATTERN)) {
    const context = contextAt(source, match.index, match[0].length);
    items.push({ label: 'Índice de atualização', type: 'INDEX', category: 'rule', value: match[1].toUpperCase(), raw_value: match[0], display_value: match[0], currency: null, unit: null, effect: null, conditional: isConditional(context), source: sourceAt(source, match.index, context), confidence: 0.97 });
  }
  return items.filter((item, index, all) => all.findIndex((other) => other.type === item.type && other.value === item.value && other.unit === item.unit && Math.abs(other.source.position - item.source.position) < 30) === index);
}

function extractSemanticDates(source) {
  const roles = [
    ['SIGNATURE_DATE', /(?:assinatura|assinado)[^.!?\n]{0,80}?([0-3]?\d[/-][0-1]?\d[/-]\d{4})/gi],
    ['EFFECTIVE_DATE', /(?:in[ií]cio\s+da\s+vig[eê]ncia|vig[eê]ncia\s+(?:come[cç]a|inicia))[^.!?\n]{0,80}?([0-3]?\d[/-][0-1]?\d[/-]\d{4})/gi],
    ['BILLING_START_DATE', /(?:in[ií]cio\s+(?:do\s+)?faturamento|faturamento\s+(?:come[cç]a|inicia))[^.!?\n]{0,80}?([0-3]?\d[/-][0-1]?\d[/-]\d{4})/gi],
    ['TERMINATION_DATE', /(?:t[eé]rmino|fim\s+da\s+vig[eê]ncia|encerramento)[^.!?\n]{0,80}?([0-3]?\d[/-][0-1]?\d[/-]\d{4})/gi],
    ['DUE_DATE', /(?:vencimento|vence(?:r[aá])?)[^.!?\n]{0,80}?([0-3]?\d[/-][0-1]?\d[/-]\d{4})/gi],
  ];
  const result = [];
  for (const [type, pattern] of roles) for (const match of source.matchAll(pattern)) {
    const [day, month, year] = match[1].split(/[/-]/);
    result.push({ type, value: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, raw_value: match[1], source: sourceAt(source, match.index, contextAt(source, match.index, match[0].length)), confidence: 0.96 });
  }
  return result.filter((item, index, all) => all.findIndex((other) => other.type === item.type && other.value === item.value) === index);
}

function extractPrecedenceRules(source) {
  const rules = [];
  for (const match of source.matchAll(/(?:ordem\s+de\s+preval[eê]ncia|prevalecer[aá]|ter[aá]\s+prioridade)[^.!?\n]{0,350}/gi)) {
    const context = contextAt(source, match.index, match[0].length);
    rules.push({ type: 'PRECEDENCE_RULE', text: context, source: sourceAt(source, match.index, context), confidence: 0.78 });
  }
  return rules;
}

function financialConflicts(items) {
  const groups = new Map();
  for (const item of items.filter((entry) => ['MONEY', 'TOTAL', 'UNIT_PRICE'].includes(entry.type) && !entry.conditional)) {
    const subject = /mensalidade|total mensal/i.test(`${item.label} ${item.source.text}`) ? 'Mensalidade contratual'
      : item.unit === 'HOUR' ? 'Preço por hora' : null;
    if (!subject) continue;
    if (!groups.has(subject)) groups.set(subject, []);
    groups.get(subject).push(item);
  }
  const conflicts = [];
  for (const [subject, entries] of groups) {
    const distinct = [...new Map(entries.map((entry) => [entry.value, entry])).values()];
    if (distinct.length < 2) continue;
    conflicts.push({
      type: 'VALUE_CONFLICT', subject, severity: 'HIGH', confidence: 0.9,
      values: distinct.map((entry) => ({ value: entry.value, display_value: entry.display_value, source: entry.source })),
      message: `Foram encontrados valores divergentes para ${subject.toLowerCase()}: ${distinct.map((entry) => `${entry.display_value}${entry.source.annex ? ` em ${entry.source.annex}` : entry.source.clause ? ` na cláusula ${entry.source.clause}` : ''}`).join(' e ')}. Verifique a regra de prevalência no documento.`,
    });
  }
  return conflicts;
}

function extractDeadlineRules(source) {
  const rules = [];
  const pattern = /(?:aviso\s+pr[eé]vio|anteced[eê]ncia)[^.!?\n]{0,100}?(\d+)\s*(?:\([^)]*\)\s*)?(dias?)/gi;
  for (const match of source.matchAll(pattern)) {
    const context = contextAt(source, match.index, match[0].length);
    const specific = /\b(?:exceto|exce[cç][aã]o|espec[ií]fic[oa]|m[oó]dulo|P\d|anexo)\b/i.test(context);
    rules.push({ subject: 'Aviso prévio', type: specific ? 'SPECIFIC_RULE' : 'GENERAL_RULE', duration: Number(match[1]), duration_unit: 'DAY', scope: specific ? context : 'Regra geral', source: sourceAt(source, match.index, context), confidence: specific ? 0.85 : 0.94 });
  }
  return rules;
}

function deadlineConflicts(rules) {
  const distinct = [...new Set(rules.map((rule) => rule.duration))];
  if (distinct.length < 2) return [];
  const hasSpecific = rules.some((rule) => rule.type === 'SPECIFIC_RULE');
  return [{
    type: hasSpecific ? 'POSSIBLE_EXCEPTION' : 'DEADLINE_CONFLICT', subject: 'Aviso prévio', severity: 'HIGH', confidence: hasSpecific ? 0.8 : 0.9,
    rules, message: hasSpecific
      ? `O documento apresenta aviso prévio geral de ${rules.find((rule) => rule.type === 'GENERAL_RULE')?.duration || distinct[0]} dias e uma possível regra específica de ${rules.find((rule) => rule.type === 'SPECIFIC_RULE')?.duration || distinct[1]} dias. Consulte as cláusulas correspondentes.`
      : `Foram encontrados prazos divergentes de aviso prévio (${distinct.join(' e ')} dias). Consulte as cláusulas correspondentes.`,
  }];
}

export function extractImplementationTerms(sourceText) {
  const source = String(sourceText || '');
  const match = source.match(/implanta[cç][aã]o[^.!?\n]{0,140}?at[eé]\s+(\d+)\s+(dias?)\s+(?:úteis|uteis)[^.!?\n]{0,100}?(?:assinatura|assinad[oa])[^.!?\n]{0,80}?([0-3]?\d[/-][0-1]?\d[/-]\d{4})/i);
  if (!match) return null;
  const [, duration, , rawDate] = match;
  const date = rawDate.split(/[/-]/);
  return { type: 'IMPLEMENTATION_DEADLINE', duration: Number(duration), duration_unit: 'BUSINESS_DAY', base_date: `${date[2]}-${date[1].padStart(2, '0')}-${date[0].padStart(2, '0')}`, calculated_date: null, description: `Implantação em até ${duration} dias úteis após ${rawDate}`, confidence: 0.97 };
}

function improveSummary(summary, documentType, financialItems, conflicts, deadlineRules) {
  const base = String(summary || '').trim();
  if (documentType !== 'contrato' || base.length >= 260) return base;
  const values = financialItems.filter((item) => item.category === 'value' && !item.conditional).slice(0, 3);
  const details = [];
  if (values.length) details.push(`Valores principais identificados: ${values.map((item) => `${item.label}: ${item.display_value}${item.unit === 'HOUR' ? ' por hora' : ''}`).join('; ')}`);
  if (deadlineRules.length) details.push(`O documento contém regras de aviso prévio de ${[...new Set(deadlineRules.map((rule) => rule.duration))].join(' e ')} dias`);
  if (conflicts.length) details.push(`Foram encontradas ${conflicts.length === 1 ? 'uma possível divergência' : `${conflicts.length} possíveis divergências`} entre cláusulas ou anexos`);
  return details.length ? `${base.replace(/[.!?]?$/, '.')} ${details.join('. ')}.`.replace(/\.\./g, '.') : base;
}

export function analyzeDocumentSemantics(sourceText, normalized, documentType = 'outro') {
  const source = String(sourceText || '');
  const financialItems = extractFinancialItems(source);
  const deadlineRules = extractDeadlineRules(source);
  const implementation = extractImplementationTerms(source);
  const conflicts = [...financialConflicts(financialItems), ...deadlineConflicts(deadlineRules)];
  const dates = extractSemanticDates(source);
  const precedenceRules = extractPrecedenceRules(source);
  const conflictWarnings = conflicts.map((conflict) => ({ descricao: conflict.message, prioridade: conflict.severity === 'HIGH' ? 'critico' : 'atencao', type: conflict.type, confidence: conflict.confidence }));
  return {
    summary: improveSummary(normalized.summary, documentType, financialItems, conflicts, deadlineRules),
    financial_items: financialItems,
    deadline_rules: deadlineRules,
    dates,
    implementation_terms: implementation ? [implementation] : [],
    precedence_rules: precedenceRules,
    conflicts,
    warnings: conflictWarnings,
    provenance_version: 1,
  };
}

export function financialItemsToLegacyCosts(items) {
  const seen = new Set();
  return items.filter((item) => {
    const fingerprint = `${item.type}|${item.value}|${item.unit || ''}|${key(item.label)}`;
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  }).map((item) => ({
    description: item.label,
    amount: item.display_value,
    type: item.type,
    category: item.category,
    conditional: item.conditional,
    unit: item.unit,
    effect: item.effect,
    source: item.source,
    confidence: item.confidence,
  }));
}
