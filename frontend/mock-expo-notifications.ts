import { Platform } from 'react-native';

let RealNotifications: any = null;
try {
  RealNotifications = require('expo-notifications');
} catch (e) {
  console.log('[Mock Notifications] Skipping expo-notifications import in Expo Go');
}

export const AndroidNotificationPriority = RealNotifications?.AndroidNotificationPriority || { MAX: 'max', HIGH: 'high', DEFAULT: 'default', LOW: 'low', MIN: 'min' };
export const AndroidImportance = RealNotifications?.AndroidImportance || { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1, NONE: 0 };
export const AndroidNotificationVisibility = RealNotifications?.AndroidNotificationVisibility || { PUBLIC: 1, PRIVATE: 0, SECRET: -1 };
export const AndroidAudioUsage = RealNotifications?.AndroidAudioUsage || { ALARM: 4 };
export const AndroidAudioContentType = RealNotifications?.AndroidAudioContentType || { SONIFICATION: 4 };
export const SchedulableTriggerInputTypes = RealNotifications?.SchedulableTriggerInputTypes || { DATE: 'date', DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly', TIME_INTERVAL: 'timeInterval', CALENDAR: 'calendar' };

export type NotificationContentInput = any;

/**
 * Universal Notifications bridge:
 * - In standalone APK builds: runs real native expo-notifications (alarms, scheduled notifications, channels, badges).
 * - In Web or Expo Go: catches any unsupported environment errors gracefully without crashing the app.
 */

export const setNotificationHandler = (handler?: any): void => {
  try {
    RealNotifications?.setNotificationHandler(handler);
  } catch (e) {
    console.warn('[Notifications] setNotificationHandler warning:', e);
  }
};

export const scheduleNotificationAsync = async (request?: any): Promise<string> => {
  try {
    return await RealNotifications?.scheduleNotificationAsync(request);
  } catch (e) {
    console.warn('[Notifications] scheduleNotificationAsync warning:', e);
    return 'fallback-id';
  }
};

export const cancelScheduledNotificationAsync = async (id?: string): Promise<void> => {
  try {
    if (id) await RealNotifications?.cancelScheduledNotificationAsync(id);
  } catch (e) {
    console.warn('[Notifications] cancelScheduledNotificationAsync warning:', e);
  }
};

export const cancelAllScheduledNotificationsAsync = async (): Promise<void> => {
  try {
    await RealNotifications?.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('[Notifications] cancelAllScheduledNotificationsAsync warning:', e);
  }
};

export const getAllScheduledNotificationsAsync = async (): Promise<any[]> => {
  try {
    return await RealNotifications?.getAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('[Notifications] getAllScheduledNotificationsAsync warning:', e);
    return [];
  }
};

export const setNotificationChannelAsync = async (
  channelId?: string,
  channel?: any,
): Promise<void> => {
  try {
    if (Platform.OS === 'android' && channelId) {
      await RealNotifications?.setNotificationChannelAsync(channelId, channel);
    }
  } catch (e) {
    console.warn('[Notifications] setNotificationChannelAsync warning:', e);
  }
};

export const getPermissionsAsync = async (): Promise<{ status: string }> => {
  try {
    const res = await RealNotifications?.getPermissionsAsync();
    return { status: res.status as string };
  } catch (e) {
    return { status: 'granted' };
  }
};

export const requestPermissionsAsync = async (): Promise<{ status: string }> => {
  try {
    const res = await RealNotifications?.requestPermissionsAsync();
    return { status: res.status as string };
  } catch (e) {
    return { status: 'granted' };
  }
};

export const getExpoPushTokenAsync = async (options?: any): Promise<{ data: string }> => {
  try {
    return await RealNotifications?.getExpoPushTokenAsync(options);
  } catch (e) {
    console.warn('[Notifications] getExpoPushTokenAsync warning:', e);
    return { data: '' };
  }
};

export const addNotificationReceivedListener = (
  listener?: (notification: any) => void,
): { remove: () => void } => {
  try {
    if (listener && RealNotifications?.addNotificationReceivedListener) {
      const sub = RealNotifications.addNotificationReceivedListener(listener);
      if (sub && typeof sub.remove === 'function') return sub;
    }
  } catch (e) {
    console.warn('[Notifications] addNotificationReceivedListener warning:', e);
  }
  return { remove: () => {} };
};

export const addNotificationResponseReceivedListener = (
  listener?: (response: any) => void,
): { remove: () => void } => {
  try {
    if (listener && RealNotifications?.addNotificationResponseReceivedListener) {
      const sub = RealNotifications.addNotificationResponseReceivedListener(listener);
      if (sub && typeof sub.remove === 'function') return sub;
    }
  } catch (e) {
    console.warn('[Notifications] addNotificationResponseReceivedListener warning:', e);
  }
  return { remove: () => {} };
};
