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
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import SplashScreenView from '../components/SplashScreenView';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import * as Notifications from '../mock-expo-notifications';
import * as WebBrowser from 'expo-web-browser';

// Complete any pending auth session when the app is foregrounded via OAuth redirect
WebBrowser.maybeCompleteAuthSession();

import { Alert, AppState, Platform, LogBox } from 'react-native';
import { findDueAlarmTask } from '../services/alarmCheck';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { warmUpBackend } from '../services/api';
import { ClerkProvider } from '../services/clerkAuth';
import { tokenCache } from '@clerk/expo/token-cache';
import '../services/geofencingService'; // Initialize Geofencing Background Task
import * as Location from 'expo-location';
import { alarmService } from '../services/alarmService';
import AlarmModal from '../components/AlarmModal';
import DynamicIslandTaskBar from '../components/DynamicIslandTaskBar';
import ConfettiCelebration from '../components/ConfettiCelebration';
import { Event } from '../models/Event';
import { useEventStore } from '../store/useEventStore';

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
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  'pk_test_cmVsYXhlZC1mZWxpbmUtODM0LmNsZXJrLmFjY291bnRzLmRldiQ';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  const [showSplash, setShowSplash] = useState(true);

  const fontsReady = loaded || !!error;

  useEffect(() => {
    if (error) {
      console.warn('Font load error:', error);
    }
  }, [error]);

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  // When SplashScreenView finishes its exit animation, remove the overlay
  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <>
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
  const { token, user, isLoading: authLoading, checkAuth, postLoginRoute, setPostLoginRoute } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  // Keep a ref to the last notification response so we only navigate once
  const lastNotificationId = useRef<string | null>(null);
  const [activeAlarmEvent, setActiveAlarmEvent] = useState<Event | null>(null);

  useEffect(() => {
    warmUpBackend();
    checkAuth();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification: any) => {
      try {
        const data = notification?.request?.content?.data;
        const eventId = data?.eventId;
        if (eventId && data?.type !== 'geofence') {
          const events = useEventStore.getState().events;
          const found = events.find((e) => e.id === eventId);
          if (found && !found.completed && found.status !== 'completed') {
            setActiveAlarmEvent(found);
          }
        }
      } catch (err) {
        console.warn('[Notifications] Foreground received error:', err);
      }
    });

    return () => {
      try {
        sub?.remove();
      } catch (_) {}
    };
  }, []);

  const triggeredAlarms = useRef<Set<string>>(new Set());

  useEffect(() => {
    let lastCheckedMinute = '';
    let lastEventsRef: Event[] | null = null;
    let lastFriendsRef: Event[] | null = null;

    const runCheck = () => {
      if (AppState.currentState !== 'active' || activeAlarmEvent) return;
      const store = useEventStore.getState();
      const evs = store.events || [];
      const fEvs = store.friendsEvents || [];
      const now = new Date();
      const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}_${now.getHours()}:${now.getMinutes()}`;

      if (minuteKey === lastCheckedMinute && evs === lastEventsRef && fEvs === lastFriendsRef) {
        return;
      }
      lastCheckedMinute = minuteKey;
      lastEventsRef = evs;
      lastFriendsRef = fEvs;

      const dueTask = findDueAlarmTask(evs, fEvs, triggeredAlarms.current, now);
      if (dueTask && useAuthStore.getState().user?.role !== 'admin') {
        setActiveAlarmEvent(dueTask);
      }
    };

    runCheck();
    const interval = setInterval(runCheck, 3000);
    return () => clearInterval(interval);
  }, [activeAlarmEvent]);

  useEffect(() => {
    if (authLoading || !rootNavigationState?.key) return;

    const seg0 = (segments as string[])[0];
    const inAuthGroup = seg0 === '(auth)';
    const inAdminPortal = seg0 === 'admin';
    const inOAuthCallback = seg0 === 'sso-callback';
    const atRootIndex = !seg0;

    if (!token && !inAuthGroup && !inOAuthCallback) {
      router.replace('/(auth)/welcome');
    } else if (token && user?.role === 'admin') {
      // Strict portal isolation: Admin can NEVER enter user portal routes
      if (!inAdminPortal) {
        if (postLoginRoute) setPostLoginRoute(null);
        router.replace('/admin' as any);
      }
    } else if (token) {
      if (inAdminPortal || inAuthGroup || atRootIndex) {
        if (postLoginRoute) setPostLoginRoute(null);
        router.replace('/(tabs)');
      }
    }
  }, [token, user?.role, authLoading, segments, postLoginRoute, rootNavigationState?.key]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        try {
          const notifId = response?.notification?.request?.identifier;
          if (notifId && notifId === lastNotificationId.current) return; // dedupe
          lastNotificationId.current = notifId ?? null;

          const data = response?.notification?.request?.content?.data;
          const eventId = data?.eventId;

          if (eventId && token && useAuthStore.getState().user?.role !== 'admin') {
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

        if (Platform.OS === 'android') {
          await alarmService.ensureExactAlarmPermission();
        }

        const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          await Location.requestForegroundPermissionsAsync();
        }

        const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          await Location.requestBackgroundPermissionsAsync();
        }

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
  const theme = useMemo(() => (isDark() ? DarkTheme : DefaultTheme), [isDark]);

  const handleDismissAlarm = useCallback(() => {
    setActiveAlarmEvent(null);
  }, []);

  const handleStartTaskAlarm = useCallback((ev: Event) => {
    setActiveAlarmEvent(null);
    router.push(`/event/${ev.id}` as any);
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>

        {user?.role !== 'admin' && (
          <>
            <AlarmModal
              visible={!!activeAlarmEvent}
              event={activeAlarmEvent}
              onDismiss={handleDismissAlarm}
              onStartTask={handleStartTaskAlarm}
            />

            <DynamicIslandTaskBar />

            <ConfettiCelebration />
          </>
        )}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
