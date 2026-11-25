/**
 * secureStorage.ts
 * Encrypted token storage using expo-secure-store and cryptographic ID generation.
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = 'eventflow_auth_token';
const LEGACY_TOKEN_KEY = 'token';

export async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
    }

    const secureToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (secureToken) return secureToken;

    // Seamless one-time migration from legacy AsyncStorage token
    const legacyToken = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacyToken) {
      await SecureStore.setItemAsync(TOKEN_KEY, legacyToken, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
      await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
      return legacyToken;
    }

    return null;
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
    await SecureStore.setItemAsync(TOKEN_KEY, token, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    await AsyncStorage.setItem(LEGACY_TOKEN_KEY, token);
  }
}

export async function removeAuthToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Ignore secure store deletion errors if key didn't exist
  }
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
}

/**
 * Generate a cryptographically random 8-character Unique ID (2 upper, 2 lower, 2 digits, 2 symbols).
 */
export function generateSecureUniqueId(): string {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*_-';
  const bytes = Crypto.getRandomBytes(16);

  const pick = (set: string, byteIdx: number) => set[bytes[byteIdx] % set.length];

  const chars = [
    pick(uppers, 0),
    pick(lowers, 1),
    pick(numbers, 2),
    pick(symbols, 3),
    pick(uppers, 4),
    pick(lowers, 5),
    pick(numbers, 6),
    pick(symbols, 7),
  ];

  // Fisher-Yates shuffle using remaining cryptographic random bytes
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[8 + i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
