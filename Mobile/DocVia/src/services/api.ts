import { API_TIMEOUT_MS, API_URL } from '../config';
import { expireSession, getSession, saveSession } from './session';

async function request(path: string, options: RequestInit = {}, retry = true): Promise<any> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const headers = new Headers(options.headers); const current = getSession();
    if (current?.accessToken) headers.set('Authorization', `Bearer ${current.accessToken}`);
    const response = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
    const authRejected = response.status === 401 || response.status === 403;
    if (authRejected && retry && current?.refreshToken) { try { const refreshed = await request('/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: current.refreshToken }) }, false); await saveSession({ ...current, accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token }); return request(path, options, false); } catch (error: any) { if (error.status === 401 || error.status === 403) await expireSession(); throw error; } }
    if (authRejected && current?.refreshToken) await expireSession();
    const data = await response.json().catch(() => ({})); if (!response.ok) { const error: any = new Error(data.message || 'Não foi possível concluir a operação.'); error.status = response.status; throw error; } return data;
  } catch (error: any) { if (error.name === 'AbortError') throw new Error('A conexão demorou demais. Tente novamente.'); if (error instanceof TypeError) throw new Error('Você parece estar offline. Verifique sua conexão.'); throw error; } finally { clearTimeout(timeout); }
}
export const authApi = { login: (email: string, senha: string) => request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }) }), register: (nome: string, email: string, senha: string) => request('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, email, senha }) }), forgotPassword: (email: string) => request('/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }), resetPassword: (token: string, senha: string) => request('/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, senha }) }), logout: (refresh_token: string) => request('/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token }) }) };
export const documentsApi = { list: () => request('/documents'), deadlines: () => request('/documents/deadlines/upcoming?days=30'), detail: (id: string) => request(`/documents/${id}`), job: (id: string) => request(`/documents/jobs/${id}`), boleto: (id: string) => request(`/documents/${id}/boleto`), retry: (id: string) => request(`/documents/${id}/retry`, { method: 'POST' }), remove: (id: string) => request(`/documents/${id}`, { method: 'DELETE' }), upload: (file: any, document_type: string) => { const body = new FormData(); body.append('arquivo', file); body.append('document_type', document_type); return request('/documents', { method: 'POST', body }); } };
export const userApi = {
  me: () => request('/users/me'),
  usage: () => request('/usage'),
  consent: () => request('/users/privacy-consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accepted: true }) }),
  privacyPolicy: () => request('/users/privacy-policy'),
  exportData: () => request('/users/me/export'),
  deleteAccount: (password: string) => request('/users/me', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }),
};
export const billingApi = { plan: () => request('/billing/plan'), subscriptions: () => request('/billing/subscriptions') };
