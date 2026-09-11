import * as Notifications from '../mock-expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { Event, ReminderConfig } from '../models/Event';
import { subMinutes, subHours, subDays, subWeeks } from 'date-fns';
import { alarmService } from './alarmService';
import { behaviorService } from './behaviorService';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient || (Constants as any).appOwnership === 'expo';

// Register foreground notification handler unconditionally for Expo Go and Standalone builds
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Map string days to Expo Notification weekdays (1 = Sunday, 7 = Saturday)
const DAY_MAP: Record<string, number> = {
  'Sunday': 1,
  'Monday': 2,
  'Tuesday': 3,
  'Wednesday': 4,
  'Thursday': 5,
  'Friday': 6,
  'Saturday': 7,
};

export const notificationService = {
  async ensureNotificationChannel() {
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('focusflow_alarm_v2', {
          name: 'FocusFlow Loud Alarms & Reminders',
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
      } catch (e) {
        console.warn('Expo notification channel error:', e);
      }
    }
  },

  async registerForPushNotificationsAsync(): Promise<string | null> {
    await this.ensureNotificationChannel();

    // Expo Go does not support remote push tokens — skip silently
    if (isExpoGo) {
      if (__DEV__) console.log('[Push] Skipping push token in Expo Go — local notifications still work.');
      return null;
    }

    // Push tokens require a physical device
    if (!Device.isDevice) {
      if (__DEV__) console.log('[Push] Skipping push token on simulator/emulator.');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.warn('[Push] Notification permission denied — push token not registered.');
        return null;
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        (Constants as any).easConfig?.projectId;

      if (!projectId) {
        console.warn('[Push] No EAS projectId found in app config — cannot get push token.');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData?.data;
      if (__DEV__) console.log('[Push] Expo push token registered:', token);
      return token || null;
    } catch (error: any) {
      const msg = error?.message || String(error);
      if (msg.includes('Expo Go') || msg.includes('standalone')) {
        console.log('[Push] Push token not available in this environment:', msg);
      } else {
        console.error('[Push] Unexpected push token error:', msg);
      }
      return null;
    }
  },

  async scheduleEventNotifications(event: Event, reminders: ReminderConfig[]): Promise<ReminderConfig[]> {
    await this.ensureNotificationChannel();
    const updatedReminders: ReminderConfig[] = [];

    // ── Native AlarmManager (fires even when app is closed) ──────────────────
    // This runs in parallel with expo-notifications. On iOS or Expo Go it's a no-op.
    alarmService.scheduleEventAlarms(event, reminders).catch(e =>
      console.warn('[AlarmService] scheduleEventAlarms error (non-fatal):', e)
    );
    // ─────────────────────────────────────────────────────────────────────────

    // Parse main event date and time safely
    const [year, month, day] = event.date.split('T')[0].split('-').map(Number);
    const [hours, minutes] = event.time.split(':').map(Number);
    const eventDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const now = new Date();

    // 1. ALWAYS Schedule the Main Event Time Alarm (at event.date & event.time)
    if (eventDateTime.getTime() > now.getTime()) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `⏰ Event Starting Now: ${event.title}`,
            body: `Your task "${event.title}" is due now (${event.time}). Tap to start and focus!`,
            data: { eventId: event.id, category: event.category, isEventTime: true },
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 500, 250, 500, 250, 500],
            ...(Platform.OS === 'android' ? { channelId: 'focusflow_alarm_v2' } : {})
          } as any,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: eventDateTime },
        });
      } catch (eventAlarmErr) {
        console.error('Error scheduling main event alarm:', eventAlarmErr);
      }
    }

    for (const reminder of reminders) {
      let ids: string[] = [];
      // 7 Contextual Reminder Types Generator
      let title = `🔔 ${event.title}`;
      let body = event.description || `Scheduled for ${event.time}`;

      const estDuration = event.estimatedDuration || 30;
      const isStarted = event.status === 'in_progress' || !!event.startedAt;

      if (reminder.type === 'before') {
        const unitStr = (reminder.unit || 'hours').replace(/s$/, '');
        const val = reminder.value || 1;
        const timeText = val === 1 ? `1 ${unitStr}` : `${val} ${reminder.unit || 'hours'}`;
        
        title = `⚠️ Your ${event.title} is due in ${timeText}.`;
        if (isStarted) {
          body = `You are currently working on it. Approx ${estDuration} mins remaining to finish on time.`;
        } else {
          body = `You haven't started it yet.\nYou need approximately ${estDuration} minutes to complete this task. Start now?`;
        }
      } else if (reminder.type === 'exact') {
        title = `⏰ Time to start: ${event.title}`;
        body = `Deadline at ${reminder.time || event.time}. You need ~${estDuration} mins to complete this task. Ready to focus?`;
      } else if (reminder.type === 'daily') {
        title = `💡 Daily Focus Routine: ${event.title}`;
        body = `Priority: ${event.priority.toUpperCase()} | Estimated duration: ~${estDuration} mins. Let's make progress!`;
      } else if (reminder.type === 'weekly') {
        title = `📅 Weekly Routine: ${event.title}`;
        body = `Scheduled for ${event.time}. Target duration: ${estDuration} mins.`;
      } else if (reminder.type === 'monthly') {
        title = `🗓️ Monthly Target: ${event.title}`;
        body = `Due today at ${event.time}. Estimated focus time: ${estDuration} mins.`;
      } else if (reminder.type === 'yearly') {
        title = `🎉 Milestone Alert: ${event.title}`;
        body = `Today is the day! Don't forget your scheduled task for ${event.time}.`;
      }

      // If user selected 'alarm' only (not 'notification' and not 'both'), skip push notification
      if (reminder.alarmPreference === 'alarm') {
        continue;
      }

      const isSilent = reminder.sound === 'silent' || reminder.notificationPreference === 'silent';

      const content: Notifications.NotificationContentInput = {
        title,
        body,
        data: { eventId: event.id, category: event.category },
        sound: isSilent ? false : 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: reminder.vibration === false ? [] : [0, 500, 250, 500, 250, 500],
      };

      if (Platform.OS === 'android') {
        (content as any).channelId = 'focusflow_alarm_v2';
      }

      try {
        const now = new Date();

        if (reminder.type === 'before') {
          // Schedule exact notification before event
          if (reminder.value && reminder.unit) {
            let triggerDate = eventDateTime;
            if (reminder.unit === 'minutes') triggerDate = subMinutes(eventDateTime, reminder.value);
            else if (reminder.unit === 'hours') triggerDate = subHours(eventDateTime, reminder.value);
            else if (reminder.unit === 'days') triggerDate = subDays(eventDateTime, reminder.value);
            else if (reminder.unit === 'weeks') triggerDate = subWeeks(eventDateTime, reminder.value);

            // Clean seconds/ms
            triggerDate.setSeconds(0, 0);

            // Only schedule if the trigger time is in the future
            if (triggerDate.getTime() > now.getTime()) {
              const id = await Notifications.scheduleNotificationAsync({
                content,
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
              });
              ids.push(id);
            }
          }
        } 
        else if (reminder.type === 'exact') {
          if (reminder.date && reminder.time) {
            const [exactHour, exactMinute] = reminder.time.split(':').map(Number);
            const [y, m, d] = reminder.date.split('T')[0].split('-').map(Number);
            const exactDate = new Date(y, m - 1, d, exactHour, exactMinute, 0, 0);

            // Only schedule if the trigger time is in the future
            if (exactDate.getTime() > now.getTime()) {
              const id = await Notifications.scheduleNotificationAsync({
                content,
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: exactDate },
              });
              ids.push(id);
            }
          }
        }
        else if (reminder.type === 'daily') {
          if (reminder.time) {
            const [hours, minutes] = reminder.time.split(':').map(Number);
            // Schedule exact instances for the next 30 days or until event date
            const maxDays = Math.min(30, Math.max(1, Math.ceil((eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) + 1));

            for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
              const instanceDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hours, minutes, 0, 0);
              
              if (instanceDate.getTime() > now.getTime()) {
                const id = await Notifications.scheduleNotificationAsync({
                  content,
                  trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: instanceDate },
                });
                ids.push(id);
              }
            }
          }
        }
        else if (reminder.type === 'weekly') {
          if (reminder.time && reminder.days && reminder.days.length > 0) {
            const [hours, minutes] = reminder.time.split(':').map(Number);
            // Schedule for the next 4 weeks (28 days)
            for (let dayOffset = 0; dayOffset < 28; dayOffset++) {
              const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hours, minutes, 0, 0);
              const dayName = Object.keys(DAY_MAP).find(k => DAY_MAP[k] === (checkDate.getDay() + 1));
              
              if (dayName && reminder.days.includes(dayName) && checkDate.getTime() > now.getTime()) {
                const id = await Notifications.scheduleNotificationAsync({
                  content,
                  trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: checkDate },
                });
                ids.push(id);
              }
            }
          }
        }
        else if (reminder.type === 'monthly') {
          if (reminder.time && reminder.dayOfMonth) {
            const [hours, minutes] = reminder.time.split(':').map(Number);
            const targetDay = reminder.dayOfMonth;

            for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
              const instanceDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, targetDay, hours, minutes, 0, 0);
              if (instanceDate.getTime() > now.getTime()) {
                const id = await Notifications.scheduleNotificationAsync({
                  content,
                  trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: instanceDate },
                });
                ids.push(id);
              }
            }
          }
        }
        else if (reminder.type === 'yearly') {
          if (reminder.time && reminder.date) {
            const [hours, minutes] = reminder.time.split(':').map(Number);
            const month = parseInt(reminder.date.split('-')[1], 10) - 1;
            const day = parseInt(reminder.date.split('-')[2], 10) || parseInt(reminder.date.split('-')[0], 10);
            
            const thisYearInstance = new Date(now.getFullYear(), month, day, hours, minutes, 0, 0);
            const targetDate = thisYearInstance.getTime() > now.getTime() 
              ? thisYearInstance 
              : new Date(now.getFullYear() + 1, month, day, hours, minutes, 0, 0);

            const id = await Notifications.scheduleNotificationAsync({
              content,
              trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: targetDate },
            });
            ids.push(id);
          }
        }
      } catch (err) {
        console.error('Error scheduling reminder', reminder, err);
      }

      updatedReminders.push({ ...reminder, notificationIds: ids });
    }

    return updatedReminders;
  },

  async cancelNotifications(identifiers: string[]) {
    for (const id of identifiers) {
      if (id) {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch (e) {
          console.error(e);
        }
      }
    }
  },

  async cancelEventNotifications(eventId: string, identifiers?: string[]) {
    if (identifiers && identifiers.length > 0) {
      await this.cancelNotifications(identifiers);
    }

    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notif of scheduled) {
        if (notif.content.data?.eventId === eventId) {
          await Notifications.cancelScheduledNotificationAsync(notif.identifier);
        }
      }
    } catch (e) {
      console.warn('Error clearing event scheduled notifications:', e);
    }
  },

  async sendImmediateNotification(event: Event) {
    const content: Notifications.NotificationContentInput = {
      title: `🔔 New Event Added`,
      body: `${event.title} has just been added!`,
      data: { eventId: event.id },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 500, 250, 500, 250, 500],
    };

    if (Platform.OS === 'android') {
      (content as any).channelId = 'focusflow_alarm_v2';
    }

    await Notifications.scheduleNotificationAsync({
      content,
      trigger: null,
    });
  },

  /**
   * Intelligent Escalation — call when user has dismissed or ignored a reminder.
   * Escalation chain:
   *   1st dismiss  → re-schedule as banner + vibration in 5 min
   *   2nd dismiss  → upgrade to full-screen native alarm in 5 min
   *   3rd+ dismiss → fire alarm immediately (emergency escalation)
   */
  async escalateIfDismissed(event: Event): Promise<void> {
    try {
      const count = await behaviorService.getDismissalCount(event.id);
      const newCount = await behaviorService.recordDismissal(event.id);

      if (event.completed || event.status === 'completed' || event.status === 'cancelled') {
        await behaviorService.clearDismissals(event.id);
        return;
      }

      const delayMs = newCount >= 3 ? 0 : 5 * 60 * 1000; // immediate on 3rd dismiss

      if (newCount >= 2) {
        // Escalate to native full-screen alarm
        console.log(`[Escalation] 🚨 Level ${newCount} escalation → native alarm for "${event.title}"`);
        await alarmService.scheduleAlarm(
          `escalate_${event.id}_${Date.now()}`,
          Date.now() + delayMs,
          `🚨 ${event.title} — You must act NOW`,
          `You've dismissed this ${newCount} times. This task is still pending.`,
          event.id,
          true // isCritical — override silent mode
        );
      } else {
        // Level 1 — stronger banner re-notification
        console.log(`[Escalation] 🔔 Level 1 escalation → banner for "${event.title}"`);
        const body = count === 0
          ? `This task is still pending. Don't let it slip!`
          : `You've dismissed this reminder. Escalating in 5 minutes.`;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `⚠️ ${event.title} — Reminder`,
            body,
            data: { eventId: event.id },
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 1000, 500, 1000, 500, 1000],
            ...(Platform.OS === 'android' ? { channelId: 'focusflow_alarm_v2' } : {}),
          } as any,
          trigger: delayMs > 0 ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delayMs / 1000 } as any : null,
        });
      }
    } catch (e) {
      console.warn('[Escalation] escalateIfDismissed error:', e);
    }
  },

  /**
   * Call from foreground notification listener when user receives but doesn't
   * tap/act on a notification. Records a "passive dismiss" for escalation tracking.
   */
  async recordForegroundDismissal(eventId: string): Promise<void> {
    await behaviorService.recordDismissal(eventId);
  },
};

