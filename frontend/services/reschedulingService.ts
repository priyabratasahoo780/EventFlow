
import { Event } from '../models/Event';

export interface FreeSlot {
  date: string;
  time: string;
  dateMs: number;
  label: string;
  freeForMins: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface RescheduleSuggestion {
  slot: FreeSlot;
  reason: string;
}

// Helper functions
function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function toTimeStr(d: Date): string {
  return d.toTimeString().slice(0, 5); 
}

function formatSlotLabel(d: Date): string {
  const now = new Date();
  const todayStr = toDateStr(now);
  const tomorrowStr = toDateStr(new Date(now.getTime() + 86400000));
  const dateStr = toDateStr(d);

  let prefix = dateStr;
  if (dateStr === todayStr) prefix = 'Today';
  else if (dateStr === tomorrowStr) prefix = 'Tomorrow'; 
  else {
    const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    prefix = d.toLocaleDateString('en-IN', opts);
  }

  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return prefix + ' at ' + h12 + ':' + m + ' ' + ampm;
}

function getEventIntervalMs(event: Event): { startMs: number; endMs: number } | null {
  if (!event.date) return null;
  const dateStr = event.date.split('T')[0];
  const timeStr = (event.time || '00:00').length <= 5 ? (event.time || '00:00') + ':00' : (event.time || '00:00');
  const startMs = new Date(dateStr + 'T' + timeStr).getTime();
  const durationMs = (event.estimatedDuration || 30) * 60 * 1000;
  return { startMs, endMs: startMs + durationMs };
}

export const reschedulingService = {

  findNextFreeSlot(allEvents: Event[], minDurationMins: number = 30): FreeSlot | null {
    const now = new Date();
    // Round up to next 15-min block
    const startMin = Math.ceil(now.getMinutes() / 15) * 15;
    let scanMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), startMin, 0, 0).getTime();
    if (scanMs < Date.now()) scanMs += 15 * 60 * 1000;

    // Build sorted list of future event intervals
    const intervals = allEvents
      .filter(e => !e.completed && e.status !== 'completed' && e.status !== 'cancelled')
      .map(getEventIntervalMs)
      .filter((i): i is { startMs: number; endMs: number } => !!i && i.startMs > Date.now())
      .sort((a, b) => a.startMs - b.startMs);

    const maxScanMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const minMs = minDurationMins * 60 * 1000;

    while (scanMs < maxScanMs) {
      const h = new Date(scanMs).getHours();
      if (h >= 22 || h < 7) {
        const nextDay = new Date(scanMs);
        nextDay.setHours(7, 0, 0, 0);
        if (nextDay.getTime() <= scanMs) nextDay.setDate(nextDay.getDate() + 1);
        scanMs = nextDay.getTime();
        continue;
      }

      // Find next blocking event
      const blocking = intervals.find(iv => iv.startMs > scanMs && iv.startMs < scanMs + minMs + 30 * 60 * 1000);
      const freeUntil = blocking ? blocking.startMs : scanMs + 4 * 60 * 60 * 1000;
      const freeForMins = Math.floor((freeUntil - scanMs) / 60000);

      if (freeForMins >= minDurationMins) {          
        const slotDate = new Date(scanMs);
        const confidence: 'high' | 'medium' | 'low' =
          freeForMins >= minDurationMins * 2 ? 'high' :
          freeForMins >= minDurationMins + 15 ? 'medium' : 'low';

        return {
          date: toDateStr(slotDate),
          time: toTimeStr(slotDate),
          dateMs: scanMs,
          label: formatSlotLabel(slotDate),
          freeForMins,
          confidence,
        };
      }

      // Jump past this blocker
      scanMs = blocking ? blocking.endMs + 5 * 60 * 1000 : scanMs + 15 * 60 * 1000;
    }

    return null;
  },

  generateAiSlots(allEvents: Event[], missedEvent: Event): RescheduleSuggestion[] {
    const minMins = missedEvent.estimatedDuration || 30;
    const suggestions: RescheduleSuggestion[] = [];
    const scanned: number[] = [];

    const others = allEvents.filter(e => e.id !== missedEvent.id && (e.id || e._id) !== (missedEvent.id || missedEvent._id));

    let searchBase = others;
    for (let attempt = 0; attempt < 3; attempt++) {
      const slot = this.findNextFreeSlot(searchBase, minMins);
      if (!slot) break;
      if (scanned.includes(slot.dateMs)) break;
      scanned.push(slot.dateMs);

      const reason =
        slot.confidence === 'high' ? (slot.freeForMins + ' min free — plenty of buffer') :
        slot.confidence === 'medium' ? (slot.freeForMins + ' min free — fits with small buffer') :
        (slot.freeForMins + ' min free — tight but doable');

      suggestions.push({ slot, reason });

      const fakeBlocker: Event = {
        ...missedEvent,
        id: 'fake_blocker_' + attempt,
        date: slot.date + 'T00:00:00.000Z',
        time: slot.time,
        estimatedDuration: minMins + 30,
        completed: false,
        status: 'pending',
      };
      searchBase = [...searchBase, fakeBlocker];
    }

    return suggestions;
  },

  getMissedTaskImpact(missedEvent: Event, allEvents: Event[]): Event[] {
    if (!missedEvent.sharedWith || missedEvent.sharedWith.length === 0) return [];

    const missedDeadlineMs = missedEvent.date
      ? new Date(missedEvent.date.split('T')[0] + 'T' + (missedEvent.time || '23:59') + ':00').getTime()
      : Date.now();

    return allEvents.filter(e => {
      if (e.id === missedEvent.id) return false;
      if (!e.sharedWith || e.sharedWith.length === 0) return false;
      const hasCommonFriend = e.sharedWith.some((uid: string) =>
        (missedEvent.sharedWith as string[]).includes(uid)
      );
      if (!hasCommonFriend) return false;
      const eDeadlineMs = e.date
        ? new Date(e.date.split('T')[0] + 'T' + (e.time || '23:59') + ':00').getTime()
        : 0;
      return eDeadlineMs > missedDeadlineMs && eDeadlineMs < missedDeadlineMs + 4 * 60 * 60 * 1000;
    });
  },
};
