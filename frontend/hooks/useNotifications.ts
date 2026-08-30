import { notificationService } from '../services/notificationService';
import { Event, ReminderConfig } from '../models/Event';

export function useNotifications() {
  const registerNotifications = async () => {
    return await notificationService.registerForPushNotificationsAsync();
  };

  const scheduleReminders = async (event: Event, reminders: ReminderConfig[]) => {
    return await notificationService.scheduleEventNotifications(event, reminders);
  };

  const cancelNotifications = async (ids: string[]) => {
    await notificationService.cancelNotifications(ids);
  };

  return {
    registerNotifications,
    scheduleReminders,
    cancelNotifications,
  };
}
