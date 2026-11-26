  
  // Fail-safe token storage with SecureStore support and reliable AsyncStorage fallback.
 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  SecureStore = require('expo-secure-store');
} catch {
  SecureStore = null;
}

const TOKEN_KEY = 'eventflow_auth_token';
const LEGACY_TOKEN_KEY = 'token';

export async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
    }

    if (SecureStore?.getItemAsync) {
      try {
        const secureToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (secureToken) return secureToken;

        const legacyToken = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
        if (legacyToken) {
          try {
            await SecureStore.setItemAsync(TOKEN_KEY, legacyToken);
            await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
          } catch {}
          return legacyToken;
        }
      } catch {
        // Fall back to AsyncStorage if SecureStore native call fails
      }
    }

    return await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
  } catch {
    return await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
  }
}

export async function setAuthToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  try {
    if (SecureStore?.setItemAsync) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
      return;
    }
  } catch {
    // Fall back to AsyncStorage
  }
  await AsyncStorage.setItem(LEGACY_TOKEN_KEY, token);
}

export async function removeAuthToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    return;
  }

  try {
    if (SecureStore?.deleteItemAsync) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {
    // Ignore SecureStore delete errors
  }
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
}

/**
 * Generate an 8-character Unique ID (2 upper, 2 lower, 2 digits, 2 symbols).
 */
export function generateSecureUniqueId(): string {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*_-';

  const getRandom = (set: string) => set[Math.floor(Math.random() * set.length)];

  const chars = [
    getRandom(uppers),
    getRandom(lowers),
    getRandom(numbers),
    getRandom(symbols),
    getRandom(uppers),
    getRandom(lowers),
    getRandom(numbers),
    getRandom(symbols),
  ];

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
