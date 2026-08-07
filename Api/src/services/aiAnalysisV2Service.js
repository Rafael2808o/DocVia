import { AppError } from '../../utils/erros.js';
import { env, temGeminiConfigurada, temOpenAiConfigurada } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const prompt = 'Responda somente JSON válido com title (título curto e descritivo, até 60 caracteres), summary (texto), deadlines, costs, warnings, action_items, evidence e document_type. Em warnings, retorne objetos {descricao, prioridade}, onde prioridade é exatamente "informativo", "atencao" ou "critico". Use "critico" para riscos relevantes como perda de prazo, rescisão, multa alta, inadimplência ou obrigação urgente; "atencao" para encargos, juros e pontos que exigem leitura; e "informativo" para observações sem risco imediato. Use arrays vazios quando não houver dados.';

function parse(content) {
  const cleaned = String(content || '').replace(/```(?:json)?/gi, '').trim();
  const begin = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
  if (begin < 0 || end < begin) throw new AppError('A IA retornou uma resposta inválida. Tente novamente.', 502);
  try { return JSON.parse(cleaned.slice(begin, end + 1)); } catch { throw new AppError('A IA retornou uma resposta inválida. Tente novamente.', 502); }
}

async function call(url, options) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal }); const data = await response.json().catch(() => ({}));
    if (!response.ok) { const reason = data.error?.message || data.error?.status || 'resposta sem detalhes'; logger.error({ providerStatus: response.status, providerError: reason }, 'Provedor de IA recusou a solicitação'); throw new AppError(`Serviço de IA indisponível (${response.status}): ${reason}`, 503); }
    return data;
  } catch (error) { if (error.name === 'AbortError') throw new AppError('A análise demorou demais. Tente novamente.', 504); throw error; } finally { clearTimeout(timeout); }
}

export async function analisarDocumentoComIA(text, type = 'outro') {
  let raw; let content;
  if (env.AI_PROVIDER === 'gemini') {
    if (!temGeminiConfigurada()) throw new AppError('Gemini não está configurado. Defina GEMINI_API_KEY no .env.', 503);
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`); url.searchParams.set('key', env.GEMINI_API_KEY);
    raw = await call(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: prompt }] }, contents: [{ role: 'user', parts: [{ text: `Tipo: ${type}\n${text}` }] }], generationConfig: { responseMimeType: 'application/json' } }) });
    content = raw.candidates?.[0]?.content?.parts?.[0]?.text;
  } else {
    if (!temOpenAiConfigurada()) throw new AppError('OpenAI não está configurada. Defina OPENAI_API_KEY no .env.', 503);
    raw = await call('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: prompt }, { role: 'user', content: `Tipo: ${type}\n${text}` }], response_format: { type: 'json_object' } }) });
    content = raw.choices?.[0]?.message?.content;
  }
  const result = parse(content);
  if (typeof result.summary !== 'string') throw new AppError('A IA retornou uma análise incompleta. Tente novamente.', 502);
  return { title: typeof result.title === 'string' ? result.title.trim().slice(0, 60) : '', summary: result.summary, deadlines: Array.isArray(result.deadlines) ? result.deadlines : [], costs: Array.isArray(result.costs) ? result.costs : [], warnings: Array.isArray(result.warnings) ? result.warnings : [], action_items: Array.isArray(result.action_items) ? result.action_items : [], evidence: Array.isArray(result.evidence) ? result.evidence : [], document_type: typeof result.document_type === 'string' ? result.document_type : type, raw };
}
