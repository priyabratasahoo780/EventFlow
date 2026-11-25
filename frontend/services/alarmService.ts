import { NativeModules, Platform, Alert } from "react-native";
import { Event, ReminderConfig } from "../models/Event";
import { subMinutes, subHours, subDays } from "date-fns";

const { AlarmManagerModule } = NativeModules as {
  AlarmManagerModule?: {
    scheduleAlarm(
      alarmId: string,
      triggerMs: number,
      title: string,
      body: string,
      eventId: string
    ): Promise<string>;
    scheduleAlarmCritical(
      alarmId: string,
      triggerMs: number,
      title: string,
      body: string,
      eventId: string,
      isCritical: boolean
    ): Promise<string>;
    cancelAlarm(alarmId: string): Promise<string>;
    canScheduleExactAlarms(): Promise<boolean>;
    openExactAlarmSettings(): Promise<string>;
  };
};


const isAvailable = Platform.OS === "android" && !!AlarmManagerModule;

export const alarmService = {
  /** Check & request exact alarm permission (Android 12+). */
  async ensureExactAlarmPermission(): Promise<boolean> {
    if (!isAvailable) return false;
    try {
      const canSchedule = await AlarmManagerModule!.canScheduleExactAlarms();
      if (!canSchedule) {
        Alert.alert(
          "Exact Alarm Permission Needed",
          "To fire alarms when the app is closed, please allow EventFlow to schedule exact alarms.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => AlarmManagerModule!.openExactAlarmSettings(),
            },
          ]
        );
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Schedule a single exact alarm for the native AlarmManager.
   * @param alarmId   Unique ID string
   * @param triggerMs Epoch ms when alarm should fire
   * @param title     Alarm screen / notification title
   * @param body      Alarm screen / notification body
   * @param eventId   The event._id to deep-link back
   * @param isCritical EC5 — if true, native layer overrides phone silent mode and maxes volume
   */
  async scheduleAlarm(
    alarmId: string,
    triggerMs: number,
    title: string,
    body: string,
    eventId: string,
    isCritical: boolean = false
  ): Promise<void> {
    if (!isAvailable) return;
    if (triggerMs <= Date.now()) return; 

    try {
      if (isCritical) {
        await AlarmManagerModule!.scheduleAlarmCritical(alarmId, triggerMs, title, body, eventId, true);
      } else {
        await AlarmManagerModule!.scheduleAlarm(alarmId, triggerMs, title, body, eventId);
      }
      console.log("[AlarmService] Scheduled:", alarmId, new Date(triggerMs).toLocaleString(), isCritical ? "🚨 CRITICAL" : "");
    } catch (e) {
      console.error("[AlarmService] scheduleAlarm error:", e);
    }
  },


  /** Cancel a previously scheduled alarm. */
  async cancelAlarm(alarmId: string): Promise<void> {
    if (!isAvailable) return;
    try {
      await AlarmManagerModule!.cancelAlarm(alarmId);
      console.log("[AlarmService] Cancelled:", alarmId);
    } catch (e) {
      console.error("[AlarmService] cancelAlarm error:", e);
    }
  },

  
  async scheduleEventAlarms(
    event: Event,
    reminders: ReminderConfig[]
  ): Promise<string[]> {
    if (!isAvailable) return [];

    await this.ensureExactAlarmPermission();

    const scheduledIds: string[] = [];
    const eventId = event.id || (event as any)._id || "";

    // Parse event date + time
    const [year, month, day] = event.date.split("T")[0].split("-").map(Number);
    const [hours, minutes] = event.time.split(":").map(Number);
    const eventDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const now = new Date();

    // 1. Main event time alarm
    if (eventDateTime.getTime() > now.getTime()) {
      const mainId = `${eventId}_main`;
      await this.scheduleAlarm(
        mainId,
        eventDateTime.getTime(),
        `⏰ Starting Now: ${event.title}`,
        `Your task "${event.title}" is due now. Tap to start!`,
        eventId,
        event.isCritical ?? false
      );
      scheduledIds.push(mainId);
    }

    // 2. Reminder alarms
    for (let i = 0; i < reminders.length; i++) {
      const reminder = reminders[i];
      const remId = `${eventId}_reminder_${i}`;

      let triggerDate: Date | null = null;
      let title = `🔔 ${event.title}`;
      let body = event.description || `Scheduled for ${event.time}`;

      if (reminder.type === "before" && reminder.value && reminder.unit) {
        const unitStr = (reminder.unit || "hours").replace(/s$/, "");
        const val = reminder.value;
        title = `⚠️ ${event.title} due in ${val} ${unitStr}`;
        body = `You need ~${event.estimatedDuration || 30} mins. Start now?`;

        if (reminder.unit === "minutes")
          triggerDate = subMinutes(eventDateTime, val);
        else if (reminder.unit === "hours")
          triggerDate = subHours(eventDateTime, val);
        else if (reminder.unit === "days")
          triggerDate = subDays(eventDateTime, val);
        else if (reminder.unit === "weeks")
          triggerDate = subDays(eventDateTime, val * 7);
        if (triggerDate) triggerDate.setSeconds(0, 0);
      } else if (
        reminder.type === "exact" &&
        reminder.date &&
        reminder.time
      ) {
        const [eh, em] = reminder.time.split(":").map(Number);
        const [ey, emo, ed] = reminder.date.split("T")[0].split("-").map(Number);
        triggerDate = new Date(ey, emo - 1, ed, eh, em, 0, 0);
        title = `⏰ Time to start: ${event.title}`;
        body = `Deadline at ${reminder.time}. Ready to focus?`;
      }

      const shouldFireAlarm = !reminder.alarmPreference || reminder.alarmPreference === 'alarm' || reminder.alarmPreference === 'both';
      if (shouldFireAlarm && triggerDate && triggerDate.getTime() > now.getTime()) {
        await this.scheduleAlarm(remId, triggerDate.getTime(), title, body, eventId, event.isCritical ?? false);
        scheduledIds.push(remId);
      }

    }

    return scheduledIds;
  },

  /** Cancel all alarms for an event (pass the ids returned by scheduleEventAlarms). */
  async cancelEventAlarms(alarmIds: string[]): Promise<void> {
    for (const id of alarmIds) {
      await this.cancelAlarm(id);
    }
  },
};
