import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { Event, ReminderConfig } from '../models/Event';
import { subMinutes, subHours, subDays, subWeeks, parseISO, setHours, setMinutes, setDate as setDateFns, setMonth, getDay } from 'date-fns';

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

  async registerForPushNotificationsAsync() {
    await this.ensureNotificationChannel();

    if (isExpoGo) {
      console.log('Skipping push token registration in Expo Go to avoid projectId errors, using local only.');
      return null;
    }

    if (Device.isDevice) {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.log('Failed to get push token for push notification!');
          return null;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
        return token;
      } catch (error: any) {
        if (error?.message?.includes('Expo Go') || String(error).includes('Expo Go')) {
          console.log('Skipping remote push token in Expo Go. Local notifications will still work.');
        } else {
          console.log('Expo Push Token error:', error);
        }
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return null;
  },

  async scheduleEventNotifications(event: Event, reminders: ReminderConfig[]): Promise<ReminderConfig[]> {
    await this.ensureNotificationChannel();
    const updatedReminders: ReminderConfig[] = [];

    // Parse main event date and time safely
    const [year, month, day] = event.date.split('T')[0].split('-').map(Number);
    const [hours, minutes] = event.time.split(':').map(Number);
    const eventDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

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

            // Only schedule if the trigger time is in the future (at least 15 seconds ahead)
            if (exactDate.getTime() > now.getTime() + 15000) {
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
  }
};
