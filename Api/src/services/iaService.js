import { AppError } from '../../utils/erros.js';
import { env, temGeminiConfigurada, temOpenAiConfigurada } from '../../config/env.js';

const INSTRUCAO_SISTEMA =
    'Você é um assistente que explica documentos burocráticos (contratos, exames, boletos, termos de uso) ' +
    'em linguagem simples para leigos. Responda somente JSON válido com os campos: ' +
    'summary (string), deadlines (array de objetos {descricao, data}), ' +
    'costs (array de objetos {descricao, valor}), warnings (array de objetos {descricao}).';

async function chamarGemini(textoExtraido) {
    if (!temGeminiConfigurada()) throw new AppError('Serviço Gemini não configurado', 503);

    const url = new URL(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`
    );
    url.searchParams.set('key', env.GEMINI_API_KEY);

    const resposta = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: INSTRUCAO_SISTEMA }] },
            contents: [{ role: 'user', parts: [{ text: textoExtraido }] }],
            generationConfig: { responseMimeType: 'application/json' },
        }),
    });

    const dados = await resposta.json();
    if (!resposta.ok) throw new AppError('Serviço Gemini indisponível', 503);

    return {
        conteudo: dados.candidates?.[0]?.content?.parts?.[0]?.text,
        bruto: dados,
    };
}

async function chamarOpenAi(textoExtraido) {
    if (!temOpenAiConfigurada()) throw new AppError('Serviço OpenAI não configurado', 503);

    const resposta = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: INSTRUCAO_SISTEMA },
                { role: 'user', content: textoExtraido },
            ],
            response_format: { type: 'json_object' },
        }),
    });

    const dados = await resposta.json();
    if (!resposta.ok) throw new AppError('Serviço OpenAI indisponível', 503);

    return {
        conteudo: dados.choices?.[0]?.message?.content,
        bruto: dados,
    };
}

export async function analisarDocumentoComIA(textoExtraido) {
    const resultado = env.AI_PROVIDER === 'gemini'
        ? await chamarGemini(textoExtraido)
        : await chamarOpenAi(textoExtraido);

    if (!resultado.conteudo) {
        throw new AppError('Resposta inválida recebida do serviço de IA', 502);
    }

    let conteudo;
    try {
        conteudo = JSON.parse(resultado.conteudo);
    } catch {
        throw new AppError('Resposta inválida recebida do serviço de IA', 502);
    }

    if (typeof conteudo.summary !== 'string') {
        throw new AppError('Resposta incompleta recebida do serviço de IA', 502);
    }

    return {
        summary: conteudo.summary,
        deadlines: Array.isArray(conteudo.deadlines) ? conteudo.deadlines : [],
        costs: Array.isArray(conteudo.costs) ? conteudo.costs : [],
        warnings: Array.isArray(conteudo.warnings) ? conteudo.warnings : [],
        raw: resultado.bruto,
    };
}
