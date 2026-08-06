import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS = 'docvia.access-token';
const REFRESH = 'docvia.refresh-token';
const USER = 'docvia.user';
let memorySession = null;
const expirationListeners = new Set();
const native = Platform.OS !== 'web';

async function read(key) { return native ? SecureStore.getItemAsync(key) : globalThis.localStorage?.getItem(key) || null; }
async function write(key, value) { if (native) return SecureStore.setItemAsync(key, value); globalThis.localStorage?.setItem(key, value); }
async function remove(key) { if (native) return SecureStore.deleteItemAsync(key); globalThis.localStorage?.removeItem(key); }

export async function loadSession() {
  const [accessToken, refreshToken, serializedUser] = await Promise.all([read(ACCESS), read(REFRESH), read(USER)]);
  let user;
  try { user = serializedUser ? JSON.parse(serializedUser) : undefined; } catch { user = undefined; }
  memorySession = accessToken && refreshToken ? { accessToken, refreshToken, user } : null;
  return memorySession;
}

export async function saveSession(session) {
  memorySession = session;
  const writes = [write(ACCESS, session.accessToken), write(REFRESH, session.refreshToken)];
  if (session.user) writes.push(write(USER, JSON.stringify(session.user)));
  await Promise.all(writes);
}

// A sessão só é removida pelo logout explícito ou pela exclusão da conta.
export async function clearSession() { memorySession = null; await Promise.all([remove(ACCESS), remove(REFRESH), remove(USER)]); }
export const getSession = () => memorySession;
export const subscribeSessionExpiration = (listener) => { expirationListeners.add(listener); return () => expirationListeners.delete(listener); };
export async function expireSession() { await clearSession(); expirationListeners.forEach((listener) => listener()); }
