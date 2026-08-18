import { resolveMx } from 'node:dns/promises';
import { domainToASCII } from 'node:url';
import { AppError } from '../../utils/erros.js';

const blockedDomains = new Set([
    'example.com', 'example.org', 'example.net', 'test.com', 'mailinator.com',
    'guerrillamail.com', '10minutemail.com', 'temp-mail.org', 'tempmail.com',
    'yopmail.com', 'trashmail.com', 'dispostable.com', 'maildrop.cc', 'fakeinbox.com',
]);

export async function validateEmailDomain(email, resolver = resolveMx) {
    const rawDomain = String(email || '').split('@').pop().trim().toLowerCase();
    const domain = domainToASCII(rawDomain);
    if (!domain || !domain.includes('.') || blockedDomains.has(domain) || /(?:^|\.)(?:example|invalid|test|localhost|local)$/.test(domain)) {
        throw new AppError('Use um e-mail com domínio real e permanente.', 400, 'EMAIL_DOMAIN_INVALID');
    }
    let timeout;
    try {
        const records = await Promise.race([
            resolver(domain),
            new Promise((_, reject) => { timeout = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), 5_000); }),
        ]);
        if (!Array.isArray(records) || !records.some((record) => record?.exchange)) throw new Error('sem MX');
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('O domínio deste e-mail não está preparado para receber mensagens.', 400, 'EMAIL_DOMAIN_INVALID');
    } finally {
        clearTimeout(timeout);
    }
    return domain;
}
