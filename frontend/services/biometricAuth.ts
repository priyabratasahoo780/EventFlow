/**
 * biometricAuth.ts
 * Crash-proof biometric (Fingerprint) & device pattern/PIN lock helper with Admin lock config storage.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';

const ADMIN_VAULT_TOKEN_KEY = 'eventflow_admin_vault_token';
const ADMIN_VAULT_USER_KEY = 'eventflow_admin_vault_user';
const ADMIN_LOCK_CONFIG_KEY = 'eventflow_admin_lock_config';

export interface AdminLockConfig {
  enabled: boolean;            // Master lock ON/OFF (defaults to false — normal email/password login first)
  allowFingerprint: boolean;   // Option 1: Fingerprint / Biometric
  allowDevicePattern: boolean; // Option 2: Phone Pattern / Device PIN
  allowPassword: boolean;      // Option 3: Normal Admin Password
}

export const DEFAULT_ADMIN_LOCK_CONFIG: AdminLockConfig = {
  enabled: false,
  allowFingerprint: true,
  allowDevicePattern: true,
  allowPassword: true,
};

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
  deviceSecurityAvailable: boolean;
  label: string;
}

export async function getBiometricCapabilities(): Promise<BiometricCapabilities> {
  const LocalAuth = getNativeLocalAuth();
  if (!LocalAuth) {
    return {
      available: false,
      hasHardware: false,
      isEnrolled: false,
      deviceSecurityAvailable: false,
      label: 'Fingerprint',
    };
  }

  try {
    const [hasHardware, isEnrolled, types, enrolledLevel] = await Promise.all([
      LocalAuth.hasHardwareAsync(),
      LocalAuth.isEnrolledAsync(),
      LocalAuth.supportedAuthenticationTypesAsync(),
      LocalAuth.getEnrolledLevelAsync().catch(() => LocalAuth.SecurityLevel.NONE),
    ]);

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
      deviceSecurityAvailable: enrolledLevel !== LocalAuth.SecurityLevel.NONE,
      label,
    };
  } catch {
    return {
      available: false,
      hasHardware: false,
      isEnrolled: false,
      deviceSecurityAvailable: false,
      label: 'Fingerprint',
    };
  }
}

export async function authenticateWithBiometrics(
  promptMessage = 'Scan Fingerprint to unlock EventFlow Admin Portal',
  options?: { allowDeviceCredentialFallback?: boolean }
): Promise<{ success: boolean; unavailable?: boolean; error?: string }> {
  const LocalAuth = getNativeLocalAuth();
  if (!LocalAuth) {
    return {
      success: false,
      unavailable: true,
      error: 'Phone biometric/pattern prompt is unavailable in this runtime. Use Normal Admin Password.',
    };
  }

  try {
    const allowFallback = options?.allowDeviceCredentialFallback ?? true;
    const caps = await getBiometricCapabilities();

    if (!allowFallback && !caps.available) {
      return {
        success: false,
        unavailable: true,
        error: 'No fingerprint enrolled on this device.',
      };
    }

    if (allowFallback && !caps.available && !caps.deviceSecurityAvailable) {
      return {
        success: false,
        unavailable: true,
        error: 'No phone screen lock (Pattern / PIN) or fingerprint set up on this device.',
      };
    }

    const result = await LocalAuth.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Phone Pattern / PIN',
      disableDeviceFallback: !allowFallback,
    });

    if (result.success) {
      return { success: true };
    }

    return {
      success: false,
      error: result.error === 'user_cancel' ? 'Authentication cancelled.' : 'Verification failed.',
    };
  } catch (err: any) {
    return {
      success: false,
      unavailable: true,
      error: err?.message || 'Biometric/pattern authentication error.',
    };
  }
}

export async function authenticateWithDevicePatternOrPin(
  promptMessage = 'Use your Phone Pattern, PIN, or Passcode to unlock Admin Portal'
): Promise<{ success: boolean; unavailable?: boolean; error?: string }> {
  return authenticateWithBiometrics(promptMessage, { allowDeviceCredentialFallback: true });
}

export async function getAdminLockConfig(): Promise<AdminLockConfig> {
  try {
    const raw = await AsyncStorage.getItem(ADMIN_LOCK_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_ADMIN_LOCK_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      allowFingerprint: parsed.allowFingerprint !== false,
      allowDevicePattern: parsed.allowDevicePattern !== false,
      allowPassword: parsed.allowPassword !== false,
    };
  } catch {
    return { ...DEFAULT_ADMIN_LOCK_CONFIG };
  }
}

export async function saveAdminLockConfig(config: AdminLockConfig): Promise<void> {
  await AsyncStorage.setItem(ADMIN_LOCK_CONFIG_KEY, JSON.stringify(config));
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
  const cfg = await getAdminLockConfig();
  return cfg.enabled;
}

export async function setAdminBiometricLockEnabled(enabled: boolean): Promise<void> {
  const cfg = await getAdminLockConfig();
  await saveAdminLockConfig({ ...cfg, enabled });
}
