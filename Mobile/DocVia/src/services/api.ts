import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';

import { API_TIMEOUT_MS, API_URL } from '../config';
import { expireSession, getSession, saveSession } from './session';

let refreshInFlight: Promise<any> | null = null;

function httpError(data: any, status: number) {
  let message = String(data.message || 'Não foi possível concluir a operação.');
  if (/rota\s+(?:GET|POST|PUT|PATCH|DELETE)\s+\S+\s+não encontrada|route\s+\S+\s+not found/i.test(message)) {
    message = 'Este recurso ainda não está disponível. Atualize o aplicativo ou tente novamente mais tarde.';
  }
  const error: any = new Error(message);
  error.status = status;
  error.code = data.code;
  return error;
}

async function refreshAccess(session: any) {
  const latest = getSession();
  if (latest?.refreshToken && latest.refreshToken !== session.refreshToken) return latest;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refreshToken }), signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw httpError(data, response.status);
        const next = { ...session, accessToken: data.access_token, refreshToken: data.refresh_token };
        await saveSession(next);
        return next;
      } catch (error: any) {
        if (error.name === 'AbortError') throw new Error('A conexão demorou demais. Tente novamente.');
        if (error instanceof TypeError) throw new Error('Você parece estar offline. Verifique sua conexão.');
        throw error;
      } finally { clearTimeout(timeout); }
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function request(path: string, options: RequestInit = {}, retry = true): Promise<any> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const headers = new Headers(options.headers); const current = getSession();
    if (current?.accessToken) headers.set('Authorization', `Bearer ${current.accessToken}`);
    const response = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    const authRejected = response.status === 401 || (response.status === 403 && /token\s+(?:inválido|invalido|expirado)|token não fornecido/i.test(String(data.message || '')));
    if (authRejected && retry && current?.refreshToken) {
      try { await refreshAccess(current); return request(path, options, false); }
      catch (error: any) { if (error.status === 401 || error.status === 403) await expireSession(); throw error; }
    }
    if (!response.ok) {
      if (authRejected && current?.refreshToken) await expireSession();
      throw httpError(data, response.status);
    }
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') throw new Error('A conexão demorou demais. Tente novamente.');
    if (error instanceof TypeError) throw new Error('Você parece estar offline. Verifique sua conexão.');
    throw error;
  } finally { clearTimeout(timeout); }
}

async function requestFile(path: string, retry = true): Promise<Response> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const current = getSession();
    const headers = new Headers();
    if (current?.accessToken) headers.set('Authorization', `Bearer ${current.accessToken}`);
    const response = await fetch(`${API_URL}${path}`, { headers, signal: controller.signal });
    if ((response.status === 401 || response.status === 403) && retry && current?.refreshToken) {
      await refreshAccess(current);
      return requestFile(path, false);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw httpError(data, response.status);
    }
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') throw new Error('A conexão demorou demais. Tente novamente.');
    if (error instanceof TypeError) throw new Error('Você parece estar offline. Verifique sua conexão.');
    throw error;
  } finally { clearTimeout(timeout); }
}

export const authApi = {
  login: (email: string, senha: string) => request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }) }),
  register: (nome: string, email: string, senha: string) => request('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, email, senha }) }),
  forgotPassword: (email: string) => request('/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }),
  resetPassword: (token: string, senha: string) => request('/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, senha }) }),
  resendVerification: (email: string) => request('/auth/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }),
  verifyEmail: (token: string) => request('/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }),
  logout: (refresh_token: string) => request('/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token }) }),
};

export const documentsApi = {
  list: () => request('/documents'), deadlines: () => request('/documents/deadlines/upcoming?days=30'), detail: (id: string) => request(`/documents/${id}`), file: (id: string) => requestFile(`/documents/${id}/file`), job: (id: string) => request(`/documents/jobs/${id}`), boleto: (id: string) => request(`/documents/${id}/boleto`), retry: (id: string) => request(`/documents/${id}/retry`, { method: 'POST' }), remove: (id: string) => request(`/documents/${id}`, { method: 'DELETE' }), upload: (file: any, document_type: string) => {
    const body = new FormData();
    const uploadPart = Platform.OS === 'web' && file.webFile
      ? file.webFile
      : new ExpoFile(file.uri);
    body.append('arquivo', uploadPart as Blob, file.name);
    body.append('document_type', document_type);
    return request('/documents', { method: 'POST', body });
  }, uploadText: (text: string, document_type: string) => request('/documents/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, document_type }) }),
};

export const userApi = {
  me: () => request('/users/me'), usage: () => request('/usage'), consent: () => request('/users/privacy-consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accepted: true }) }), privacyPolicy: () => request('/users/privacy-policy'), exportData: () => request('/users/me/export'), deleteAccount: (password: string) => request('/users/me', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }),
};

export const billingApi = { plan: () => request('/billing/plan'), subscriptions: () => request('/billing/subscriptions') };
