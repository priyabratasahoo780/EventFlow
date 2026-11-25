/**
 * biometricAuth.ts
 * Crash-proof biometric (Fingerprint / FaceID) authentication wrapper and encrypted Admin Vault storage.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';

const ADMIN_VAULT_TOKEN_KEY = 'eventflow_admin_vault_token';
const ADMIN_VAULT_USER_KEY = 'eventflow_admin_vault_user';
const ADMIN_LOCK_ENABLED_KEY = 'eventflow_admin_biometric_lock';

function getNativeLocalAuth(): typeof import('expo-local-authentication') | null {
  if (Platform.OS === 'web') return null;
  try {
    const mod = requireOptionalNativeModule('ExpoLocalAuthentication');
    if (!mod) return null;
    return require('expo-local-authentication');
  } catch {
    return null;
  }
}

function getSecureStore(): typeof import('expo-secure-store') | null {
  if (Platform.OS === 'web') return null;
  try {
    const mod = requireOptionalNativeModule('ExpoSecureStore');
    if (!mod) return null;
    return require('expo-secure-store');
  } catch {
    return null;
  }
}

export interface BiometricCapabilities {
  available: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  label: string;
}

export async function getBiometricCapabilities(): Promise<BiometricCapabilities> {
  const LocalAuth = getNativeLocalAuth();
  if (!LocalAuth) {
    return { available: false, hasHardware: false, isEnrolled: false, label: 'Biometric' };
  }

  try {
    const hasHardware = await LocalAuth.hasHardwareAsync();
    const isEnrolled = await LocalAuth.isEnrolledAsync();
    const types = await LocalAuth.supportedAuthenticationTypesAsync();

    let label = 'Fingerprint / Biometric';
    if (types.includes(LocalAuth.AuthenticationType.FINGERPRINT)) {
      label = 'Fingerprint';
    } else if (types.includes(LocalAuth.AuthenticationType.FACIAL_RECOGNITION)) {
      label = 'Face ID';
    }

    return {
      available: hasHardware && isEnrolled,
      hasHardware,
      isEnrolled,
      label,
    };
  } catch {
    return { available: false, hasHardware: false, isEnrolled: false, label: 'Biometric' };
  }
}

export async function authenticateWithBiometrics(
  promptMessage = 'Scan Fingerprint to unlock EventFlow Admin Portal'
): Promise<{ success: boolean; unavailable?: boolean; error?: string }> {
  const LocalAuth = getNativeLocalAuth();
  if (!LocalAuth) {
    return {
      success: false,
      unavailable: true,
      error: 'Biometric scanner is unavailable in this runtime. Please verify with Admin Password.',
    };
  }

  try {
    const caps = await getBiometricCapabilities();
    if (!caps.available) {
      return {
        success: false,
        unavailable: true,
        error: caps.hasHardware
          ? 'No fingerprint enrolled on this device. Please verify with Admin Password.'
          : 'Biometric hardware not found on this device. Please verify with Admin Password.',
      };
    }

    const result = await LocalAuth.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use Password',
      fallbackLabel: 'Use Device PIN',
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    }

    return {
      success: false,
      error: result.error === 'user_cancel' ? 'Fingerprint scan cancelled.' : 'Fingerprint authentication failed.',
    };
  } catch (err: any) {
    return {
      success: false,
      unavailable: true,
      error: err?.message || 'Biometric authentication error.',
    };
  }
}

export async function saveAdminVaultSession(token: string, user: any): Promise<void> {
  if (!token || !user || user.role !== 'admin') return;
  const serializedUser = JSON.stringify(user);

  const SecureStore = getSecureStore();
  if (SecureStore?.setItemAsync) {
    try {
      await SecureStore.setItemAsync(ADMIN_VAULT_TOKEN_KEY, token, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
      await AsyncStorage.setItem(ADMIN_VAULT_USER_KEY, serializedUser);
      return;
    } catch {
      // Fall back to AsyncStorage
    }
  }

  await AsyncStorage.setItem(ADMIN_VAULT_TOKEN_KEY, token);
  await AsyncStorage.setItem(ADMIN_VAULT_USER_KEY, serializedUser);
}

export async function getAdminVaultSession(): Promise<{ token: string; user: any } | null> {
  try {
    let token: string | null = null;
    const SecureStore = getSecureStore();

    if (SecureStore?.getItemAsync) {
      try {
        token = await SecureStore.getItemAsync(ADMIN_VAULT_TOKEN_KEY);
      } catch {}
    }
    if (!token) {
      token = await AsyncStorage.getItem(ADMIN_VAULT_TOKEN_KEY);
    }

    const userStr = await AsyncStorage.getItem(ADMIN_VAULT_USER_KEY);
    if (!token || !userStr) return null;

    const user = JSON.parse(userStr);
    if (user?.role !== 'admin') return null;

    return { token, user };
  } catch {
    return null;
  }
}

export async function clearAdminVaultSession(): Promise<void> {
  const SecureStore = getSecureStore();
  if (SecureStore?.deleteItemAsync) {
    try {
      await SecureStore.deleteItemAsync(ADMIN_VAULT_TOKEN_KEY);
    } catch {}
  }
  await AsyncStorage.multiRemove([ADMIN_VAULT_TOKEN_KEY, ADMIN_VAULT_USER_KEY]);
}

export async function isAdminBiometricLockEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(ADMIN_LOCK_ENABLED_KEY);
    return val === null ? true : JSON.parse(val);
  } catch {
    return true;
  }
}

export async function setAdminBiometricLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ADMIN_LOCK_ENABLED_KEY, JSON.stringify(enabled));
}
