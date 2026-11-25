/**
 * behaviorService.ts
 * Tracks task habits and duration accuracy locally using AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event } from '../models/Event';

const RECORDS_KEY = '@behavior_records';
const DISMISSED_KEY = '@dismissed_reminders';
const MAX_RECORDS = 200;

export interface BehaviorRecord {
  eventId: string;
  category: string;
  estimatedDuration: number;
  actualDuration: number;
  scheduledMs: number;
  completedMs: number;
  delayMins: number;
  createdAt: number;
}

export interface CategoryInsight {
  category: string;
  avgDelayMins: number;
  avgActualDuration: number;
  avgEstimatedDuration: number;
  completionCount: number;
  onTimeRate: number;
  bestHour: number;
  worstHour: number;
}

async function loadRecords(): Promise<BehaviorRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveRecords(records: BehaviorRecord[]): Promise<void> {
  try {
    const trimmed = records.slice(-MAX_RECORDS);
    await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[BehaviorService] Failed to save records:', e);
  }
}

function parseEventDeadlineMs(event: Event): number {
  const dateStr = event.date ? event.date.split('T')[0] : new Date().toISOString().split('T')[0];
  const timeStr = event.time || '23:59';
  const normalized = timeStr.length <= 5 ? timeStr + ':00' : timeStr;
  return new Date(dateStr + 'T' + normalized).getTime();
}

export const behaviorService = {
  async recordTaskStart(_event: Event): Promise<void> {
    // Hook point — data saved on completion
  },

  async recordTaskComplete(event: Event): Promise<void> {
    try {
      const records = await loadRecords();
      const now = Date.now();
      const scheduledMs = parseEventDeadlineMs(event);
      const startedMs = event.startedAt ? new Date(event.startedAt).getTime() : now;
      const completedMs = event.completedAt ? new Date(event.completedAt).getTime() : now;
      const actualDuration = Math.max(1, Math.round((completedMs - startedMs) / 60000));
      const delayMins = Math.round((completedMs - scheduledMs) / 60000);

      records.push({
        eventId: event.id,
        category: (event.category || 'Other').toLowerCase(),
        estimatedDuration: event.estimatedDuration || 30,
        actualDuration,
        scheduledMs,
        completedMs,
        delayMins,
        createdAt: now,
      });
      await saveRecords(records);
    } catch (e) {
      console.warn('[BehaviorService] recordTaskComplete error:', e);
    }
  },

  async predictDuration(category: string): Promise<number | null> {
    try {
      const records = await loadRecords();
      const relevant = records.filter(r => r.category === category.toLowerCase() && r.actualDuration > 0);
      if (relevant.length < 2) return null;
      const totalWeight = relevant.reduce((s, _, i) => s + (i + 1), 0);
      const weighted = relevant.reduce((s, r, i) => s + r.actualDuration * (i + 1), 0);
      return Math.round(weighted / totalWeight);
    } catch { return null; }
  },

  async getAvgDelayMins(category: string): Promise<number> {
    try {
      const records = await loadRecords();
      const relevant = records.filter(r => r.category === category.toLowerCase());
      if (!relevant.length) return 0;
      return Math.round(relevant.reduce((a, r) => a + r.delayMins, 0) / relevant.length);
    } catch { return 0; }
  },

  async getOnTimeRate(category: string): Promise<number> {
    try {
      const records = await loadRecords();
      const relevant = records.filter(r => r.category === category.toLowerCase());
      if (!relevant.length) return 1;
      return Math.round((relevant.filter(r => r.delayMins <= 15).length / relevant.length) * 100) / 100;
    } catch { return 1; }
  },

  async getCategoryInsight(category: string): Promise<CategoryInsight> {
    const records = await loadRecords();
    const relevant = records.filter(r => r.category === category.toLowerCase());
    if (!relevant.length) {
      return { category, avgDelayMins: 0, avgActualDuration: 0, avgEstimatedDuration: 0, completionCount: 0, onTimeRate: 1, bestHour: 10, worstHour: 15 };
    }
    const avgDelay = Math.round(relevant.reduce((s, r) => s + r.delayMins, 0) / relevant.length);
    const avgActual = Math.round(relevant.reduce((s, r) => s + r.actualDuration, 0) / relevant.length);
    const avgEst = Math.round(relevant.reduce((s, r) => s + r.estimatedDuration, 0) / relevant.length);
    const onTimeRate = relevant.filter(r => r.delayMins <= 15).length / relevant.length;
    const hourC: Record<number, number> = {};
    const hourD: Record<number, number> = {};
    relevant.forEach(r => {
      const h = new Date(r.completedMs).getHours();
      hourC[h] = (hourC[h] || 0) + 1;
      if (r.delayMins > 30) hourD[h] = (hourD[h] || 0) + 1;
    });
    const bestHour = parseInt(Object.entries(hourC).sort((a, b) => +b[1] - +a[1])[0]?.[0] ?? '10', 10);
    const worstHour = parseInt(Object.entries(hourD).sort((a, b) => +b[1] - +a[1])[0]?.[0] ?? '15', 10);
    return { category, avgDelayMins: avgDelay, avgActualDuration: avgActual, avgEstimatedDuration: avgEst, completionCount: relevant.length, onTimeRate: Math.round(onTimeRate * 100) / 100, bestHour, worstHour };
  },

  async getAllRecords(): Promise<BehaviorRecord[]> {
    return loadRecords();
  },

  async recordDismissal(eventId: string): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(DISMISSED_KEY);
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      map[eventId] = (map[eventId] || 0) + 1;
      await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
      return map[eventId];
    } catch { return 0; }
  },

  async getDismissalCount(eventId: string): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(DISMISSED_KEY);
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      return map[eventId] || 0;
    } catch { return 0; }
  },

  async clearDismissals(eventId: string): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(DISMISSED_KEY);
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      delete map[eventId];
      await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
    } catch {}
  },
};
