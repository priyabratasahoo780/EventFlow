import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import {
  ClerkProvider as ExpoClerkProvider,
  ClerkLoaded as ExpoClerkLoaded,
  useSSO as useExpoSSO,
  useOAuth as useExpoOAuth,
  useUser as useExpoUser,
  useAuth as useExpoAuth,
  useSignIn as useExpoSignIn,
  useSignUp as useExpoSignUp,
  getClerkInstance,
} from '@clerk/expo';
import { tokenCache as defaultClerkTokenCache } from '@clerk/expo/token-cache';

// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL: Call this at module level, not inside a component / effect.
// Without it, expo-web-browser never signals the OAuth popup to close after
// the user picks a Google account, causing the spinner to hang forever.
// ─────────────────────────────────────────────────────────────────────────────
WebBrowser.maybeCompleteAuthSession();

// Warm up Chrome Custom Tabs on Android for faster popup open
export const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== 'web') {
      void WebBrowser.warmUpAsync();
      return () => { void WebBrowser.coolDownAsync(); };
    }
  }, []);
};

export const ClerkProvider = ({
  children,
  publishableKey,
  tokenCache: cache = defaultClerkTokenCache,
}: {
  children: React.ReactNode;
  publishableKey?: string;
  tokenCache?: any;
}) => {
  const key = publishableKey || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  if (!key) {
    console.warn('[Clerk] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set.');
  }
  return (
    <ExpoClerkProvider publishableKey={key} tokenCache={cache}>
      {children}
    </ExpoClerkProvider>
  );
};

export const ClerkLoaded = ExpoClerkLoaded;
export const useUser = useExpoUser;
export const useAuth = useExpoAuth;
export const useSignIn = useExpoSignIn;
export const useSignUp = useExpoSignUp;

export interface GoogleAuthResult {
  success: boolean;
  cancelled?: boolean;
  sessionId?: string | null;
  user?: {
    email: string;
    name: string;
    profilePhoto: string;
  };
}

/**
 * Builds the redirect URI for Clerk OAuth.
 *
 * In a standalone / production APK → eventflow://sso-callback
 * In Expo Go                       → exp://192.x.x.x:8081/--/sso-callback
 *
 * Both are whitelisted in Clerk Dashboard's Redirect URLs.
 */
function getOAuthRedirectUrl(): string {
  // On native standalone builds, Linking.createURL gives eventflow://sso-callback
  // On Expo Go it gives exp://...
  return Linking.createURL('sso-callback');
}

export const useGoogleAuth = () => {
  useWarmUpBrowser();
  const { startSSOFlow } = useExpoSSO();

  const signInWithGoogle = async (): Promise<GoogleAuthResult> => {
    try {
      const redirectUrl = getOAuthRedirectUrl();

      // ── Start the OAuth browser flow ────────────────────────────────────────
      // We race against a 65-second hard timeout so the loading button never
      // gets permanently stuck if the deep-link back never fires.
      const result = await Promise.race([
        startSSOFlow({ strategy: 'oauth_google', redirectUrl }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Google Sign-In timed out. Please try again.')),
            65000
          )
        ),
      ]);

      // ── User cancelled / dismissed the browser ───────────────────────────────
      const sessionType = (result as any)?.authSessionResult?.type;
      if (sessionType === 'cancel' || sessionType === 'dismiss') {
        return { success: false, cancelled: true };
      }

      const su = result?.signUp;
      const si = result?.signIn;

      // ── No session created ───────────────────────────────────────────────────
      if (!result?.createdSessionId) {
        // authSessionResult is null ⟹ Clerk SDK not loaded yet, rare edge case
        if (!result?.authSessionResult) {
          return { success: false, cancelled: true };
        }

        // missing_requirements = Clerk Dashboard requires a field (e.g. phone)
        if (su?.status === 'missing_requirements') {
          const missingList = [
            ...(Array.isArray((su as any).missingFields)    ? (su as any).missingFields    : []),
            ...(Array.isArray((su as any).unverifiedFields) ? (su as any).unverifiedFields : []),
          ].filter(Boolean);
          const unique = Array.from(new Set(missingList));
          const missing = unique.length > 0
            ? unique.join(', ')
            : 'phone_number (set it to Optional in Clerk Dashboard)';
          throw new Error(
            `Google sign-up blocked — Clerk requires: ${missing}. ` +
            `Go to dashboard.clerk.com → Configure → Email, Phone, Username → Phone number → Optional.`
          );
        }

        // Browser returned "success" URL but no session = redirect URL mismatch
        if (result?.authSessionResult?.type === 'success') {
          throw new Error(
            `Google OAuth returned without a session. ` +
            `Make sure "${redirectUrl}" is listed in Clerk Dashboard → Redirect URLs.`
          );
        }

        // Any other non-success state → treat as silent cancel
        return { success: false, cancelled: true };
      }

      // ── Session created — activate it ────────────────────────────────────────
      if (result?.setActive) {
        try {
          await result.setActive({ session: result.createdSessionId });
        } catch (err) {
          console.warn('[Google OAuth] setActive warning (non-fatal):', err);
        }
      }

      // ── Extract user data ────────────────────────────────────────────────────
      // Prefer signIn/signUp resources which are available immediately after
      // the flow. Clerk instance user may not be hydrated yet at this point.
      const email =
        su?.emailAddress ||
        si?.identifier ||
        (su as any)?.emailAddresses?.[0]?.emailAddress ||
        (() => { try { return getClerkInstance()?.user?.primaryEmailAddress?.emailAddress || ''; } catch { return ''; } })();

      const fName = su?.firstName || (si as any)?.userData?.firstName || '';
      const lName = su?.lastName  || (si as any)?.userData?.lastName  || '';
      const clerkFullName = (() => { try { return getClerkInstance()?.user?.fullName || ''; } catch { return ''; } })();

      const name =
        clerkFullName ||
        [fName, lName].filter(Boolean).join(' ') ||
        (email ? email.split('@')[0] : 'Google User');

      const profilePhoto =
        (su as any)?.imageUrl ||
        (si as any)?.imageUrl ||
        (() => { try { return getClerkInstance()?.user?.imageUrl || ''; } catch { return ''; } })() ||
        '';

      return {
        success: true,
        sessionId: result.createdSessionId,
        user: { email, name, profilePhoto },
      };

    } catch (err: any) {
      const rawMsg  = String(err?.message || '').toLowerCase();
      const errCode = String(err?.code    || '');

      const isCancelled =
        errCode === 'ERR_REQUEST_CANCELED' ||
        rawMsg.includes('cancel') ||
        rawMsg.includes('dismiss');

      if (isCancelled) return { success: false, cancelled: true };

      console.warn('[Google OAuth Error]:', err?.message || err);
      throw new Error(
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message    ||
        err?.message                 ||
        'Google sign-in could not be completed. Please check your connection and try again.'
      );
    }
  };

  return { signInWithGoogle };
};

export const useOAuth = useExpoOAuth;
export const useSSO   = useExpoSSO;

export default {
  ClerkProvider,
  ClerkLoaded,
  useOAuth,
  useSSO,
  useAuth,
  useUser,
  useSignIn,
  useSignUp,
  useGoogleAuth,
  useWarmUpBrowser,
};
