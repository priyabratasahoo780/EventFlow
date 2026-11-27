import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
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

// Warm up the browser for faster OAuth popups on Android
export const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== 'web') {
      void WebBrowser.warmUpAsync();
      return () => {
        void WebBrowser.coolDownAsync();
      };
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
    console.warn('[Clerk] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Please set it in your .env file.');
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

export const useGoogleAuth = () => {
  useWarmUpBrowser();
  const { startSSOFlow } = useExpoSSO();

  const signInWithGoogle = async (): Promise<GoogleAuthResult> => {
    try {
      // Automatically resolves to eventflow://sso-callback in standalone APK and exp://.../sso-callback in Expo Go
      const redirectUrl = AuthSession.makeRedirectUri({
        path: 'sso-callback',
      });

      // Wrap startSSOFlow with a 60s timeout — without this, if the deep-link
      // back from the browser never fires, the spinner hangs indefinitely.
      const result = await Promise.race([
        startSSOFlow({ strategy: 'oauth_google', redirectUrl }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Google Sign-In timed out. Please try again.')),
            60000
          )
        ),
      ]);

      const sessionType = (result as any)?.authSessionResult?.type;
      if (sessionType === 'cancel' || sessionType === 'dismiss') {
        return { success: false, cancelled: true };
      }

      const su = result?.signUp;
      const si = result?.signIn;

      // Detect Clerk Dashboard requirements blocking SSO (e.g., required phone_number or missing redirect_url)
      if (!result?.createdSessionId) {
        if (!result?.authSessionResult) {
          throw new Error(
            'Google Sign-In is still initializing or could not connect to authentication service. Please wait a second and try again.'
          );
        }

        if (su?.status === 'missing_requirements') {
          const missingList = [
            ...(Array.isArray((su as any).missingFields) ? (su as any).missingFields : []),
            ...(Array.isArray((su as any).unverifiedFields) ? (su as any).unverifiedFields : []),
          ].filter(Boolean);
          const uniqueMissing = Array.from(new Set(missingList));
          const missing = uniqueMissing.length > 0
            ? uniqueMissing.join(', ')
            : 'additional profile verification (e.g., phone_number)';
          throw new Error(
            `Google Sign-Up could not complete because Clerk requires: ${missing}. Make Phone Number optional in Clerk Dashboard.`
          );
        }

        if (result?.authSessionResult?.type === 'success') {
          throw new Error(
            `Google OAuth returned without a session. Make sure redirect URL "${redirectUrl}" is whitelisted in Clerk Dashboard -> Native Applications.`
          );
        }

        return { success: false, cancelled: true };
      }

      if (result?.setActive) {
        try {
          await result.setActive({ session: result.createdSessionId });
        } catch (setActiveErr) {
          console.warn('[Google OAuth] setActive warning:', setActiveErr);
          // Non-fatal: session may already be active
        }
      }

      // Prefer signUp/signIn data (immediately available) over Clerk instance (may not be hydrated yet)
      const email =
        su?.emailAddress ||
        si?.identifier ||
        (su as any)?.emailAddresses?.[0]?.emailAddress ||
        (() => {
          try { return getClerkInstance()?.user?.primaryEmailAddress?.emailAddress; } catch { return ''; }
        })() ||
        '';
      const fNameRaw = su?.firstName || (si as any)?.userData?.firstName || '';
      const lNameRaw = su?.lastName || (si as any)?.userData?.lastName || '';
      const clerkFullName = (() => {
        try { return getClerkInstance()?.user?.fullName || ''; } catch { return ''; }
      })();
      const name =
        clerkFullName ||
        [fNameRaw, lNameRaw].filter(Boolean).join(' ') ||
        (email ? email.split('@')[0] : 'Google User');
      const profilePhoto =
        (su as any)?.imageUrl ||
        (si as any)?.imageUrl ||
        (() => {
          try { return getClerkInstance()?.user?.imageUrl || ''; } catch { return ''; }
        })() ||
        '';

      return {
        success: true,
        sessionId: result.createdSessionId,
        user: {
          email,
          name,
          profilePhoto,
        },
      };
    } catch (err: any) {
      const rawMsg = String(err?.message || '').toLowerCase();
      const errCode = String(err?.code || '');
      const isCancelled =
        errCode === 'ERR_REQUEST_CANCELED' ||
        rawMsg.includes('cancel') ||
        rawMsg.includes('dismiss');

      if (isCancelled) {
        return { success: false, cancelled: true };
      }

      console.warn('[Google OAuth Flow Error]:', err?.message || err);
      throw new Error(
        err?.errors?.[0]?.longMessage ||
          err?.errors?.[0]?.message ||
          err?.message ||
          'Google sign-in could not be completed. Please check your connection and try again.'
      );
    }
  };

  return { signInWithGoogle };
};

export const useOAuth = useExpoOAuth;
export const useSSO = useExpoSSO;

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
