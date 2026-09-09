import { useFonts } from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import SplashScreenView from '../components/SplashScreenView';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import * as Notifications from '../mock-expo-notifications';

import { Alert, Platform, LogBox } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { ClerkProvider } from '../services/clerkAuth';
import { tokenCache } from '../services/tokenCache';
import '../services/geofencingService'; // Initialize Geofencing Background Task
import * as Location from 'expo-location';
import { alarmService } from '../services/alarmService';

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go',
  'Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go',
  'was removed from Expo Go with the release of SDK 53',
  'Property "opacity" of AnimatedComponent(View) may be overwritten by a layout animation',
]);

try {
  // Configure foreground local notification handler for both Expo Go and standalone builds
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  console.warn('Failed to set notification handler:', e);
}

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  'pk_test_cmFwaWQtd2FscnVzLTU2ODYuY2xlcmsuYWNjb3VudHMuZGV2JA';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  // Controls the in-app animated splash overlay
  const [showSplash, setShowSplash] = useState(true);

  const fontsReady = loaded || !!error;

  useEffect(() => {
    if (error) {
      console.warn('Font load error:', error);
    }
  }, [error]);

  // When SplashScreenView finishes its exit animation, hide the native splash too
  const handleSplashFinish = () => {
    setShowSplash(false);
    SplashScreen.hideAsync().catch(() => {});
  };

  return (
    <>
      {/* Real app — always mounted so auth store can init while splash plays */}
      {fontsReady && (
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
          <RootLayoutNav />
        </ClerkProvider>
      )}

      {/* Animated in-app splash overlay */}
      {showSplash && (
        <SplashScreenView
          isReady={fontsReady}
          onFinish={handleSplashFinish}
        />
      )}
    </>
  );
}

function RootLayoutNav() {
  const { token, isLoading: authLoading, checkAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  // Keep a ref to the last notification response so we only navigate once
  const lastNotificationId = useRef<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [token, authLoading, segments]);

  // ── Notification tap → navigate to event ────────────────────────────────────
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        try {
          const notifId = response?.notification?.request?.identifier;
          if (notifId && notifId === lastNotificationId.current) return; // dedupe
          lastNotificationId.current = notifId ?? null;

          const data = response?.notification?.request?.content?.data;
          const eventId = data?.eventId;

          if (eventId && token) {
            // Navigate to the event detail page
            router.push(`/event/${eventId}` as any);
          }
        } catch (e) {
          console.warn('[Notifications] Response listener error:', e);
        }
      }
    );
    return () => {
      try {
        subscription?.remove();
      } catch (_) {}
    };
  }, [token]);

  // ── Permissions & services bootstrap ────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;

    async function bootstrap() {
      try {
        // 1. Set up Android notification channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('focusflow_alarm_v2', {
            name: 'EventFlow Alarms & Reminders',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 250, 500, 250, 500],
            lightColor: '#6366F1',
            sound: 'default',
            enableVibrate: true,
            showBadge: true,
            bypassDnd: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            audioAttributes: {
              usage: Notifications.AndroidAudioUsage.ALARM,
              contentType: Notifications.AndroidAudioContentType.SONIFICATION,
            },
          });
        }

        // 2. Request notification permission
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          Alert.alert(
            'Notifications Disabled',
            'Please allow notifications in Settings so EventFlow can remind you before event deadlines!',
            [{ text: 'OK' }]
          );
        }

        // 3. Request exact alarm permission (Android 12+)
        // Do this early so users aren't surprised later when scheduling alarms.
        if (Platform.OS === 'android') {
          await alarmService.ensureExactAlarmPermission();
        }

        // 4. Request foreground location
        const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          await Location.requestForegroundPermissionsAsync();
        }

        // 5. Request background location (needed for geofencing)
        const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          await Location.requestBackgroundPermissionsAsync();
        }

        // 6. Start activity recognition for smart context
        try {
          const { activityRecognitionService } = require('../services/activityRecognitionService');
          await activityRecognitionService.start();
        } catch (actError) {
          console.warn('[Smart Context] Failed to start activity recognition:', actError);
        }
      } catch (e) {
        console.warn('[Bootstrap] Permission/service init error:', e);
      }
    }

    bootstrap();
  }, []);

  const { isDark } = useThemeStore();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={isDark() ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
