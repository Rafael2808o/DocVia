import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'docvia.onboarding-completed';

export async function hasCompletedOnboarding() {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) === 'true';
  return await SecureStore.getItemAsync(KEY) === 'true';
}

export async function completeOnboarding() {
  if (Platform.OS === 'web') return globalThis.localStorage?.setItem(KEY, 'true');
  return SecureStore.setItemAsync(KEY, 'true');
}
