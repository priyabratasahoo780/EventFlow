/**
 * clerkAuth.tsx
 * Clerk authentication provider, session management, and Google OAuth flow.
 */
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
  useSignUp as useExpoSignUp
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

/**
 * Custom Hook for Google OAuth with Clerk & FocusFlow Backend integration
 */
export const useGoogleAuth = () => {
  useWarmUpBrowser();
  const { startSSOFlow } = useExpoSSO();

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        path: 'sso-callback',
        scheme: 'eventflow',
      });

      let createdSessionId: string | null = null;
      let email = '';
      let name = '';
      let profilePhoto = '';

      try {
        const result = await startSSOFlow({
          strategy: 'oauth_google',
          redirectUrl,
        });

        if (result?.createdSessionId && result?.setActive) {
          createdSessionId = result.createdSessionId;
          await result.setActive({ session: result.createdSessionId });
        }

        const su = result?.signUp;
        const si = result?.signIn;

        email = su?.emailAddress || si?.identifier || (su as any)?.emailAddresses?.[0]?.emailAddress || '';
        const fName = su?.firstName || (si as any)?.userData?.firstName || '';
        const lName = su?.lastName || (si as any)?.userData?.lastName || '';
        name = [fName, lName].filter(Boolean).join(' ') || (email ? email.split('@')[0] : 'Google User');
        profilePhoto = (su as any)?.imageUrl || (si as any)?.imageUrl || '';
      } catch (ssoErr: any) {
        console.warn('[Clerk SSO Warning]:', ssoErr?.message || ssoErr);
        // Throw to be handled by the outer block, or if it's a known cancel, it can just fall through.
        throw ssoErr;
      }

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
      console.warn('[Google OAuth Flow Error]:', err?.message || err);
      // Return null on failure or cancellation instead of generating a fake user
      return null;
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
