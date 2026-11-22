import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import * as Notifications from '../mock-expo-notifications';
import { Event } from '../models/Event';
import { priorityService } from '../services/priorityService';
import { alarmService } from '../services/alarmService';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRIGGERED_KEY = '@eventflow_geofence_triggered';
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Load cooldown timestamps from storage
async function loadTriggered(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(TRIGGERED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveTriggered(data: Record<string, number>): Promise<void> {
  try {
    await AsyncStorage.setItem(TRIGGERED_KEY, JSON.stringify(data));
  } catch {}
}

export function useLocation(tasks: Event[] = []) {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [arrivedTask, setArrivedTask] = useState<Event | null>(null);
  const [arrivedTriggerType, setArrivedTriggerType] = useState<'arrive' | 'leave'>('arrive');

  // Keep a ref so the watchPosition callback always has the latest tasks list
  const tasksRef = useRef<Event[]>(tasks);
  tasksRef.current = tasks;

  // Keep previous location to detect leave events
  const prevLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  // Track whether we were inside each geofence
  const insideGeofences = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    async function initLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }

        let coords = { latitude: 37.7749, longitude: -122.4194 };
        try {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        } catch {
          try {
            const lastKnown = await Location.getLastKnownPositionAsync();
            if (lastKnown) {
              coords = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
            }
          } catch {}
        }

        setLocation(coords);
        prevLocationRef.current = coords;

        // Reverse geocode to get readable address
        try {
          const [result] = await Location.reverseGeocodeAsync(coords);
          if (result) {
            const formattedAddr = [result.name, result.street, result.city, result.region].filter(Boolean).join(', ');
            setAddress(formattedAddr);
          }
        } catch (e) {
          console.warn('Reverse geocode error:', e);
        }

        // Start real-time location watcher
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 8000,
            distanceInterval: 20,
          },
          async (loc: Location.LocationObject) => {
            const updated = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setLocation(updated);
            // Always pass the latest tasks from ref
            await checkGeofenceAlerts(updated);
            prevLocationRef.current = updated;
          }
        );
      } catch (err: any) {
        setErrorMsg(err.message || 'Location service error');
      }
    }

    initLocation();

    return () => {
      if (subscription) subscription.remove();
    };
  // Only re-run if we need to restart the watcher (tasks.length change not needed due to ref)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkGeofenceAlerts = async (
    userCoords: { latitude: number; longitude: number }
  ) => {
    const now = Date.now();
    const pendingTasks = tasksRef.current; // always fresh

    const triggered = await loadTriggered();
    let changed = false;

    for (const task of pendingTasks) {
      if (
        !task.completed &&
        task.status !== 'completed' &&
        task.locationReminderEnabled &&
        task.locationDetails?.latitude &&
        task.locationDetails?.longitude
      ) {
        // Skip tasks created in the last 30s (avoid instant trigger on save)
        const createdAt = task.createdAt ? new Date(task.createdAt).getTime() : now;
        if (now - createdAt < 30000) continue;

        // EC2: Respect Time-Gate window if configured
        if (task.locationTimeGate) {
          const currentDate = new Date();
          const currentHour = currentDate.getHours();
          const currentDay = WEEKDAY_NAMES[currentDate.getDay()];
          const { startHour, endHour, days } = task.locationTimeGate;

          const isSameDayGate = startHour <= endHour;
          let isTimeValid = false;

          if (isSameDayGate) {
            isTimeValid = currentHour >= startHour && currentHour < endHour;
          } else {
            isTimeValid = currentHour >= startHour || currentHour < endHour;
          }

          if (!days.includes(currentDay) || !isTimeValid) {
            continue; // Outside allowed time-gate window
          }
        }

        const targetRadius = (task.locationDetails as any).radius || task.geofenceRadius || 500;
        const dist = priorityService.getDistance(
          userCoords.latitude,
          userCoords.longitude,
          task.locationDetails.latitude,
          task.locationDetails.longitude
        );

        const wasInside = insideGeofences.current[task.id] ?? false;
        const isInside = dist <= targetRadius;
        const triggerType = task.triggerType || 'arrive';

        // Detect transition: outside → inside
        if (!wasInside && isInside) {
          insideGeofences.current[task.id] = true;

          if (triggerType === 'arrive') {
            const lastTriggered = triggered[task.id] || 0;
            // Cooldown: 20 minutes per task
            if (now - lastTriggered > 20 * 60 * 1000) {
              triggered[task.id] = now;
              changed = true;
              setArrivedTask(task);
              setArrivedTriggerType('arrive');

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

              try {
                const locationLabel = task.location || 'Your Destination';
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: `📍 Arrived Near ${locationLabel}!`,
                    body: `Location reminder: "${task.title}" — tap to start the task.`,
                    data: { eventId: task.id, type: 'geofence', triggerType: 'arrive' },
                    sound: 'default',
                    priority: Notifications.AndroidNotificationPriority.MAX,
                    vibrate: [0, 300, 200, 300],
                  } as any,
                  trigger: null,
                });

                if (task.isCritical) {
                  await alarmService.scheduleAlarm(
                    `geo_arr_${task.id}_${Date.now()}`,
                    Date.now() + 1000,
                    `🚨 Arrived at ${locationLabel}`,
                    `Critical Task: ${task.title}`,
                    task.id,
                    true
                  );
                }
              } catch (notifyErr) {
                console.warn('Geofence arrival notification error:', notifyErr);
              }
            }
          }
        }

        // Detect transition: inside → outside
        if (wasInside && !isInside) {
          insideGeofences.current[task.id] = false;

          if (triggerType === 'leave') {
            const lastTriggered = triggered[task.id] || 0;
            if (now - lastTriggered > 20 * 60 * 1000) {
              triggered[task.id] = now;
              changed = true;
              setArrivedTask(task);
              setArrivedTriggerType('leave');

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

              try {
                const locationLabel = task.location || 'Your Destination';
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: `🚶 Leaving ${locationLabel}!`,
                    body: `Don't forget: "${task.title}" is associated with this location!`,
                    data: { eventId: task.id, type: 'geofence', triggerType: 'leave' },
                    sound: 'default',
                    priority: Notifications.AndroidNotificationPriority.MAX,
                    vibrate: [0, 250, 150, 250],
                  } as any,
                  trigger: null,
                });

                if (task.isCritical) {
                  await alarmService.scheduleAlarm(
                    `geo_lev_${task.id}_${Date.now()}`,
                    Date.now() + 1000,
                    `🚨 Leaving ${locationLabel}`,
                    `Critical Task: ${task.title}`,
                    task.id,
                    true
                  );
                }
              } catch (notifyErr) {
                console.warn('Geofence leave notification error:', notifyErr);
              }
            }
          }
        }
      }
    }

    if (changed) {
      await saveTriggered(triggered);
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const [res] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (res) {
        return [res.name, res.street, res.city].filter(Boolean).join(', ');
      }
    } catch (e) {
      console.warn(e);
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  const geocodeAddress = async (queryText: string) => {
    try {
      const results = await Location.geocodeAsync(queryText);
      if (results && results.length > 0) {
        return { latitude: results[0].latitude, longitude: results[0].longitude };
      }
    } catch (e) {
      console.warn(e);
    }
    return null;
  };

  const searchPlaces = async (queryText: string) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryText)}&format=json&addressdetails=1&limit=5`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'EventFlowApp/1.0 (contact@eventflow.app)'
        }
      });
      const data = await response.json();
      return data.map((item: any) => ({
        id: item.place_id,
        name: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon)
      }));
    } catch (e) {
      console.warn('Place search error:', e);
      return [];
    }
  };

  return {
    location,
    address,
    errorMsg,
    arrivedTask,
    arrivedTriggerType,
    dismissArrivedTask: () => setArrivedTask(null),
    reverseGeocode,
    geocodeAddress,
    searchPlaces,
  };
}
