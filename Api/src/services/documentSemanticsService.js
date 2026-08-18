import { validateContractAnalysis } from '../schemas/contractAnalysisSchemas.js';

const NUMBER = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d{1,6})?';
const MONEY = new RegExp(`(?:\\(\\s*)?[-−]?\\s*(?:R\\$|BRL)\\s*${NUMBER}\\s*\\)?`, 'gi');
const PERCENT = /(\d+(?:[.,]\d+)?)\s*%/gi;
const INDEX = /\b(IPCA(?:\s+positivo)?|IGP-M|INPC|CDI|SELIC)\b/gi;
const INTERNAL_TOKEN = /\[\[(?:\/?TABLE|PAGE)(?:\s+[^\]]*)?\]\]/gi;
const UNITS = [
  ['THOUSAND_CALLS', /^\s*(?:\/|por\s+)(?:mil\s+)?chamadas?\b/i],
  ['TERABYTE', /^\s*(?:\/|por\s+)(?:TB|terabytes?)\b/i],
  ['GIGABYTE', /^\s*(?:\/|por\s+)(?:GB|gigabytes?)\b/i],
  ['USER', /^\s*(?:\/|por\s+)(?:usu[aá]rios?|licen[cç]as?)\b/i],
  ['HOUR', /^\s*(?:\/|por\s+)(?:h|horas?)\b/i],
  ['MONTH', /^\s*(?:\/|por\s+|ao\s+)(?:m[eê]s|mensal)\b/i],
  ['YEAR', /^\s*(?:\/|por\s+|ao\s+)(?:ano|anual)\b/i],
  ['DAY', /^\s*(?:\/|por\s+)(?:dia)\b/i],
];

function key(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

export function sanitizeContractText(value) {
  return String(value || '').replace(INTERNAL_TOKEN, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

function parseNumber(value) {
  const raw = String(value ?? '').replace(/[^\d,.-]/g, '').replace(/^-/, '');
  if (!raw || !/\d/.test(raw)) return null;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw;
  const parsed = Number(normalized); return Number.isFinite(parsed) ? parsed : null;
}

export function parseBrazilianMoney(value) {
  const raw = String(value ?? '').trim(); if (!/(?:R\$|BRL)/i.test(raw)) return null;
  const parsed = parseNumber(raw); if (parsed === null) return null;
  return /[-−]\s*(?:R\$|BRL)|^\s*\(|\)\s*$/.test(raw) ? -Math.abs(parsed) : parsed;
}

function formatMoney(value, decimals = 2) {
  const result = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Math.abs(value)).replace(/\u00a0/g, ' ');
  return value < 0 ? `− ${result}` : result;
}

function contextAt(source, position, length) {
  const start = Math.max(source.lastIndexOf('\n', position), source.lastIndexOf('.', position), source.lastIndexOf(';', position));
  const ends = [source.indexOf('\n', position + length), source.indexOf('.', position + length), source.indexOf(';', position + length)].filter((item) => item >= 0);
  const end = ends.length ? Math.min(...ends) + 1 : Math.min(source.length, position + length + 180);
  return source.slice(Math.max(0, start + 1), end).replace(/\s+/g, ' ').trim().slice(0, 600);
}

function sourceAt(source, position, text) {
  const prefix = source.slice(Math.max(0, position - 2_000), position);
  const page = Number([...prefix.matchAll(/(?:p[aá]gina|page)\s*[= ]\s*(\d+)/gi)].at(-1)?.[1] || 0) || null;
  const clause = [...prefix.matchAll(/(?:cl[aá]usula\s+)?(\d+(?:\.\d+)+)/gi)].at(-1)?.[1] || null;
  const annex = [...prefix.matchAll(/\b(ANEXO\s+[A-Z0-9IVX-]+[^\n]*)/gi)].at(-1)?.[1]?.trim().slice(0, 160) || null;
  const tableOpen = [...prefix.matchAll(/\[\[TABLE\s+page=(\d+)\s+index=(\d+)\]\]/gi)].at(-1); const tableClose = prefix.lastIndexOf('[[/TABLE]]'); const insideTable = tableOpen && tableOpen.index > tableClose;
  const tableBody = insideTable ? prefix.slice(tableOpen.index + tableOpen[0].length) : ''; const currentLine = tableBody.split('\n').at(-1) || '';
  return { position, page: insideTable ? Number(tableOpen[1]) : page, clause, annex, table: insideTable ? Number(tableOpen[2]) : null, row: insideTable ? Math.max(1, tableBody.split('\n').length - 1) : null, column: insideTable ? currentLine.split('\t').length : null, text: sanitizeContractText(text) };
}

function structuralContext(source, position) {
  const before = source.slice(Math.max(0, position - 3_000), position);
  const headings = before.split('\n').map((line) => line.trim()).filter(Boolean);
  const annexMatch = [...before.matchAll(/\b(ANEXO\s+[A-Z0-9IVX-]+[^\n]*)/gi)].at(-1); const annex = annexMatch?.[1]?.trim().slice(0, 160) || null;
  const clauseMatch = [...before.matchAll(/(?:cl[aá]usula\s+)?(\d+(?:\.\d+)+)[^\n]*/gi)].at(-1); const clause = clauseMatch?.[0]?.trim().slice(0, 160) || null;
  const explicitMatch = [...before.matchAll(/\b(?:(?:produto|servi[cç]o|m[oó]dulo|ordem\s+de\s+servi[cç]o)\s*[:#-]?\s*([A-Z0-9][^\n:;]{0,100})|OS[-\s#]+\d[A-Z0-9/-]*)/gi)].at(-1); const explicitScope = explicitMatch?.[0]?.trim() || null;
  const section = headings.reverse().find((line) => /^(?:cl[aá]usula|se[cç][aã]o|anexo|ap[eê]ndice|aditivo|OS\b|\d+(?:\.\d+)+\b)/i.test(line))?.slice(0, 160) || null;
  const boundaryIndex = Math.max(annexMatch?.index ?? -1, clauseMatch?.index ?? -1);
  return { annex, clause, section, scope: explicitScope && explicitMatch.index > boundaryIndex ? explicitScope : annex || 'DOCUMENT' };
}

function temporalContext(context) {
  const monthRange = context.match(/(?:meses?|m[eê]s)\s*(\d+)\s*(?:a|at[eé]|–|-)\s*(\d+)/i) || context.match(/do\s+(\d+)[ºo]?\s+ao\s+(\d+)[ºo]?\s+m[eê]s/i);
  if (monthRange) return { recurrence: /mensal|por\s+m[eê]s|\/m[eê]s/i.test(context) ? 'MONTHLY' : null, effective_from: `MONTH_${monthRange[1]}`, effective_until: `MONTH_${monthRange[2]}`, period: `MONTH_${monthRange[1]}_TO_${monthRange[2]}` };
  const firstMonths = context.match(/primeiros?\s+(\d+)\s+meses?/i);
  if (firstMonths) return { recurrence: 'MONTHLY', effective_from: 'MONTH_1', effective_until: `MONTH_${firstMonths[1]}`, period: `MONTH_1_TO_${firstMonths[1]}` };
  const afterMonth = context.match(/(?:ap[oó]s|a\s+partir\s+d[eo])\s+(?:o\s+)?(?:m[eê]s\s+)?(\d+)[ºo]?\s*(?:m[eê]s)?/i);
  if (afterMonth) return { recurrence: /mensal|m[eê]s/i.test(context) ? 'MONTHLY' : null, effective_from: `AFTER_MONTH_${afterMonth[1]}`, effective_until: null, period: `AFTER_MONTH_${afterMonth[1]}` };
  return { recurrence: /mensal|por\s+m[eê]s|\/m[eê]s/i.test(context) ? 'MONTHLY' : /anual|por\s+ano|\/ano/i.test(context) ? 'ANNUAL' : null, effective_from: null, effective_until: null, period: null };
}

function enrichEntity(entity, source, position, context) {
  const structural = structuralContext(source, position);
  return { id: `entity-${position}-${entity.type}-${String(entity.value).replace(/[^a-z0-9.-]/gi, '')}`, semantic_role: entity.type, data_type: entity.currency ? 'money' : entity.type.includes('RATE') || entity.type.includes('PERCENT') || ['DISCOUNT', 'LIMIT', 'SLA_AVAILABILITY'].includes(entity.type) ? 'percentage' : 'rule', scope: structural.scope, section: structural.section, clause: structural.clause, annex: structural.annex, subject: entity.label || null, condition: conditional(context) ? sanitizeContractText(context) : null, ...temporalContext(context), relationships: entity.relationships || [], ...entity };
}

function exactUnit(source, position, length) { const suffix = source.slice(position + length, position + length + 45); return UNITS.find(([, pattern]) => pattern.test(suffix))?.[0] || null; }
function unitSuffix(unit) { return unit === 'HOUR' ? ' por hora' : unit === 'USER' ? ' por usuário' : unit === 'TERABYTE' ? ' por TB' : unit === 'GIGABYTE' ? ' por GB' : unit === 'THOUSAND_CALLS' ? ' por mil chamadas' : unit === 'MONTH' ? ' por mês' : unit === 'YEAR' ? ' por ano' : unit === 'DAY' ? ' por dia' : ''; }
function conditional(context) { return /\b(?:em\s+caso|caso|se\s|poder[aá]|ser[aá]\s+aplicad|multa|juros|rescis[aã]o\s+antecipada)\b/i.test(context); }

function explanatory(source, position) {
  const line = contextAt(source, position, 1); const heading = source.slice(Math.max(0, position - 250), position).split('\n').reverse().find((value) => value.trim()) || '';
  return /^(?:exemplo|instru[cç][oõ]es|explica[cç][aã]o|gloss[aá]rio|caso\s+de\s+teste|nota\s+ilustrativa|observa[cç][aã]o)\b/i.test(heading.trim()) || /\b(?:apenas\s+(?:um\s+)?exemplo|fins?\s+ilustrativos?|valor\s+meramente\s+ilustrativo|n[aã]o\s+(?:considerar|transformar|representa|constitui)|hipot[eé]tic[oa])\b/i.test(line);
}

function subject(context, unit) {
  if (/mensalidade|valor(?:-base)?\s+mensal|total\s+mensal/i.test(context)) return 'Mensalidade contratual';
  if (unit === 'HOUR') return 'Preço por hora'; if (/implanta[cç][aã]o/i.test(context)) return 'Taxa de implantação'; if (/cr[eé]dito\s+SLA/i.test(context)) return 'Crédito SLA';
  return (context.split(/[:—|\t-]/).find((part) => /[a-záéíóúç]/i.test(part)) || 'Valor financeiro').trim().slice(0, 90);
}

function matches(text, offset = 0) { return [...text.matchAll(MONEY)].map((match) => ({ raw: match[0], value: parseBrazilianMoney(match[0]), start: offset + match.index, length: match[0].length })); }
function covered(ranges, start, length) { return ranges.some(([from, to]) => start < to && start + length > from); }

function quantityBefore(line, moneyIndex) {
  const found = [...line.slice(0, moneyIndex).matchAll(/(\d+(?:[.,]\d+)?)\s*(TB|GB|usu[aá]rios?|licen[cç]as?|horas?|h|mil\s+chamadas?|chamadas?)\b/gi)].at(-1); if (!found) return null;
  const rawUnit = key(found[2]); const unit = /tb/.test(rawUnit) ? 'TERABYTE' : /gb/.test(rawUnit) ? 'GIGABYTE' : /usuario|licenca/.test(rawUnit) ? 'USER' : /hora|^h$/.test(rawUnit) ? 'HOUR' : 'THOUSAND_CALLS';
  return { value: parseNumber(found[1]), unit };
}

function extractLineItems(source, ranges) {
  const items = []; const validations = []; let offset = 0;
  for (const line of source.split('\n')) {
    const money = matches(line, offset);
    if (money.length >= 2 && !explanatory(source, offset)) {
      const explicitUnitPrice = money.find((item) => exactUnit(source, item.start, item.length));
      const provisionalPrice = explicitUnitPrice || money[0];
      const quantity = quantityBefore(line, provisionalPrice.start - offset);
      const unitPrice = explicitUnitPrice || (quantity ? money[0] : null);
      const subtotal = unitPrice && money.find((item) => item.start > unitPrice.start && !exactUnit(source, item.start, item.length));
      if (unitPrice && subtotal && quantity?.value) {
        const label = (line.slice(0, unitPrice.start - offset).replace(/\d+(?:[.,]\d+)?\s*(?:TB|GB|usu[aá]rios?|licen[cç]as?|horas?|h|mil\s+chamadas?|chamadas?)\s*$/i, '').split(/\t|\||\s{2,}/)[0] || 'Item financeiro').replace(/[;:|-]+$/g, '').trim().slice(0, 100);
        const expected = quantity.value * unitPrice.value; const difference = subtotal.value - expected; const valid = Math.abs(difference) <= Math.max(0.02, Math.abs(subtotal.value) * 0.000001);
        const validation = { type: 'LINE_ITEM_MATH', label, quantity: quantity.value, quantity_unit: quantity.unit, unit_price: unitPrice.value, price_unit: exactUnit(source, unitPrice.start, unitPrice.length) || quantity.unit, reported_subtotal: subtotal.value, calculated_subtotal: expected, difference, status: valid ? 'MATCH' : 'MISMATCH', source: sourceAt(source, unitPrice.start, line.trim()), confidence: 0.99 };
        const context = contextAt(source, unitPrice.start, line.length);
        items.push(enrichEntity({ label, type: 'LINE_ITEM', category: 'value', value: subtotal.value, raw_value: subtotal.raw.trim(), display_value: formatMoney(subtotal.value), currency: 'BRL', unit: null, quantity: quantity.value, quantity_unit: quantity.unit, unit_price: unitPrice.value, price_unit: validation.price_unit, subtotal: subtotal.value, effect: 'INCREASE', polarity: 'POSITIVE', conditional: false, charge_status: 'ACTUAL_VALUE', validation, source: sourceAt(source, unitPrice.start, line.trim()), confidence: valid ? 0.99 : 0.72 }, source, unitPrice.start, context)); validations.push(validation);
        for (const item of money) ranges.push([item.start, item.start + item.length]);
      }
    }
    offset += line.length + 1;
  }
  const seen = new Set(); return { items: items.filter((item) => { const fingerprint = `${key(item.label)}|${item.quantity}|${item.quantity_unit}|${item.unit_price}|${item.subtotal}`; if (seen.has(fingerprint)) return false; seen.add(fingerprint); return true; }), validations };
}

function extractRates(source, ranges) {
  const result = [];
  const patterns = [
    { pattern: new RegExp(`(?:R\\$|BRL)\\s*(${NUMBER})\\s*\\/\\s*(USD|EUR|GBP|JPY|CAD|AUD)`, 'gi'), value: 1, base: 2, quote: () => 'BRL' },
    { pattern: new RegExp(`(${NUMBER})\\s*(BRL|USD|EUR|GBP|JPY|CAD|AUD)\\s*\\/\\s*(BRL|USD|EUR|GBP|JPY|CAD|AUD)`, 'gi'), value: 1, base: 3, quote: (match) => match[2].toUpperCase() },
  ];
  for (const definition of patterns) for (const match of source.matchAll(definition.pattern)) {
    if (covered(ranges, match.index, match[0].length)) continue;
    const value = parseNumber(match[definition.value]); const baseCurrency = match[definition.base].toUpperCase(); const quoteCurrency = definition.quote(match); const precision = (match[definition.value].split(/[,.]/)[1] || '').length; const context = contextAt(source, match.index, match[0].length);
    ranges.push([match.index, match.index + match[0].length]);
    result.push(enrichEntity({ label: `Cotação ${baseCurrency}/${quoteCurrency}`, type: 'EXCHANGE_RATE', category: 'rule', value, raw_value: match[0], display_value: `${String(value).replace('.', ',')} ${quoteCurrency}/${baseCurrency}`, currency: null, base_currency: baseCurrency, quote_currency: quoteCurrency, precision, unit: `${quoteCurrency}/${baseCurrency}`, conditional: false, charge_status: 'RATE', source: sourceAt(source, match.index, context), confidence: 0.99 }, source, match.index, context));
  }
  return result;
}

function extractCalculations(source, ranges) {
  const result = []; let offset = 0;
  for (const line of source.split('\n')) { const money = matches(line, offset); if (money.length >= 3 && /[+=]/.test(line) && !explanatory(source, offset)) { const reported = money.at(-1); const components = money.slice(0, -1); const calculated = components.reduce((sum, item) => sum + item.value, 0); const difference = reported.value - calculated; result.push({ type: 'CALCULATION_MEMORY', expression: line.trim(), components: components.map((item) => ({ value: item.value, raw_value: item.raw.trim() })), reported_result: reported.value, calculated_result: calculated, difference, status: Math.abs(difference) <= 0.02 ? 'MATCH' : 'MISMATCH', source: sourceAt(source, offset, line.trim()), confidence: 0.99 }); for (const item of money) ranges.push([item.start, item.start + item.length]); } offset += line.length + 1; }
  const blockPattern = new RegExp(`(?:^|\\n)\\s*(?:R\\$|BRL)\\s*${NUMBER}(?:\\s*\\n\\s*\\+\\s*(?:R\\$|BRL)\\s*${NUMBER}){1,}\\s*\\n\\s*=\\s*(?:R\\$|BRL)\\s*${NUMBER}`, 'gim');
  for (const block of source.matchAll(blockPattern)) {
    const money = matches(block[0], block.index); if (money.length < 3 || result.some((item) => Math.abs(item.source.position - block.index) < 3)) continue;
    const reported = money.at(-1); const components = money.slice(0, -1); const calculated = components.reduce((sum, item) => sum + item.value, 0); const difference = reported.value - calculated;
    result.push({ type: 'CALCULATION_MEMORY', expression: block[0].trim(), components: components.map((item) => ({ value: item.value, raw_value: item.raw.trim() })), reported_result: reported.value, calculated_result: calculated, difference, status: Math.abs(difference) <= 0.02 ? 'MATCH' : 'MISMATCH', source: sourceAt(source, block.index, block[0].trim()), confidence: 0.99 }); for (const item of money) ranges.push([item.start, item.start + item.length]);
  }
  const exchangeFormula = new RegExp(`(${NUMBER})\\s*(USD|EUR|GBP)\\s*[×x*]\\s*(${NUMBER})\\s*BRL\\s*\\/\\s*\\2\\s*=\\s*((?:R\\$|BRL)\\s*${NUMBER})`, 'gi');
  for (const match of source.matchAll(exchangeFormula)) {
    const foreign = parseNumber(match[1]); const rate = parseNumber(match[3]); const reported = parseBrazilianMoney(match[4]); const calculated = foreign * rate; const difference = reported - calculated;
    result.push({ type: 'CURRENCY_CONVERSION', expression: sanitizeContractText(match[0]), components: [{ value: foreign, unit: match[2].toUpperCase() }, { value: rate, unit: `BRL/${match[2].toUpperCase()}` }], result_unit: 'BRL', reported_result: reported, calculated_result: calculated, difference, status: Math.abs(difference) <= Math.max(0.02, Math.abs(reported) * 0.00001) ? 'MATCH' : 'MISMATCH', source: sourceAt(source, match.index, match[0]), confidence: 0.99 });
    ranges.push([match.index, match.index + match[0].length]);
  }
  return result;
}

function financialRelations(items) {
  const relations = [];
  const ordered = [...items].filter((item) => item.currency === 'BRL').sort((left, right) => left.source.position - right.source.position);
  for (let index = 0; index < ordered.length; index += 1) {
    const gross = ordered[index]; if (!['GROSS_TOTAL', 'SUBTOTAL'].includes(gross.type)) continue;
    const nearby = ordered.filter((item) => item.source.position > gross.source.position && item.source.position - gross.source.position < 500);
    const credit = nearby.find((item) => item.type === 'CREDIT'); const total = nearby.find((item) => ['NET_TOTAL', 'TOTAL'].includes(item.type) && item.source.position > (credit?.source.position || gross.source.position));
    if (!credit || !total) continue; const calculated = gross.value + credit.value; const difference = total.value - calculated;
    const relationship = { id: `relation-${gross.id}-${credit.id}-${total.id}`, type: 'BASE_MINUS_CREDIT_EQUALS_TOTAL', operands: [gross.id, credit.id], result: total.id, calculated_result: calculated, reported_result: total.value, difference, status: Math.abs(difference) <= 0.02 ? 'MATCH' : 'MISMATCH', confidence: 0.98 };
    relations.push(relationship); gross.relationships.push(relationship.id); credit.relationships.push(relationship.id); total.relationships.push(relationship.id);
  }
  return relations;
}

function localMoneyLabel(source, position) {
  const start = Math.max(source.lastIndexOf('\n', position), source.lastIndexOf('.', position), source.lastIndexOf(';', position), source.lastIndexOf(',', position), source.lastIndexOf('=', position), source.lastIndexOf('+', position));
  return source.slice(start + 1, position).replace(/[\s:—|-]+$/g, '').split(/\t|\||:/).at(-1)?.trim().slice(-120) || '';
}

function moneyType(context, amount, unit, localLabel = '') {
  const local = localLabel || context;
  if (/^subtotal\b/i.test(local)) return 'SUBTOTAL';
  if (/^(?:total\s+(?:l[ií]quido|final|ap[oó]s)|valor\s+l[ií]quido)/i.test(local)) return 'NET_TOTAL';
  if (/^(?:soma\s+bruta|total\s+bruto|valor\s+base)/i.test(local)) return 'GROSS_TOTAL';
  if (/^total\b/i.test(local)) return 'TOTAL';
  if (/cr[eé]dito|desconto|abatimento|estorno|devolu[cç][aã]o|compensa[cç][aã]o/i.test(local) || amount < 0) return 'CREDIT';
  if (/convers[aã]o\s+calculada|valor\s+calculado|c[aá]lculo\s+interno/i.test(context)) return 'CALCULATED_VALUE';
  if (/informad[oa]\s+na\s+fatura|valor\s+faturado|total\s+(?:da\s+)?fatura|valor\s+cobrado/i.test(local)) return 'INVOICE_TOTAL';
  if (/subtotal/i.test(local)) return 'SUBTOTAL';
  if (/total\s+(?:l[ií]quido|final|ap[oó]s)|valor\s+l[ií]quido/i.test(local)) return 'NET_TOTAL';
  if (/soma\s+bruta|total\s+bruto|valor\s+base/i.test(local)) return 'GROSS_TOTAL';
  if (/\btotal\b/i.test(local)) return 'TOTAL'; if (/parcela|entrada/i.test(local)) return 'INSTALLMENT'; return unit ? 'UNIT_PRICE' : 'MONEY';
}

function extractFinancial(source) {
  const ranges = []; const lines = extractLineItems(source, ranges); const items = [...lines.items, ...extractRates(source, ranges)]; const calculations = extractCalculations(source, ranges);
  for (const match of source.matchAll(MONEY)) {
    if (covered(ranges, match.index, match[0].length) || explanatory(source, match.index)) continue; const amount = parseBrazilianMoney(match[0]); if (amount === null) continue;
    const context = contextAt(source, match.index, match[0].length); const unit = exactUnit(source, match.index, match[0].length); const localLabel = localMoneyLabel(source, match.index); const type = moneyType(context, amount, unit, localLabel); const credit = type === 'CREDIT'; const value = credit ? -Math.abs(amount) : amount;
    const label = subject(`${localLabel}: ${context}`, unit);
    items.push(enrichEntity({ label, type, category: credit ? 'credit' : 'value', value, raw_value: match[0].trim(), display_value: `${formatMoney(value)}${unitSuffix(unit)}`, currency: 'BRL', unit, effect: credit ? 'DECREASE' : 'INCREASE', polarity: credit ? 'NEGATIVE' : 'POSITIVE', conditional: conditional(context), charge_status: conditional(context) ? 'CONDITIONAL_CHARGE' : credit ? 'CREDIT' : type === 'CALCULATED_VALUE' ? 'CALCULATED' : type === 'INVOICE_TOTAL' ? 'INVOICED' : 'ACTUAL_VALUE', source: sourceAt(source, match.index, context), confidence: 0.98 }, source, match.index, context));
  }
  for (const match of source.matchAll(PERCENT)) {
    if (explanatory(source, match.index)) continue; const context = contextAt(source, match.index, match[0].length); const prefix = source.slice(Math.max(0, match.index - 120), match.index); const segmentStart = Math.max(source.lastIndexOf('\n', match.index), source.lastIndexOf('.', match.index), source.lastIndexOf(';', match.index)); const localPrefix = source.slice(segmentStart + 1, match.index);
    const keyword = [...prefix.matchAll(/SLA|disponibilidade|juros|multa|penalidade|desconto|abatimento|cr[eé]dito|reajuste|corre[cç][aã]o|comiss[aã]o|imposto|reten[cç][aã]o|limite|limitad[oa]|franquia|participa[cç][aã]o/gi)].at(-1)?.[0] || '';
    const type = /cr[eé]dito\s+(?:de\s+)?SLA/i.test(localPrefix) ? 'SLA_CREDIT_RATE' : /SLA|disponibilidade/i.test(keyword) ? 'SLA_AVAILABILITY' : /juros/i.test(keyword) ? 'INTEREST_RATE' : /multa|penalidade/i.test(keyword) ? 'PENALTY_RATE' : /desconto|abatimento|cr[eé]dito/i.test(keyword) ? (/SLA/i.test(context) ? 'SLA_CREDIT_RATE' : 'DISCOUNT') : /reajuste|corre[cç][aã]o/i.test(keyword) ? 'ADJUSTMENT_RATE' : /comiss[aã]o/i.test(keyword) ? 'COMMISSION_RATE' : /imposto/i.test(keyword) ? 'TAX_RATE' : /reten[cç][aã]o/i.test(keyword) ? 'RETENTION_RATE' : /franquia/i.test(keyword) ? 'FRANCHISE_RATE' : /participa[cç][aã]o/i.test(keyword) ? 'PARTICIPATION_RATE' : /limite|limitad[oa]/i.test(keyword) ? 'LIMIT' : conditional(context) ? 'CONDITIONAL_PERCENTAGE' : 'PERCENTAGE'; const value = parseNumber(match[1]); const unit = exactUnit(source, match.index, match[0].length);
    const labels = { INTEREST_RATE: 'Juros', PENALTY_RATE: 'Multa', DISCOUNT: 'Desconto', LIMIT: 'Limite', SLA_AVAILABILITY: 'SLA de disponibilidade', SLA_CREDIT_RATE: 'Crédito de SLA', ADJUSTMENT_RATE: 'Reajuste', COMMISSION_RATE: 'Comissão', TAX_RATE: 'Imposto', RETENTION_RATE: 'Retenção', FRANCHISE_RATE: 'Franquia', PARTICIPATION_RATE: 'Participação', CONDITIONAL_PERCENTAGE: 'Percentual condicional', PERCENTAGE: 'Percentual' }; const label = labels[type] || 'Percentual';
    items.push(enrichEntity({ label, type, category: 'rule', value, raw_value: match[0], display_value: `${String(value).replace('.', ',')}%${unit === 'MONTH' ? ' ao mês' : unit === 'YEAR' ? ' ao ano' : ''}`, currency: null, unit, effect: ['DISCOUNT', 'SLA_CREDIT_RATE'].includes(type) ? 'DECREASE' : null, conditional: conditional(context), charge_status: ['PENALTY_RATE', 'INTEREST_RATE'].includes(type) ? 'POTENTIAL_PENALTY' : 'RATE', source: sourceAt(source, match.index, context), confidence: keyword ? 0.97 : 0.72 }, source, match.index, context));
  }
  for (const match of source.matchAll(INDEX)) { if (!explanatory(source, match.index)) { const context = contextAt(source, match.index, match[0].length); items.push(enrichEntity({ label: 'Índice de atualização', type: 'INDEX', category: 'rule', value: match[1].toUpperCase(), raw_value: match[0], display_value: match[0], currency: null, unit: null, conditional: conditional(context), source: sourceAt(source, match.index, context), confidence: 0.97 }, source, match.index, context)); } }
  const seen = new Set(); const deduped = items.filter((item) => { const fingerprint = item.type === 'LINE_ITEM' ? `${item.type}|${key(item.label)}|${item.quantity}|${item.unit_price}|${item.subtotal}` : `${item.type}|${item.value}|${item.unit || ''}|${key(item.label)}|${key(item.source?.text)}`; if (seen.has(fingerprint)) return false; seen.add(fingerprint); return true; });
  return { items: deduped, calculations, validations: lines.validations, relations: financialRelations(deduped) };
}

function dates(source) {
  const roles = [['SIGNATURE_DATE', /(?:assinatura|assinado)[^.!?\n]{0,80}?([0-3]?\d[/-][0-1]?\d[/-]\d{4})/gi], ['EFFECTIVE_DATE', /(?:in[ií]cio\s+da\s+vig[eê]ncia|vig[eê]ncia\s+(?:come[cç]a|inicia))[^.!?\n]{0,80}?([0-3]?\d[/-][0-1]?\d[/-]\d{4})/gi], ['BILLING_START_DATE', /(?:in[ií]cio\s+(?:do\s+)?faturamento|faturamento\s+(?:come[cç]a|inicia))[^.!?\n]{0,80}?([0-3]?\d[/-][0-1]?\d[/-]\d{4})/gi], ['TERMINATION_DATE', /(?:t[eé]rmino|fim\s+da\s+vig[eê]ncia|encerramento)[^.!?\n]{0,80}?([0-3]?\d[/-][0-1]?\d[/-]\d{4})/gi], ['DUE_DATE', /(?:vencimento|vence(?:r[aá])?)[^.!?\n]{0,80}?([0-3]?\d[/-][0-1]?\d[/-]\d{4})/gi]]; const result = [];
  for (const [type, pattern] of roles) for (const match of source.matchAll(pattern)) { const [day, month, year] = match[1].split(/[/-]/); result.push({ type, value: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, raw_value: match[1], source: sourceAt(source, match.index, contextAt(source, match.index, match[0].length)), confidence: 0.96 }); } return result.filter((item, index, all) => all.findIndex((other) => other.type === item.type && other.value === item.value) === index);
}

function deadlineRules(source) { const result = []; for (const match of source.matchAll(/(?:aviso\s+pr[eé]vio|anteced[eê]ncia)[^.!?\n]{0,100}?(\d+)\s*(?:\([^)]*\)\s*)?(dias?)/gi)) { const context = contextAt(source, match.index, match[0].length); const structural = structuralContext(source, match.index); const specific = /\b(?:exceto|exce[cç][aã]o|espec[ií]fic[oa]|m[oó]dulo|produto|servi[cç]o|OS[-\s#]?\d|P\d|anexo)\b/i.test(context); const explicitSubject = context.match(/(?:para|do|da)\s+(?:o\s+|a\s+)?(?:produto|servi[cç]o|m[oó]dulo|OS)?\s*([A-Z0-9][A-Z0-9/-]{1,30})/i)?.[1] || null; result.push({ id: `deadline-${match.index}`, subject: 'Aviso prévio', type: specific ? 'SPECIFIC_RULE' : 'GENERAL_RULE', duration: Number(match[1]), duration_unit: 'DAY', scope: explicitSubject || structural.scope, condition: conditional(context) ? sanitizeContractText(context) : null, ...temporalContext(context), source: sourceAt(source, match.index, context), confidence: specific ? 0.88 : 0.94 }); } return result; }

function sameComparableContext(left, right) {
  const sameScope = left.scope === right.scope || left.scope === 'DOCUMENT' || right.scope === 'DOCUMENT';
  const interval = (period) => { const range = String(period || '').match(/^MONTH_(\d+)_TO_(\d+)$/); if (range) return [Number(range[1]), Number(range[2])]; const after = String(period || '').match(/^AFTER_MONTH_(\d+)$/); return after ? [Number(after[1]) + 1, Infinity] : null; };
  const leftInterval = interval(left.period); const rightInterval = interval(right.period); const samePeriod = !left.period || !right.period || left.period === right.period || (leftInterval && rightInterval && Math.max(leftInterval[0], rightInterval[0]) <= Math.min(leftInterval[1], rightInterval[1]));
  const sameCondition = key(left.condition) === key(right.condition) || (!left.condition && !right.condition);
  const sameUnit = (left.unit || left.duration_unit || null) === (right.unit || right.duration_unit || null);
  return sameScope && samePeriod && sameCondition && sameUnit;
}

function conflictsFor(items, rules) {
  const result = []; const recurring = items.filter((item) => ['MONEY', 'TOTAL', 'NET_TOTAL', 'GROSS_TOTAL'].includes(item.type) && !item.conditional && /mensalidade|total mensal/i.test(`${item.label} ${item.source.text}`));
  for (let index = 0; index < recurring.length; index += 1) for (let otherIndex = index + 1; otherIndex < recurring.length; otherIndex += 1) { const left = recurring[index]; const right = recurring[otherIndex]; if (left.value === right.value || !sameComparableContext(left, right)) continue; if (result.some((item) => item.values?.some((value) => value.id === left.id) && item.values?.some((value) => value.id === right.id))) continue; result.push({ type: 'VALUE_CONFLICT', subject: 'Mensalidade contratual', severity: 'HIGH', confidence: 0.9, values: [left, right].map((item) => ({ id: item.id, value: item.value, display_value: item.display_value, scope: item.scope, period: item.period, source: item.source })), message: `Foram encontrados valores divergentes e comparáveis para mensalidade contratual: ${left.display_value} e ${right.display_value}. Verifique a regra de prevalência no documento.` }); }
  for (let index = 0; index < rules.length; index += 1) for (let otherIndex = index + 1; otherIndex < rules.length; otherIndex += 1) { const left = rules[index]; const right = rules[otherIndex]; if (left.duration === right.duration || !sameComparableContext(left, right)) continue; const specific = left.type === 'SPECIFIC_RULE' || right.type === 'SPECIFIC_RULE'; result.push({ type: specific ? 'POSSIBLE_EXCEPTION' : 'DEADLINE_CONFLICT', subject: 'Aviso prévio', severity: specific ? 'MEDIUM' : 'HIGH', confidence: specific ? 0.78 : 0.9, rules: [left, right], message: specific ? `O documento apresenta regras comparáveis de aviso prévio de ${left.duration} e ${right.duration} dias, sendo uma delas possivelmente específica. Consulte as cláusulas correspondentes.` : `Foram encontrados prazos divergentes e comparáveis de aviso prévio (${left.duration} e ${right.duration} dias).` }); }
  return result;
}

export function extractImplementationTerms(sourceText) { const match = String(sourceText || '').match(/implanta[cç][aã]o[^.!?\n]{0,140}?at[eé]\s+(\d+)\s+(dias?)\s+(?:úteis|uteis)[^.!?\n]{0,100}?(?:assinatura|assinad[oa])[^.!?\n]{0,80}?([0-3]?\d[/-][0-1]?\d[/-]\d{4})/i); if (!match) return null; const [, duration, , rawDate] = match; const parts = rawDate.split(/[/-]/); return { type: 'IMPLEMENTATION_DEADLINE', duration: Number(duration), duration_unit: 'BUSINESS_DAY', base_date: `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`, calculated_date: null, description: `Implantação em até ${duration} dias úteis após ${rawDate}`, confidence: 0.97 }; }

function classifyActions(source, actions) { const obligations = []; const recommended_actions = []; for (const raw of Array.isArray(actions) ? actions : []) { const description = String(typeof raw === 'string' ? raw : raw?.description || raw?.descricao || '').trim(); if (!description) continue; const normalized = key(description); const grounded = normalized.length > 12 && key(source).includes(normalized.slice(0, Math.min(55, normalized.length))); const recommendation = /^(?:verificar|confirmar|revisar|consultar|comparar|validar|esclarecer|solicitar\s+esclarecimento)\b/i.test(description); const item = { description, source_grounded: grounded, confidence: grounded ? 0.92 : recommendation ? 0.78 : 0.62 }; if (recommendation || !grounded) recommended_actions.push(item); else obligations.push(item); } return { obligations, recommended_actions }; }

function summary(baseSummary, type, items, conflicts, rules) { let base = String(baseSummary || '').trim().replace(/(?:R\$|BRL)\s*\d[\d.,]*\s*(?:\.\.\.|…)/gi, 'valor financeiro'); if (type !== 'contrato' || base.length >= 260) return base; const values = items.filter((item) => item.category === 'value' && !item.conditional && item.type !== 'CALCULATED_VALUE').slice(0, 3); const extra = []; if (values.length) extra.push(`Valores principais identificados: ${values.map((item) => `${item.label}: ${item.display_value}`).join('; ')}`); if (rules.length) extra.push(`O documento contém regras de aviso prévio de ${[...new Set(rules.map((item) => item.duration))].join(' e ')} dias`); if (conflicts.length) extra.push(`Foram encontradas ${conflicts.length === 1 ? 'uma possível divergência' : `${conflicts.length} possíveis divergências`} entre cláusulas ou anexos`); return extra.length ? `${base.replace(/[.!?]?$/, '.')} ${extra.join('. ')}.`.replace(/\.\./g, '.') : base; }

export function analyzeDocumentSemantics(sourceText, normalized = {}, documentType = 'outro') {
  const source = String(sourceText || ''); const financial = extractFinancial(source); const rules = deadlineRules(source); const implementation = extractImplementationTerms(source); const conflicts = conflictsFor(financial.items, rules);
  for (const validation of financial.validations.filter((item) => item.status === 'MISMATCH')) conflicts.push({ type: 'CALCULATION_MISMATCH', subject: validation.label, severity: 'HIGH', confidence: 0.99, validation, message: `O subtotal informado de ${formatMoney(validation.reported_subtotal)} para ${validation.label} não coincide com ${validation.quantity} × ${formatMoney(validation.unit_price)} (${formatMoney(validation.calculated_subtotal)}). Confirme a linha original.` });
  for (const calculation of financial.calculations.filter((item) => item.status === 'MISMATCH')) conflicts.push({ type: 'CALCULATION_MISMATCH', subject: 'Memória de cálculo', severity: 'HIGH', confidence: 0.99, validation: calculation, message: `A memória de cálculo informa ${formatMoney(calculation.reported_result)}, mas a soma dos componentes resulta em ${formatMoney(calculation.calculated_result)}.` });
  const reconciliations = []; for (const calculated of financial.items.filter((item) => item.type === 'CALCULATED_VALUE')) { const invoiced = financial.items.find((item) => item.type === 'INVOICE_TOTAL' && Math.abs(item.source.position - calculated.source.position) < 700); if (invoiced) { const difference = invoiced.value - calculated.value; reconciliations.push({ type: 'CALCULATED_VS_INVOICED', calculated_value: calculated.value, invoiced_value: invoiced.value, difference, status: Math.abs(difference) <= 0.02 ? 'MATCH' : 'UNRESOLVED_DIFFERENCE', message: Math.abs(difference) <= 0.02 ? 'O valor calculado coincide com o valor informado na fatura.' : `O valor calculado (${calculated.display_value}) difere do valor informado na fatura (${invoiced.display_value}) em ${formatMoney(difference)}. A causa pode ser arredondamento ou uma regra não explicitada; confirme no documento.`, confidence: 0.86, sources: [calculated.source, invoiced.source] }); } }
  const actions = classifyActions(source, normalized.action_items); const warnings = [...conflicts.map((item) => ({ descricao: item.message, prioridade: item.severity === 'HIGH' ? 'critico' : 'atencao', type: item.type, confidence: item.confidence })), ...reconciliations.filter((item) => item.status !== 'MATCH').map((item) => ({ descricao: item.message, prioridade: 'atencao', type: item.type, confidence: item.confidence }))];
  return validateContractAnalysis({ summary: sanitizeContractText(summary(normalized.summary, documentType, financial.items, conflicts, rules)), financial_items: financial.items, relationships: financial.relations, calculations: financial.calculations, math_validations: financial.validations, financial_reconciliations: reconciliations, deadline_rules: rules, dates: dates(source), implementation_terms: implementation ? [implementation] : [], precedence_rules: [...source.matchAll(/(?:ordem\s+de\s+preval[eê]ncia|prevalecer[aá]|ter[aá]\s+prioridade|este\s+aditivo\s+substitui|fica\s+alterad[oa]|permanecem\s+inalterad[oa]s?)[^.!?\n]{0,350}/gi)].map((match) => ({ type: 'PRECEDENCE_RULE', text: sanitizeContractText(contextAt(source, match.index, match[0].length)), source: sourceAt(source, match.index, contextAt(source, match.index, match[0].length)), confidence: 0.88 })), obligations: actions.obligations, recommended_actions: actions.recommended_actions, conflicts, warnings, provenance_version: 3 });
}

export function financialItemsToLegacyCosts(items) { const seen = new Set(); return items.filter((item) => { const fingerprint = item.type === 'LINE_ITEM' ? `${item.type}|${key(item.label)}|${item.quantity}|${item.unit_price}|${item.subtotal}` : `${item.type}|${item.value}|${item.unit || ''}|${key(item.label)}`; if (seen.has(fingerprint)) return false; seen.add(fingerprint); return true; }).map((item) => ({ description: item.label, amount: item.display_value, type: item.type, category: item.category, conditional: item.conditional, unit: item.unit, quantity: item.quantity, quantity_unit: item.quantity_unit, unit_price: item.unit_price, price_unit: item.price_unit, subtotal: item.subtotal, validation: item.validation, base_currency: item.base_currency, quote_currency: item.quote_currency, effect: item.effect, source: item.source, confidence: item.confidence })); }
