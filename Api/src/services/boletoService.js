import { AppError } from '../../utils/erros.js';

const DATA_REGEX = /([0-3]?\d)[/\-]([0-1]?\d)[/\-]((?:20)?\d{2})/g;
const VALOR_REGEX = /R\$\s?([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+(?:[.,][0-9]{2}))/g;

export function parseBoletoInfo(text) {
    if (!text || typeof text !== 'string') {
        throw new AppError('Texto do boleto não disponível para extração', 422);
    }

    const textoLimpo = text.replace(/\s+/g, ' ').trim();
    const datas = [];
    let match;

    while ((match = DATA_REGEX.exec(textoLimpo)) !== null) {
        const dia = match[1].padStart(2, '0');
        const mes = match[2].padStart(2, '0');
        let ano = match[3];
        if (ano.length === 2) ano = `20${ano}`;
        const data = `${ano}-${mes}-${dia}`;
        datas.push(data);
    }

    const valores = [];
    while ((match = VALOR_REGEX.exec(textoLimpo)) !== null) {
        valores.push(match[1].replace('.', '').replace(',', '.'));
    }

    const vencimento = datas.find((data) => !!data) || null;
    const valor = valores.length > 0 ? valores[0] : null;

    if (!vencimento && !valor) {
        throw new AppError('Não foi possível extrair informações do boleto', 422);
    }

    return {
        due_date: vencimento,
        amount: valor,
        raw_text: textoLimpo,
    };
}
