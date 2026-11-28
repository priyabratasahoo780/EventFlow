// Fail-safe token storage with in-memory session cache, SecureStore encryption, and AsyncStorage fallback.

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

// Fast in-memory token cache guarantees Authorization headers work immediately after login/signup
// even if native SecureStore I/O is slow or temporarily unavailable on Android.
let memoryToken: string | null = null;

export async function getAuthToken(): Promise<string | null> {
  if (memoryToken) {
    return memoryToken;
  }

  try {
    if (Platform.OS === 'web') {
      const webToken = localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
      if (webToken) memoryToken = webToken;
      return webToken;
    }

    if (SecureStore?.getItemAsync) {
      try {
        const secureToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (secureToken) {
          memoryToken = secureToken;
          return secureToken;
        }
      } catch {
        // Fall through to AsyncStorage fallback
      }
    }

    const fallbackToken = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
    if (fallbackToken) {
      memoryToken = fallbackToken;
      return fallbackToken;
    }

    return null;
  } catch {
    try {
      const legacy = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
      if (legacy) memoryToken = legacy;
      return legacy;
    } catch {
      return null;
    }
  }
}

export async function setAuthToken(token: string): Promise<void> {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid authentication token.');
  }

  memoryToken = token;

  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  let savedToSecureStore = false;
  try {
    if (SecureStore?.setItemAsync) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      const verify = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      if (verify === token) {
        savedToSecureStore = true;
      }
    }
  } catch {
    savedToSecureStore = false;
  }

  if (savedToSecureStore) {
    try {
      await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {}
  } else {
    await AsyncStorage.setItem(LEGACY_TOKEN_KEY, token);
  }
}

export async function removeAuthToken(): Promise<void> {
  memoryToken = null;

  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {}
    return;
  }

  try {
    if (SecureStore?.deleteItemAsync) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {
    // Ignore SecureStore delete errors
  }

  try {
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Ignore AsyncStorage delete errors
  }
}

  // Generate an 8-character Unique ID (2 upper, 2 lower, 2 digits, 2 symbols).
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
