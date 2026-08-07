import { AppError } from '../../utils/erros.js';
import { env, temGeminiConfigurada, temOpenAiConfigurada } from '../../config/env.js';

const schemaPrompt = 'Responda somente JSON com summary (texto), deadlines, costs, warnings, action_items, evidence e document_type. Arrays vazios quando não houver dados.';
const parseTolerante = (content) => {
    const clean = String(content || '').replace(/```(?:json)?/gi, '').trim();
    const start = clean.indexOf('{'); const end = clean.lastIndexOf('}');
    if (start < 0 || end < start) throw new AppError('A IA retornou uma resposta inválida. Tente novamente.', 502);
    try { return JSON.parse(clean.slice(start, end + 1)); } catch { throw new AppError('A IA retornou uma resposta inválida. Tente novamente.', 502); }
};
async function call(url, options) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 60_000);
    try { const response = await fetch(url, { ...options, signal: controller.signal }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new AppError('Serviço de IA indisponível. Tente novamente.', 503); return data; }
    catch (error) { if (error.name === 'AbortError') throw new AppError('A análise demorou demais. Tente novamente.', 504); throw error; }
    finally { clearTimeout(timeout); }
}
export async function analisarDocumentoComIA(texto, documentType = 'outro') {
    let content; let raw;
    if (env.AI_PROVIDER === 'gemini') {
        if (!temGeminiConfigurada()) throw new AppError('Serviço Gemini não configurado', 503);
        const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`);
        raw = await call(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify({ systemInstruction: { parts: [{ text: schemaPrompt }] }, contents: [{ role: 'user', parts: [{ text: `Tipo: ${documentType}\n${texto}` }] }], generationConfig: { responseMimeType: 'application/json' } }) }); content = raw.candidates?.[0]?.content?.parts?.[0]?.text;
    } else {
        if (!temOpenAiConfigurada()) throw new AppError('Serviço OpenAI não configurado', 503);
        raw = await call('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: schemaPrompt }, { role: 'user', content: `Tipo: ${documentType}\n${texto}` }], response_format: { type: 'json_object' } }) }); content = raw.choices?.[0]?.message?.content;
    }
    const parsed = parseTolerante(content);
    if (typeof parsed.summary !== 'string') throw new AppError('A IA retornou uma análise incompleta. Tente novamente.', 502);
    return { summary: parsed.summary, deadlines: Array.isArray(parsed.deadlines) ? parsed.deadlines : [], costs: Array.isArray(parsed.costs) ? parsed.costs : [], warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [], action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [], evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [], document_type: typeof parsed.document_type === 'string' ? parsed.document_type : documentType, raw };
}
