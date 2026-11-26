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
} from '@clerk/expo';
import { tokenCache } from './tokenCache';

// Initialize web browser for OAuth redirects
WebBrowser.maybeCompleteAuthSession();

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
  tokenCache: cache = tokenCache,
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
      const redirectUrl = AuthSession.makeRedirectUri({
        path: 'sso-callback',
        scheme: 'eventflow',
      });

      const result = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });

      const sessionType = (result as any)?.authSessionResult?.type;
      if (sessionType === 'cancel' || sessionType === 'dismiss') {
        return { success: false, cancelled: true };
      }

      let createdSessionId: string | null = null;
      if (result?.createdSessionId && result?.setActive) {
        createdSessionId = result.createdSessionId;
        await result.setActive({ session: result.createdSessionId });
      }

      if (!createdSessionId) {
        // User backed out before completing Google sign-in
        return { success: false, cancelled: true };
      }

      const su = result?.signUp;
      const si = result?.signIn;

      const email =
        su?.emailAddress || si?.identifier || (su as any)?.emailAddresses?.[0]?.emailAddress || '';
      const fName = su?.firstName || (si as any)?.userData?.firstName || '';
      const lName = su?.lastName || (si as any)?.userData?.lastName || '';
      const name =
        [fName, lName].filter(Boolean).join(' ') || (email ? email.split('@')[0] : 'Google User');
      const profilePhoto = (su as any)?.imageUrl || (si as any)?.imageUrl || '';

      return {
        success: true,
        sessionId: createdSessionId,
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
