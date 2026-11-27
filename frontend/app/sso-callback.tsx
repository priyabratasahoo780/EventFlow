import { useEffect } from 'react';
import { Redirect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../store/useAuthStore';
import LoadingScreen from '../components/LoadingScreen';

// ⚠️ CRITICAL: This MUST be called at module level (not inside a component/effect).
// Without this, expo-web-browser never signals the OAuth popup to close,
// and startSSOFlow hangs indefinitely — causing the "5-minute loading" bug.
WebBrowser.maybeCompleteAuthSession();

/**
 * Deep-link landing screen for Clerk OAuth callbacks (`eventflow://sso-callback`).
 * Prevents Expo Router from flashing a 404 NotFound screen while `startSSOFlow`
 * exchanges the OAuth session and updates `useAuthStore`.
 */
export default function SSOCallbackScreen() {
  const { token, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (token) return;
    const timeout = setTimeout(() => {
      if (!useAuthStore.getState().token) {
        router.replace('/(auth)/login');
      }
    }, 20000);
    return () => clearTimeout(timeout);
  }, [token, router]);

  if (token) {
    if (user?.role === 'admin') {
      return <Redirect href={'/admin' as any} />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return <LoadingScreen message="Completing Google Sign-In..." />;
}
