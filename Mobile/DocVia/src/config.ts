import Constants from 'expo-constants';

// O URL da API deve ser definido em um só lugar.
// Se for colocar o backend em outra máquina ou hospedar em Supabase,
// basta alterar esta URL.
const manifest = Constants.expoConfig || Constants.manifest || {};
const apiUrl = (manifest.extra as { apiUrl?: string } | undefined)?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';

export const API_URL = apiUrl.replace(/\/+$/, '');

// O Render gratuito pode levar cerca de 50 segundos para reativar a API após
// um período sem uso. O limite maior evita um falso erro de conexão no
// primeiro acesso; requisições normais continuam terminando imediatamente.
export const API_TIMEOUT_MS = 75_000;
