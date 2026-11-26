 
  // Background and foreground geofencing engine for Arrive and Leave reminders.
 
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { AppState, DeviceEventEmitter, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from '../mock-expo-notifications';
import { Event, LocationTimeGate } from '../models/Event';
import api from './api';

export const GEOFENCING_TASK_NAME = 'BACKGROUND_GEOFENCE_TASK';
export const GEOFENCE_TRIGGERED_EVENT = 'EVENTFLOW_GEOFENCE_TRIGGERED';

const EVENTS_STORAGE_KEY = '@eventflow_events';
const REGIONS_STORAGE_KEY = 'geofencing_regions';
const GEOFENCE_STATE_KEY = '@eventflow_geofence_state_v2';
const LEGACY_PENDING_EXIT_KEY = 'geofencing_pending_exit_tasks';
const DRIVE_BY_PENDING_KEY = '@eventflow_driveby_pending';

export const GEOFENCE_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const NEW_TASK_GRACE_MS = 30 * 1000; // 30s grace window right after task creation
const MAX_OS_REGIONS = Platform.OS === 'ios' ? 20 : 95;
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface GeofenceRuntimeState {
  /** Epoch ms when each task last fired an Arrive or Leave alert */
  lastFired: Record<string, number>;
  /** Whether the user was last observed inside each task's geofence */
  inside: Record<string, boolean>;
  /** Tasks snoozed until user exits and re-enters (EC4) */
  pendingExit: Record<string, boolean>;
}

/**
 * Computes great-circle distance in meters using the Haversine formula.
 */
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns true if the task has an active location reminder with valid coordinates.
 */
export function isTaskActiveForGeofence(event?: Event | null): boolean {
  if (!event) return false;
  if (
    event.completed ||
    event.status === 'completed' ||
    event.status === 'late_completed' ||
    event.status === 'cancelled'
  ) {
    return false;
  }
  return Boolean(
    event.locationReminderEnabled &&
      typeof event.locationDetails?.latitude === 'number' &&
      typeof event.locationDetails?.longitude === 'number'
  );
}

/**
 * Checks whether the current day & hour fall inside an optional LocationTimeGate.
 */
export function isWithinTimeGate(gate?: LocationTimeGate): boolean {
  if (!gate) return true;

  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = WEEKDAY_NAMES[now.getDay()];

  if (Array.isArray(gate.days) && gate.days.length > 0 && !gate.days.includes(currentDay)) {
    return false;
  }
  if (Array.isArray(gate.days) && gate.days.length === 0) {
    return false;
  }

  const { startHour, endHour } = gate;
  if (startHour === endHour) return true;
  if (startHour < endHour) {
    return currentHour >= startHour && currentHour < endHour;
  }
  // Overnight window (e.g. 20:00 -> 06:00)
  return currentHour >= startHour || currentHour < endHour;
}

/**
 * Reads unified geofence runtime state from AsyncStorage.
 */
export async function loadGeofenceState(): Promise<GeofenceRuntimeState> {
  try {
    const [raw, legacyPendingRaw] = await Promise.all([
      AsyncStorage.getItem(GEOFENCE_STATE_KEY),
      AsyncStorage.getItem(LEGACY_PENDING_EXIT_KEY),
    ]);

    const parsed: GeofenceRuntimeState = raw
      ? JSON.parse(raw)
      : { lastFired: {}, inside: {}, pendingExit: {} };

    const state: GeofenceRuntimeState = {
      lastFired: parsed.lastFired || {},
      inside: parsed.inside || {},
      pendingExit: parsed.pendingExit || {},
    };

    if (legacyPendingRaw) {
      const legacyPending = JSON.parse(legacyPendingRaw) as Record<string, boolean>;
      for (const [k, v] of Object.entries(legacyPending)) {
        if (v) state.pendingExit[k] = true;
      }
      await AsyncStorage.removeItem(LEGACY_PENDING_EXIT_KEY);
      await AsyncStorage.setItem(GEOFENCE_STATE_KEY, JSON.stringify(state));
    }

    return state;
  } catch {
    return { lastFired: {}, inside: {}, pendingExit: {} };
  }
}

/**
 * Persists unified geofence runtime state to AsyncStorage.
 */
export async function saveGeofenceState(state: GeofenceRuntimeState): Promise<void> {
  try {
    await AsyncStorage.setItem(GEOFENCE_STATE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[Geofencing] Failed to persist state:', err);
  }
}

/**
 * Dispatches notification, native background alarm (when backgrounded or critical),
 * in-app foreground modal event, and friend buddy alerts.
 */
export async function fireLocationAlarm(
  event: Event,
  taskId: string,
  triggerType: 'arrive' | 'leave' = 'arrive',
  state?: GeofenceRuntimeState
): Promise<boolean> {
  const runtimeState = state || (await loadGeofenceState());
  const now = Date.now();
  const lastFired = runtimeState.lastFired[taskId] || 0;

  // Deduplicate between OS background geofence, foreground watch, and activity transition
  if (now - lastFired < GEOFENCE_COOLDOWN_MS) {
    return false;
  }

  // Respect brief grace period immediately after creating a task
  const createdAt = event.createdAt ? new Date(event.createdAt).getTime() : 0;
  if (createdAt && now - createdAt < NEW_TASK_GRACE_MS) {
    return false;
  }

  runtimeState.lastFired[taskId] = now;
  await saveGeofenceState(runtimeState);

  const isArrive = triggerType === 'arrive';
  const locationLabel = event.location || 'Your Location';
  const notifTitle = isArrive ? `📍 Arrived Near ${locationLabel}` : `🚶 Leaving ${locationLabel}`;
  const notifBody = isArrive
    ? `Task "${event.title}" is ready to start here.`
    : `Don't forget "${event.title}" before leaving ${locationLabel}!`;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notifTitle,
        body: notifBody,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: isArrive ? [0, 300, 200, 300] : [0, 250, 150, 250],
        data: {
          eventId: taskId,
          triggerType,
          type: 'geofence',
        },
        ...(Platform.OS === 'android' ? { channelId: 'focusflow_alarm_v2' } : {}),
      } as any,
      trigger: null,
    });
  } catch (err) {
    console.warn('[Geofencing] Notification schedule error:', err);
  }

  // Trigger native AlarmActivity / ringtone when app is backgrounded/closed or task is Critical
  const isForeground = AppState.currentState === 'active';
  if (!isForeground || event.isCritical) {
    try {
      const { alarmService } = require('./alarmService');
      await alarmService.scheduleAlarm(
        `geo_${triggerType}_${taskId}_${now}`,
        now + 1000,
        notifTitle,
        `Task: ${event.title}\nLocation: ${locationLabel}`,
        taskId,
        event.isCritical ?? false
      );
    } catch (alarmErr) {
      console.warn('[Geofencing] Native alarm dispatch error:', alarmErr);
    }
  }

  // Notify foreground UI immediately to display LocationArrivalModal
  if (isForeground) {
    DeviceEventEmitter.emit(GEOFENCE_TRIGGERED_EVENT, {
      taskId,
      triggerType,
      event,
    });
  }

  console.log(`[Geofencing] Fired ${triggerType} reminder for "${event.title}"`);

  if (Array.isArray(event.sharedWith) && event.sharedWith.length > 0) {
    api.post(`/tasks/${taskId}/buddy-near`, { triggerType }).catch((err: any) => {
      console.warn('[Buddy Alert] Notify failed:', err?.message);
    });
  }

  return true;
}

/**
 * Fetches current position safely inside headless background tasks with a strict timeout
 * so OS background execution budgets are never exceeded.
 */
async function getFastPositionForBackground(): Promise<Location.LocationObject | null> {
  try {
    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 45000 });
    if (lastKnown) return lastKnown;
  } catch {}

  try {
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 3500)
    );
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeoutPromise,
    ]);
    return fix;
  } catch {
    return null;
  }
}

/**
 * Evaluates a geofence transition for a single event. Used by background TaskManager.
 */
async function handleGeofenceTransition(
  eventType: Location.GeofencingEventType,
  region: Location.LocationRegion
) {
  const taskId = region.identifier;
  if (!taskId) return;

  const eventsStr = await AsyncStorage.getItem(EVENTS_STORAGE_KEY);
  if (!eventsStr) return;

  const events: Event[] = JSON.parse(eventsStr);
  const event = events.find((e) => e.id === taskId || e._id === taskId);
  if (!isTaskActiveForGeofence(event)) return;

  const targetEvent = event as Event;
  const triggerType: 'arrive' | 'leave' = targetEvent.triggerType === 'leave' ? 'leave' : 'arrive';
  const state = await loadGeofenceState();

  if (triggerType === 'leave') {
    if (eventType === Location.GeofencingEventType.Enter) {
      // Entered target location: prime the leave trigger & clear cooldown for exit
      state.inside[taskId] = true;
      delete state.lastFired[taskId];
      await saveGeofenceState(state);
      console.log(`[Geofencing] Leave task "${targetEvent.title}" primed on entry.`);
      return;
    }

    if (eventType === Location.GeofencingEventType.Exit) {
      state.inside[taskId] = false;
      await saveGeofenceState(state);

      if (!isWithinTimeGate(targetEvent.locationTimeGate)) {
        console.log(`[Geofencing] Leave blocked by time gate for "${targetEvent.title}".`);
        return;
      }

      await fireLocationAlarm(targetEvent, taskId, 'leave', state);
      return;
    }
    return;
  }

  // Trigger type: 'arrive'
  if (eventType === Location.GeofencingEventType.Exit) {
    state.inside[taskId] = false;
    // Leaving clears cooldown & pendingExit so next re-entry can trigger normally
    if (state.pendingExit[taskId]) {
      delete state.pendingExit[taskId];
    }
    if (state.lastFired[taskId]) {
      delete state.lastFired[taskId];
    }
    await saveGeofenceState(state);
    console.log(`[Geofencing] Exited Arrive zone for "${targetEvent.title}"; armed for next entry.`);
    return;
  }

  if (eventType !== Location.GeofencingEventType.Enter) return;

  state.inside[taskId] = true;

  // Fast speed check to avoid firing on high-speed highway pass-bys without sleeping minutes in background
  const loc = await getFastPositionForBackground();
  const rawSpeed = loc?.coords?.speed;
  const speedMph = typeof rawSpeed === 'number' && rawSpeed >= 0 ? rawSpeed * 2.23694 : 0;

  if (speedMph > 22) {
    try {
      const pendingRaw = await AsyncStorage.getItem(DRIVE_BY_PENDING_KEY);
      const pending: Record<string, number> = pendingRaw ? JSON.parse(pendingRaw) : {};
      pending[taskId] = Date.now();
      await AsyncStorage.setItem(DRIVE_BY_PENDING_KEY, JSON.stringify(pending));
      await saveGeofenceState(state);
      console.log(`[Geofencing] High speed (${speedMph.toFixed(1)} mph) — deferred drive-by check for "${targetEvent.title}".`);
      return;
    } catch {}
  }

  if (!isWithinTimeGate(targetEvent.locationTimeGate)) {
    await saveGeofenceState(state);
    console.log(`[Geofencing] Arrive blocked by time gate for "${targetEvent.title}".`);
    return;
  }

  if (state.pendingExit[taskId]) {
    delete state.pendingExit[taskId];
  }

  await fireLocationAlarm(targetEvent, taskId, 'arrive', state);
}

TaskManager.defineTask(GEOFENCING_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[Geofencing] Background task error:', error);
    return;
  }
  if (!data) return;

  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };

  try {
    await handleGeofenceTransition(eventType, region);
  } catch (e) {
    console.error('[Geofencing] Failed to process transition:', e);
  }
});

class GeofencingService {
  /**
   * Synchronizes all registered OS geofence regions against active events,
   * pruning completed/deleted entries and seeding inside states for Leave tasks.
   */
  async syncGeofences(events: Event[]): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      const activeEvents = events.filter(isTaskActiveForGeofence);
      const { status } = await Location.getBackgroundPermissionsAsync();

      const regions: Location.LocationRegion[] = activeEvents
        .slice(0, MAX_OS_REGIONS)
        .map((ev) => ({
          identifier: (ev.id || ev._id) as string,
          latitude: ev.locationDetails!.latitude!,
          longitude: ev.locationDetails!.longitude!,
          radius: ev.geofenceRadius || 500,
          notifyOnEnter: true,
          notifyOnExit: true,
        }));

      await AsyncStorage.setItem(REGIONS_STORAGE_KEY, JSON.stringify(regions));

      // Seed current inside/outside status so Leave tasks already at target location fire reliably
      await this.seedInsideStates(activeEvents);

      if (status !== 'granted') {
        console.log('[Geofencing] Background permission missing; OS geofencing sync deferred.');
        return;
      }

      if (regions.length > 0) {
        await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, regions);
        console.log(`[Geofencing] Synced ${regions.length} active geofence(s).`);
      } else {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK_NAME);
        if (isRegistered) {
          await Location.stopGeofencingAsync(GEOFENCING_TASK_NAME);
        }
      }
    } catch (error) {
      console.error('[Geofencing] syncGeofences error:', error);
    }
  }

  /**
   * Checks current coordinates against active events to prime Leave/Arrive inside-state.
   */
  async seedInsideStates(events: Event[]): Promise<void> {
    if (events.length === 0) return;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let pos = await Location.getLastKnownPositionAsync({ maxAge: 60000 });
      if (!pos) {
        const timeout = new Promise<null>((res) => setTimeout(() => res(null), 3000));
        pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          timeout,
        ]);
      }
      if (!pos) return;

      const state = await loadGeofenceState();
      let updated = false;

      for (const ev of events) {
        if (!isTaskActiveForGeofence(ev)) continue;
        const id = (ev.id || ev._id) as string;
        const radius = ev.geofenceRadius || 500;
        const dist = getDistanceMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          ev.locationDetails!.latitude!,
          ev.locationDetails!.longitude!
        );
        const currentlyInside = dist <= radius;

        // Always update Leave inside state if unknown or currently inside so exit fires accurately
        if (ev.triggerType === 'leave') {
          if (currentlyInside || state.inside[id] === undefined) {
            if (state.inside[id] !== currentlyInside) {
              state.inside[id] = currentlyInside;
              updated = true;
            }
          }
        } else if (state.inside[id] === undefined) {
          state.inside[id] = currentlyInside;
          updated = true;
        }
      }

      if (updated) {
        await saveGeofenceState(state);
      }
    } catch {
      // Non-fatal
    }
  }

  /**
   * Registers (or updates) geofence monitoring for a single event.
   */
  async startGeofence(event: Event): Promise<void> {
    if (Platform.OS === 'web' || !isTaskActiveForGeofence(event)) return;

    try {
      const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        const reqFg = await Location.requestForegroundPermissionsAsync();
        if (reqFg.status !== 'granted') return;
      }

      const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        await Location.requestBackgroundPermissionsAsync();
      }

      const eventsStr = await AsyncStorage.getItem(EVENTS_STORAGE_KEY);
      const storedEvents: Event[] = eventsStr ? JSON.parse(eventsStr) : [];
      const eventId = (event.id || event._id) as string;
      const merged = storedEvents.some((e) => e.id === eventId || e._id === eventId)
        ? storedEvents.map((e) => (e.id === eventId || e._id === eventId ? event : e))
        : [...storedEvents, event];

      await this.syncGeofences(merged);
    } catch (error) {
      console.error('[Geofencing] startGeofence error:', error);
    }
  }

  /**
   * Unregisters geofence monitoring for a completed or deleted event.
   */
  async stopGeofence(eventId: string): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      const regionsStr = await AsyncStorage.getItem(REGIONS_STORAGE_KEY);
      const regions: Location.LocationRegion[] = regionsStr ? JSON.parse(regionsStr) : [];
      const updatedRegions = regions.filter((r) => r.identifier !== eventId);
      await AsyncStorage.setItem(REGIONS_STORAGE_KEY, JSON.stringify(updatedRegions));

      const hasTask = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK_NAME);
      if (hasTask) {
        if (updatedRegions.length > 0) {
          await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, updatedRegions);
        } else {
          await Location.stopGeofencingAsync(GEOFENCING_TASK_NAME);
        }
      }

      const state = await loadGeofenceState();
      delete state.lastFired[eventId];
      delete state.inside[eventId];
      delete state.pendingExit[eventId];
      await saveGeofenceState(state);
    } catch (error) {
      console.error('[Geofencing] stopGeofence error:', error);
    }
  }

  /**
   * Runs a network/cell triangulation check (triggered by ActivityRecognition
   * when parking a car underground) for both Arrive and deferred drive-by tasks.
   */
  async forceGeofenceCheck(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const eventsStr = await AsyncStorage.getItem(EVENTS_STORAGE_KEY);
      if (!eventsStr) return;

      const events: Event[] = JSON.parse(eventsStr);
      const state = await loadGeofenceState();
      const pendingDriveRaw = await AsyncStorage.getItem(DRIVE_BY_PENDING_KEY);
      const pendingDrive: Record<string, number> = pendingDriveRaw ? JSON.parse(pendingDriveRaw) : {};
      let driveChanged = false;

      for (const event of events) {
        if (!isTaskActiveForGeofence(event)) continue;
        const id = (event.id || event._id) as string;
        const radius = event.geofenceRadius || 500;
        const dist = getDistanceMeters(
          loc.coords.latitude,
          loc.coords.longitude,
          event.locationDetails!.latitude!,
          event.locationDetails!.longitude!
        );

        const isInside = dist <= radius;
        const isLeave = event.triggerType === 'leave';

        if (!isLeave && isInside) {
          if (pendingDrive[id]) {
            delete pendingDrive[id];
            driveChanged = true;
          }
          if (isWithinTimeGate(event.locationTimeGate)) {
            state.inside[id] = true;
            await fireLocationAlarm(event, id, 'arrive', state);
          }
        } else if (isLeave && state.inside[id] && !isInside) {
          state.inside[id] = false;
          if (isWithinTimeGate(event.locationTimeGate)) {
            await fireLocationAlarm(event, id, 'leave', state);
          }
        }
      }

      if (driveChanged) {
        await AsyncStorage.setItem(DRIVE_BY_PENDING_KEY, JSON.stringify(pendingDrive));
      }
    } catch (e) {
      console.error('[Geofencing] forceGeofenceCheck error:', e);
    }
  }

  /**
   * Marks an Arrive task as snoozed until the user exits and re-enters the area (EC4).
   */
  async setTaskPendingExit(taskId: string): Promise<void> {
    try {
      const state = await loadGeofenceState();
      state.pendingExit[taskId] = true;
      await saveGeofenceState(state);
      console.log(`[Geofencing] Task "${taskId}" snoozed until exit & re-entry.`);
    } catch (e) {
      console.error('[Geofencing] setTaskPendingExit error:', e);
    }
  }
}

export const geofencingService = new GeofencingService();
