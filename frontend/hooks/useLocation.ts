 
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import * as Location from 'expo-location';
import { Event } from '../models/Event';
import {
  GEOFENCE_TRIGGERED_EVENT,
  fireLocationAlarm,
  getDistanceMeters,
  isTaskActiveForGeofence,
  isWithinTimeGate,
  loadGeofenceState,
  saveGeofenceState,
} from '../services/geofencingService';

interface UseLocationOptions {
  enableMonitoring?: boolean;
}

export function useLocation(tasks: Event[] = [], options: UseLocationOptions = {}) {
  const { enableMonitoring = true } = options;

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [arrivedTask, setArrivedTask] = useState<Event | null>(null);
  const [arrivedTriggerType, setArrivedTriggerType] = useState<'arrive' | 'leave'>('arrive');

  const tasksRef = useRef<Event[]>(tasks);
  tasksRef.current = tasks;

  const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const isCheckingRef = useRef(false);

  const checkGeofenceAlerts = useCallback(
    async (userCoords: { latitude: number; longitude: number }) => {
      if (!enableMonitoring || isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        const now = Date.now();
        const pendingTasks = tasksRef.current;
        const state = await loadGeofenceState();
        let stateModified = false;

        for (const task of pendingTasks) {
          if (!isTaskActiveForGeofence(task)) continue;

          const taskId = (task.id || task._id) as string;
          const targetRadius = (task.locationDetails as any)?.radius || task.geofenceRadius || 500;
          // Hysteresis buffer prevents GPS drift from triggering false Leave exits indoors
          const exitRadius = targetRadius + Math.min(25, Math.round(targetRadius * 0.1));
          const dist = getDistanceMeters(
            userCoords.latitude,
            userCoords.longitude,
            task.locationDetails!.latitude!,
            task.locationDetails!.longitude!
          );

          const wasInside = state.inside[taskId] ?? false;
          const isInside = dist <= targetRadius;
          const isOutside = dist > exitRadius;
          const triggerType: 'arrive' | 'leave' = task.triggerType === 'leave' ? 'leave' : 'arrive';

          // Always prime Leave state immediately if currently inside (even during creation grace period)
          const createdAt = task.createdAt ? new Date(task.createdAt).getTime() : 0;
          if (createdAt && now - createdAt < 30000) {
            if (triggerType === 'leave' && isInside && !state.inside[taskId]) {
              state.inside[taskId] = true;
              stateModified = true;
            }
            continue;
          }

          if (triggerType === 'arrive') {
            if (!wasInside && isInside) {
              state.inside[taskId] = true;
              stateModified = true;

              if (state.pendingExit[taskId]) {
                delete state.pendingExit[taskId];
              }

              if (isWithinTimeGate(task.locationTimeGate)) {
                await fireLocationAlarm(task, taskId, 'arrive', state);
              }
            } else if (wasInside && isOutside) {
              state.inside[taskId] = false;
              delete state.pendingExit[taskId];
              delete state.lastFired[taskId];
              stateModified = true;
            }
          } else {
            // Trigger type: 'leave'
            if (!wasInside && isInside) {
              state.inside[taskId] = true;
              delete state.lastFired[taskId];
              stateModified = true;
            } else if (wasInside && isOutside) {
              state.inside[taskId] = false;
              stateModified = true;

              if (isWithinTimeGate(task.locationTimeGate)) {
                await fireLocationAlarm(task, taskId, 'leave', state);
              }
            }
          }
        }

        if (stateModified) {
          await saveGeofenceState(state);
        }
      } catch (err) {
        console.warn('[useLocation] checkGeofenceAlerts error:', err);
      } finally {
        isCheckingRef.current = false;
      }
    },
    [enableMonitoring]
  );

  // Listen to geofence events fired by background OS or foreground checks
  useEffect(() => {
    if (!enableMonitoring) return;

    const sub = DeviceEventEmitter.addListener(
      GEOFENCE_TRIGGERED_EVENT,
      (payload: { taskId: string; triggerType: 'arrive' | 'leave'; event?: Event }) => {
        const matched =
          payload.event ||
          tasksRef.current.find((t) => (t.id || t._id) === payload.taskId) ||
          null;
        if (matched && !matched.completed && matched.status !== 'completed') {
          setArrivedTriggerType(payload.triggerType || 'arrive');
          setArrivedTask(matched);
        }
      }
    );

    return () => sub.remove();
  }, [enableMonitoring]);

  // Re-evaluate geofences whenever task list updates (e.g. creating a Leave task at Home)
  useEffect(() => {
    if (enableMonitoring && locationRef.current) {
      checkGeofenceAlerts(locationRef.current);
    }
  }, [tasks, enableMonitoring, checkGeofenceAlerts]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let isMounted = true;

    async function initLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) setErrorMsg('Permission to access location was denied');
          return;
        }

        let coords: { latitude: number; longitude: number } | null = null;
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

        if (!isMounted || !coords) return;

        locationRef.current = coords;
        setLocation(coords);

        if (enableMonitoring) {
          await checkGeofenceAlerts(coords);
        }

        // Reverse geocode current address
        try {
          const [result] = await Location.reverseGeocodeAsync(coords);
          if (result && isMounted) {
            const formattedAddr = [result.name, result.street, result.city, result.region]
              .filter(Boolean)
              .join(', ');
            setAddress(formattedAddr);
          }
        } catch {}

        if (!enableMonitoring) return;

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 8000,
            distanceInterval: 15,
          },
          async (loc: Location.LocationObject) => {
            if (!isMounted) return;
            const updated = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            locationRef.current = updated;
            setLocation(updated);
            await checkGeofenceAlerts(updated);
          }
        );
      } catch (err: any) {
        if (isMounted) setErrorMsg(err?.message || 'Location service error');
      }
    }

    initLocation();

    const appSub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active' && enableMonitoring) {
        try {
          const pos = await Location.getLastKnownPositionAsync({ maxAge: 30000 });
          if (pos && isMounted) {
            const updated = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            locationRef.current = updated;
            setLocation(updated);
            await checkGeofenceAlerts(updated);
          }
        } catch {}
      }
    });

    return () => {
      isMounted = false;
      subscription?.remove();
      appSub.remove();
    };
  }, [enableMonitoring, checkGeofenceAlerts]);

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
          'User-Agent': 'EventFlowApp/2.0 (contact@eventflow.app)',
        },
      });
      const data = await response.json();
      return data.map((item: any) => ({
        id: item.place_id,
        name: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
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
