export const AndroidNotificationPriority = { MAX: 1, DEFAULT: 0 };
export const AndroidImportance = { MAX: 1 };
export const AndroidNotificationVisibility = { PUBLIC: 1 };
export const AndroidAudioUsage = { ALARM: 1 };
export const AndroidAudioContentType = { SONIFICATION: 1 };
export const SchedulableTriggerInputTypes = { DATE: 'date' };

export type NotificationContentInput = any;

// No-op mocks that accept the same arguments as the real expo-notifications API
// so TypeScript is satisfied in web/Expo Go environments where the native module
// is unavailable.  All functions are intentionally no-ops.

export const setNotificationHandler = (_handler?: any): void => {};

export const scheduleNotificationAsync = async (_request?: any): Promise<string> => 'mock-id';

export const cancelScheduledNotificationAsync = async (_id?: string): Promise<void> => {};

export const cancelAllScheduledNotificationsAsync = async (): Promise<void> => {};

export const getAllScheduledNotificationsAsync = async (): Promise<any[]> => [];

export const setNotificationChannelAsync = async (
  _channelId?: string,
  _channel?: any,
): Promise<void> => {};

export const getPermissionsAsync = async (): Promise<{ status: string }> => ({ status: 'denied' });

export const requestPermissionsAsync = async (): Promise<{ status: string }> => ({ status: 'denied' });

export const getExpoPushTokenAsync = async (_options?: any): Promise<{ data: string }> => ({ data: '' });

export const addNotificationReceivedListener = (
  _listener?: (notification: any) => void,
): { remove: () => void } => ({ remove: () => {} });

export const addNotificationResponseReceivedListener = (
  _listener?: (response: any) => void,
): { remove: () => void } => ({ remove: () => {} });
