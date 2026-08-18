const blockedDomains = new Set([
  'example.com', 'example.org', 'example.net', 'test.com',
  'mailinator.com', 'guerrillamail.com', '10minutemail.com',
  'temp-mail.org', 'tempmail.com', 'yopmail.com', 'trashmail.com',
  'dispostable.com', 'maildrop.cc', 'fakeinbox.com',
]);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function validateRegistrationEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!emailPattern.test(email)) throw new Error('Informe um e-mail válido.');

  const domain = email.split('@')[1];
  if (blockedDomains.has(domain) || domain.endsWith('.test') || domain.endsWith('.invalid')) {
    throw new Error('Use um e-mail real de um provedor que possa receber mensagens.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, {
      headers: { Accept: 'application/dns-json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('DNS_UNAVAILABLE');
    const result = await response.json();
    const acceptsEmail = result.Status === 0 && Array.isArray(result.Answer)
      && result.Answer.some((answer) => answer.type === 15 && String(answer.data || '').trim());
    if (!acceptsEmail) throw new Error('EMAIL_DOMAIN_INVALID');
  } catch (error) {
    if (error.message === 'EMAIL_DOMAIN_INVALID') {
      throw new Error('O domínio deste e-mail não existe ou não recebe mensagens.');
    }
    throw new Error('Não foi possível validar o e-mail agora. Confira sua internet e tente novamente.');
  } finally {
    clearTimeout(timeout);
  }

  return email;
}
