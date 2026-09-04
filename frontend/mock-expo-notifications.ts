export const AndroidNotificationPriority = { MAX: 1, DEFAULT: 0 };
export const AndroidImportance = { MAX: 1 };
export const AndroidNotificationVisibility = { PUBLIC: 1 };
export const AndroidAudioUsage = { ALARM: 1 };
export const AndroidAudioContentType = { SONIFICATION: 1 };
export const SchedulableTriggerInputTypes = { DATE: 'date' };

export const setNotificationHandler = (...args: any[]) => {};
export const scheduleNotificationAsync = async (...args: any[]) => 'id';
export const cancelScheduledNotificationAsync = async (...args: any[]) => {};
export const cancelAllScheduledNotificationsAsync = async (...args: any[]) => {};
export const getAllScheduledNotificationsAsync = async (...args: any[]): Promise<any[]> => [];
export const setNotificationChannelAsync = async (...args: any[]) => {};
export const getPermissionsAsync = async (...args: any[]) => ({ status: 'denied' });
export const requestPermissionsAsync = async (...args: any[]) => ({ status: 'denied' });
export const getExpoPushTokenAsync = async (...args: any[]) => ({ data: '' });
export const addNotificationReceivedListener = (...args: any[]) => ({ remove: () => {} });
export const addNotificationResponseReceivedListener = (...args: any[]) => ({ remove: () => {} });

export type NotificationContentInput = any;
