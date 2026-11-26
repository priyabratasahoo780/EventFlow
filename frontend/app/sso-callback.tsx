import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import LoadingScreen from '../components/LoadingScreen';

/**
 * Deep-link landing screen for Clerk OAuth callbacks (`eventflow://sso-callback`).
 * Prevents Expo Router from flashing a 404 NotFound screen while `startSSOFlow`
 * exchanges the OAuth session and updates `useAuthStore`.
 */
export default function SSOCallbackScreen() {
  const { token, user } = useAuthStore();

  useEffect(() => {
    // WebBrowser.openAuthSessionAsync completes in the background on login/register
  }, []);

  if (token) {
    if (user?.role === 'admin') {
      return <Redirect href={'/admin' as any} />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return <LoadingScreen message="Completing Google Sign-In..." />;
}
