import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from '../mock-expo-notifications';
import { Event } from '../models/Event';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const GEOFENCING_TASK_NAME = 'BACKGROUND_GEOFENCE_TASK';
const TRIGGERED_TASKS_KEY = 'geofencing_triggered_tasks';
const PENDING_EXIT_KEY = 'geofencing_pending_exit_tasks';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Haversine distance helper ────────────────────────────────────────────────
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Shared alarm-fire helper ──────────────────────────────────────────────────
async function fireLocationAlarm(
  event: Event,
  triggeredTasks: Record<string, boolean>,
  taskId: string,
  triggerType: 'arrive' | 'leave' = 'arrive'
) {
  const alarmService = require('./alarmService').alarmService;
  const isArrive = triggerType === 'arrive';
  const locationLabel = event.location || 'Location';

  const notifTitle = isArrive
    ? `📍 Arrived Near ${locationLabel}!`
    : `🚶 Leaving ${locationLabel}!`;

  const notifBody = isArrive
    ? `Task: "${event.title}" is linked to this location. Ready to start?`
    : `Don't forget: "${event.title}" is linked to this location before you go!`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: notifTitle,
      body: notifBody,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: isArrive ? [0, 300, 200, 300] : [0, 250, 150, 250],
      data: {
        eventId: event.id || event._id,
        triggerType,
        type: 'geofence',
      },
    },
    trigger: null,
  });

  // Pass isCritical to the native alarm so it can override volume if needed (EC5)
  await alarmService.scheduleAlarm(
    `geo_${taskId}_${Date.now()}`,
    Date.now() + 1000,
    notifTitle,
    `Task: ${event.title}\nLocation: ${locationLabel}`,
    (event.id || event._id) as string,
    event.isCritical ?? false
  );

  triggeredTasks[taskId] = true;
  await AsyncStorage.setItem(TRIGGERED_TASKS_KEY, JSON.stringify(triggeredTasks));
  console.log(`[Smart Context] 🔔 Alarm fired (${triggerType}) for task "${event.title}"`);

  // ── Geofence Buddy Alert ─────────────────────────────────────────────────
  // If this is a shared task, notify the owner and other members that I'm near / leaving.
  if (event.sharedWith && (event.sharedWith as string[]).length > 0) {
    api.post(`/tasks/${event.id || event._id}/buddy-near`, { triggerType }).catch((err: any) => {
      console.warn('[Buddy Alert] Could not notify task members:', err?.message);
    });
  }
  // ─────────────────────────────────────────────────────────────────────────
}


// ─── Background Task Definition ───────────────────────────────────────────────
TaskManager.defineTask(GEOFENCING_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[Smart Context] Geofencing task error:', error);
    return;
  }
  if (!data) return;

  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };
  const taskId = region.identifier;
  if (!taskId) return;

  try {
    const triggeredStr = await AsyncStorage.getItem(TRIGGERED_TASKS_KEY);
    let triggeredTasks: Record<string, boolean> = triggeredStr ? JSON.parse(triggeredStr) : {};

    const pendingExitStr = await AsyncStorage.getItem(PENDING_EXIT_KEY);
    let pendingExitTasks: Record<string, boolean> = pendingExitStr ? JSON.parse(pendingExitStr) : {};

    const eventsStr = await AsyncStorage.getItem('@eventflow_events');
    if (!eventsStr) return;
    const events: Event[] = JSON.parse(eventsStr);
    const event = events.find((e: Event) => e.id === taskId || e._id === taskId);
    if (!event || !event.locationReminderEnabled) return;

    const isLeave = event.triggerType === 'leave';

    // ── CASE A: EVENT TRIGGER TYPE IS 'LEAVE' ─────────────────────────────────
    if (isLeave) {
      if (eventType === Location.GeofencingEventType.Enter) {
        // User entered the location: prime the leave trigger by resetting triggered state
        if (triggeredTasks[taskId]) {
          delete triggeredTasks[taskId];
          await AsyncStorage.setItem(TRIGGERED_TASKS_KEY, JSON.stringify(triggeredTasks));
          console.log(`[Smart Context] 📍 Entered geofence for Leave task "${event.title}". Primed to trigger on exit.`);
        }
        return;
      }

      if (eventType === Location.GeofencingEventType.Exit) {
        // User is leaving the location: this is the trigger!
        if (triggeredTasks[taskId]) {
          console.log(`[Smart Context] 🚶 Leave task "${event.title}" already triggered.`);
          return;
        }

        // Time-Gate check for leave
        if (event.locationTimeGate) {
          const now = new Date();
          const currentHour = now.getHours();
          const currentDay = WEEKDAY_NAMES[now.getDay()];
          const { startHour, endHour, days } = event.locationTimeGate;

          const isSameDayGate = startHour <= endHour;
          let isTimeValid = false;

          if (isSameDayGate) {
            isTimeValid = currentHour >= startHour && currentHour < endHour;
          } else {
            isTimeValid = currentHour >= startHour || currentHour < endHour;
          }

          if (!days.includes(currentDay) || !isTimeValid) {
            console.log(`[Smart Context] EC2: ⏰ Time gate blocked for leave task "${event.title}".`);
            return;
          }
        }

        // Fire leave alarm!
        await fireLocationAlarm(event, triggeredTasks, taskId, 'leave');
        return;
      }
    }

    // ── CASE B: EVENT TRIGGER TYPE IS 'ARRIVE' ────────────────────────────────
    // On exit: clear triggered tasks so user can receive arrival alarm again next time
    if (eventType === Location.GeofencingEventType.Exit) {
      if (pendingExitTasks[taskId]) {
        delete pendingExitTasks[taskId];
        delete triggeredTasks[taskId];
        await AsyncStorage.setItem(PENDING_EXIT_KEY, JSON.stringify(pendingExitTasks));
        await AsyncStorage.setItem(TRIGGERED_TASKS_KEY, JSON.stringify(triggeredTasks));
        console.log(`[Smart Context] EC4: 🚶 "${event.title}" exited. Ready to re-trigger on next arrival.`);
        return;
      }
      if (triggeredTasks[taskId]) {
        delete triggeredTasks[taskId];
        await AsyncStorage.setItem(TRIGGERED_TASKS_KEY, JSON.stringify(triggeredTasks));
        console.log(`[Smart Context] 🚶 Reset arrive trigger for "${event.title}" after exit.`);
      }
      return;
    }

    // On enter: verify if arrival alarm should fire
    if (eventType !== Location.GeofencingEventType.Enter) return;
    if (triggeredTasks[taskId]) return; // Already triggered

    // ==== EC1: Drive-By Prevention (Speed & 3-min Dwell Time) ====
    let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    let speedMPH = (loc.coords.speed || 0) * 2.23694;
    console.log(`[Smart Context] EC1: Enter detected — speed ${speedMPH.toFixed(1)} mph`);

    if (speedMPH > 15) {
      console.log(`[Smart Context] EC1: 🚗 Drive-by suspected. Waiting 3 min for dwell check...`);
      await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));

      loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      speedMPH = (loc.coords.speed || 0) * 2.23694;
      const distance = getDistanceFromLatLonInM(
        loc.coords.latitude, loc.coords.longitude,
        region.latitude, region.longitude
      );

      if (distance > region.radius) {
        console.log(`[Smart Context] EC1: ❌ Left during dwell (${distance.toFixed(0)}m > ${region.radius}m). Aborted.`);
        return;
      }
      if (speedMPH > 15) {
        console.log(`[Smart Context] EC1: ❌ Still moving at ${speedMPH.toFixed(1)} mph. Aborted.`);
        return;
      }
      console.log(`[Smart Context] EC1: ✅ Dwell check passed. Continuing...`);
    }
    // =============================================================

    // ==== EC2: Time-Gated Locations ====
    if (event.locationTimeGate) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = WEEKDAY_NAMES[now.getDay()];
      const { startHour, endHour, days } = event.locationTimeGate;

      const isSameDayGate = startHour <= endHour;
      let isTimeValid = false;

      if (isSameDayGate) {
        isTimeValid = currentHour >= startHour && currentHour < endHour;
      } else {
        isTimeValid = currentHour >= startHour || currentHour < endHour;
      }

      if (!days.includes(currentDay) || !isTimeValid) {
        console.log(
          `[Smart Context] EC2: ⏰ Time gate blocked — ${currentDay} ${currentHour}:xx ` +
          `is outside allowed windows. Alarm skipped.`
        );
        return;
      }
      console.log(`[Smart Context] EC2: ✅ Time gate passed — ${currentDay} ${currentHour}:xx is allowed.`);
    }
    // ===================================

    // ==== EC4: Re-entry after Pending-Exit Snooze ====
    if (pendingExitTasks[taskId]) {
      console.log(`[Smart Context] EC4: 🔁 Re-entry for pending_exit task "${event.title}". Firing alarm.`);
      delete pendingExitTasks[taskId];
      await AsyncStorage.setItem(PENDING_EXIT_KEY, JSON.stringify(pendingExitTasks));
      await fireLocationAlarm(event, triggeredTasks, taskId, 'arrive');
      return;
    }
    // =================================================

    // All checks passed — fire arrive alarm
    await fireLocationAlarm(event, triggeredTasks, taskId, 'arrive');

  } catch (e) {
    console.error('[Smart Context] Failed to handle geofencing event:', e);
  }
});

// ─── GeofencingService Class ──────────────────────────────────────────────────
class GeofencingService {

  /** Start monitoring a geofence for the given event. */
  async startGeofence(event: Event) {
    if (!event.locationReminderEnabled || !event.locationDetails?.latitude || !event.locationDetails?.longitude) {
      return;
    }
    try {
      const { status } = await Location.getBackgroundPermissionsAsync();
      if (status !== 'granted') {
        const { status: reqStatus } = await Location.requestBackgroundPermissionsAsync();
        if (reqStatus !== 'granted') {
          console.warn('[Smart Context] Background location permission denied');
          return;
        }
      }

      const regionsStr = await AsyncStorage.getItem('geofencing_regions');
      const regions: Location.LocationRegion[] = regionsStr ? JSON.parse(regionsStr) : [];
      const eventId = (event.id || event._id) as string;
      const updatedRegions = regions.filter(r => r.identifier !== eventId);

      updatedRegions.push({
        identifier: eventId,
        latitude: event.locationDetails.latitude,
        longitude: event.locationDetails.longitude,
        radius: event.geofenceRadius || 500,
        notifyOnEnter: true,
        notifyOnExit: true,
      });

      await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, updatedRegions);
      await AsyncStorage.setItem('geofencing_regions', JSON.stringify(updatedRegions));
    } catch (error) {
      console.error('[Smart Context] Failed to start geofencing:', error);
    }
  }

  /** Stop monitoring a geofence for the given event. */
  async stopGeofence(eventId: string) {
    try {
      const hasTask = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK_NAME);
      if (!hasTask) return;

      const regionsStr = await AsyncStorage.getItem('geofencing_regions');
      const regions: Location.LocationRegion[] = regionsStr ? JSON.parse(regionsStr) : [];
      const updatedRegions = regions.filter(r => r.identifier !== eventId);

      if (updatedRegions.length > 0) {
        await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, updatedRegions);
      } else {
        await Location.stopGeofencingAsync(GEOFENCING_TASK_NAME);
      }
      await AsyncStorage.setItem('geofencing_regions', JSON.stringify(updatedRegions));

      const triggeredStr = await AsyncStorage.getItem(TRIGGERED_TASKS_KEY);
      if (triggeredStr) {
        const triggeredTasks = JSON.parse(triggeredStr);
        if (triggeredTasks[eventId]) {
          delete triggeredTasks[eventId];
          await AsyncStorage.setItem(TRIGGERED_TASKS_KEY, JSON.stringify(triggeredTasks));
        }
      }
    } catch (error) {
      console.error('[Smart Context] Failed to stop geofencing:', error);
    }
  }

  /**
   * EC3 — Underground GPS Fallback:
   * Called by ActivityRecognitionService when an IN_VEHICLE → WALKING transition is detected.
   * Uses Network/Cell accuracy (works in underground garages) to manually check all geofences.
   */
  async forceGeofenceCheck() {
    console.log('[Smart Context] EC3: 🅿️ Activity transition → forcing network-based location check...');
    try {
      // Accuracy.Low = Network/Cell triangulation — GPS NOT required, works underground
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });

      const regionsStr = await AsyncStorage.getItem('geofencing_regions');
      if (!regionsStr) return;
      const regions: Location.LocationRegion[] = JSON.parse(regionsStr);

      const eventsStr = await AsyncStorage.getItem('@eventflow_events');
      if (!eventsStr) return;
      const events: Event[] = JSON.parse(eventsStr);

      const triggeredStr = await AsyncStorage.getItem(TRIGGERED_TASKS_KEY);
      let triggeredTasks: Record<string, boolean> = triggeredStr ? JSON.parse(triggeredStr) : {};

      for (const region of regions) {
        const distance = getDistanceFromLatLonInM(
          loc.coords.latitude, loc.coords.longitude,
          region.latitude, region.longitude
        );
        console.log(`[Smart Context] EC3: Region "${region.identifier}" — dist ${distance.toFixed(0)}m, radius ${region.radius}m`);

        if (!region.identifier) continue;
        if (distance <= region.radius && !triggeredTasks[region.identifier]) {
          const event = events.find(e => e.id === region.identifier || e._id === region.identifier);
          if (!event || !event.locationReminderEnabled || event.triggerType === 'leave') continue;

          // Respect time gate for network-triggered alarms too (EC2)
          if (event.locationTimeGate) {
            const now = new Date();
            const { startHour, endHour, days } = event.locationTimeGate;
            const currentHour = now.getHours();
            
            const isSameDayGate = startHour <= endHour;
            let isTimeValid = false;

            if (isSameDayGate) {
              isTimeValid = currentHour >= startHour && currentHour < endHour;
            } else {
              isTimeValid = currentHour >= startHour || currentHour < endHour;
            }

            if (!days.includes(WEEKDAY_NAMES[now.getDay()]) || !isTimeValid) {
              console.log(`[Smart Context] EC3: ⏰ Time gate blocked for "${event.title}". Skipping.`);
              continue;
            }
          }

          console.log(`[Smart Context] EC3: ✅ Network match for "${event.title}". Firing alarm!`);
          await fireLocationAlarm(event, triggeredTasks, region.identifier);
        }
      }
    } catch (e) {
      console.error('[Smart Context] EC3: forceGeofenceCheck failed:', e);
    }
  }

  /**
   * EC4 — Contextual Snooze (Pending Exit):
   * Marks the task so the alarm will NOT re-fire until the user physically
   * leaves the geofence AND re-enters it.
   */
  async setTaskPendingExit(taskId: string) {
    try {
      const pendingExitStr = await AsyncStorage.getItem(PENDING_EXIT_KEY);
      const pendingExitTasks: Record<string, boolean> = pendingExitStr ? JSON.parse(pendingExitStr) : {};
      pendingExitTasks[taskId] = true;
      await AsyncStorage.setItem(PENDING_EXIT_KEY, JSON.stringify(pendingExitTasks));
      console.log(`[Smart Context] EC4: ✅ Task "${taskId}" set to pending_exit.`);
    } catch (e) {
      console.error('[Smart Context] EC4: setTaskPendingExit failed:', e);
    }
  }
}

export const geofencingService = new GeofencingService();


