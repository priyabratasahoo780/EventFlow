import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
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

WebBrowser.maybeCompleteAuthSession();

// does not tear down the Android Custom Tabs service mid-flow.
let warmUpRefCount = 0;

// Warm up Chrome Custom Tabs on Android for faster popup open
export const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    warmUpRefCount += 1;
    if (warmUpRefCount === 1) {
      void WebBrowser.warmUpAsync().catch(() => {});
    }
    return () => {
      warmUpRefCount = Math.max(0, warmUpRefCount - 1);
      if (warmUpRefCount === 0) {
        void WebBrowser.coolDownAsync().catch(() => {});
      }
    };
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


function getOAuthRedirectUrl(): string {
  return Linking.createURL('sso-callback');
}

export const useGoogleAuth = () => {
  useWarmUpBrowser();
  const { startSSOFlow } = useExpoSSO();

  const signInWithGoogle = async (): Promise<GoogleAuthResult> => {
    try {
      const redirectUrl = getOAuthRedirectUrl();
      if (__DEV__) {
        console.log('[Google OAuth] Starting flow', {
          platform: Platform.OS,
          redirectUrl,
        });
      }

      let capturedCallbackUrl: string | null = null;
      const urlSub = Linking.addEventListener('url', (event) => {
        if (event?.url?.includes('sso-callback')) {
          capturedCallbackUrl = event.url;
          if (__DEV__) console.log('[Google OAuth] Callback URL received:', event.url.split('?')[0]);
        }
      });

      let result: any;
      try {
        result = await Promise.race([
          startSSOFlow({ strategy: 'oauth_google', redirectUrl }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Google Sign-In timed out. Please try again.')),
              65000
            )
          ),
        ]);
      } finally {
        urlSub.remove();
      }

      const sessionType = (result as any)?.authSessionResult?.type;
      const su = result?.signUp;
      const si = result?.signIn;

      if (__DEV__) {
        console.log('[Google OAuth] Flow result', {
          authSessionType: sessionType ?? null,
          capturedCallbackUrl: !!capturedCallbackUrl,
          createdSessionId: result?.createdSessionId ?? null,
          signInStatus: si?.status ?? null,
          signInVerificationStatus: si?.firstFactorVerification?.status ?? null,
          signUpStatus: su?.status ?? null,
          signUpMissingFields: (su as any)?.missingFields ?? null,
          signUpUnverifiedFields: (su as any)?.unverifiedFields ?? null,
        });
      }

      if (sessionType === 'cancel' || sessionType === 'dismiss') {
        return { success: false, cancelled: true };
      }

      //  No session created 
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

      // ── Session created — activate it 
      if (result?.setActive) {
        await result.setActive({ session: result.createdSessionId });
      }

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

      console.warn('[Google OAuth Error]:', {
        status: err?.status ?? null,
        code: errCode || null,
        clerkErrors: err?.errors ?? null,
        message: err?.message ?? null,
      });
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
