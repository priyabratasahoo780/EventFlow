import { Event } from '../models/Event';

/** Parses 24h or 12h AM/PM time strings into numeric hours and minutes. */
export function parseAlarmTime(timeStr?: string): { h: number; m: number } | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  const isPM = /pm/i.test(trimmed);
  const isAM = /am/i.test(trimmed);
  const parts = trimmed.replace(/[ap]m/i, '').trim().split(':');
  if (parts.length < 2) return null;
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (isPM && h !== 12) h += 12;
  if (isAM && h === 12) h = 0;
  return { h, m };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Scans user and friend events once per minute-change for any un-triggered
 * deadline or reminder matching the current wall-clock hour and minute.
 */
export function findDueAlarmTask(
  events: Event[],
  friendsEvents: Event[],
  triggeredAlarms: Set<string>,
  now: Date = new Date()
): Event | undefined {
  if ((!events || events.length === 0) && (!friendsEvents || friendsEvents.length === 0)) {
    return undefined;
  }

  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  const todayDayName = DAY_NAMES[now.getDay()];
  const todayDayNum = now.getDate();
  const todayMonthNum = now.getMonth() + 1;

  const checkList = (list: Event[]): Event | undefined => {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e || e.completed || e.status === 'completed' || e.status === 'in_progress') continue;

      const triggerTimes: { h: number; m: number }[] = [];

      if (e.time && e.date && e.date.startsWith(todayStr)) {
        const parsed = parseAlarmTime(e.time);
        if (parsed) triggerTimes.push(parsed);
      }

      if (e.reminders && e.reminders.length > 0) {
        for (let j = 0; j < e.reminders.length; j++) {
          const r: any = e.reminders[j];
          if (!r) continue;

          if (r.type === 'exact') {
            if (r.time && (!r.date || r.date.startsWith(todayStr))) {
              const parsed = parseAlarmTime(r.time);
              if (parsed) triggerTimes.push(parsed);
            }
          } else if (r.type === 'daily') {
            if (r.time) {
              const parsed = parseAlarmTime(r.time);
              if (parsed) triggerTimes.push(parsed);
            }
          } else if (r.type === 'weekly') {
            if (r.time && r.days && r.days.includes(todayDayName)) {
              const parsed = parseAlarmTime(r.time);
              if (parsed) triggerTimes.push(parsed);
            }
          } else if (r.type === 'monthly') {
            if (r.time && r.dayOfMonth === todayDayNum) {
              const parsed = parseAlarmTime(r.time);
              if (parsed) triggerTimes.push(parsed);
            }
          } else if (r.type === 'yearly') {
            if (r.time && r.date) {
              const parts = r.date.split('-');
              const m = parseInt(parts[0], 10) || parseInt(parts[1], 10);
              const d = parseInt(parts[1], 10) || parseInt(parts[2], 10);
              if (m === todayMonthNum && d === todayDayNum) {
                const parsed = parseAlarmTime(r.time);
                if (parsed) triggerTimes.push(parsed);
              }
            }
          } else if (r.type === 'before' && r.value && e.time) {
            const mainParsed = parseAlarmTime(e.time);
            if (mainParsed) {
              const triggerDate = new Date(year, now.getMonth(), todayDayNum, mainParsed.h, mainParsed.m);
              if (r.unit === 'minutes') triggerDate.setMinutes(triggerDate.getMinutes() - r.value);
              else if (r.unit === 'hours') triggerDate.setHours(triggerDate.getHours() - r.value);
              else if (r.unit === 'days') triggerDate.setDate(triggerDate.getDate() - r.value);

              if (triggerDate.getDate() === todayDayNum) {
                triggerTimes.push({ h: triggerDate.getHours(), m: triggerDate.getMinutes() });
              }
            }
          }
        }
      }

      for (let k = 0; k < triggerTimes.length; k++) {
        const time = triggerTimes[k];
        const alarmKey = `${e.id || (e as any)._id}_${time.h}:${time.m}_${todayStr}`;
        if (time.h === currentHours && time.m === currentMinutes && !triggeredAlarms.has(alarmKey)) {
          triggeredAlarms.add(alarmKey);
          return e;
        }
      }
    }
    return undefined;
  };

  return checkList(events) || checkList(friendsEvents);
}
