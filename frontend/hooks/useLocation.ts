import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Event } from '../models/Event';
import { priorityService } from '../services/priorityService';
import * as Haptics from 'expo-haptics';

// Track triggered tasks so we don't spam the user repeatedly while staying at the location
const triggeredGeofences: Record<string, number> = {};

export function useLocation(tasks: Event[] = []) {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [arrivedTask, setArrivedTask] = useState<Event | null>(null);

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
        } catch (e) {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            coords = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
          }
        }

        setLocation(coords);

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

        // Start real-time location watcher for geofencing triggers
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 8000,
            distanceInterval: 25,
          },
          async (loc: Location.LocationObject) => {
            const updated = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setLocation(updated);
            checkGeofenceAlerts(updated, tasks);
          }
        );
      } catch (err: any) {
        setErrorMsg(err.message || 'Location service error');
      }
    }

    initLocation();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [tasks.length]);

  const checkGeofenceAlerts = async (
    userCoords: { latitude: number; longitude: number }, 
    pendingTasks: Event[]
  ) => {
    const now = Date.now();

    for (const task of pendingTasks) {
      if (!task.completed && task.status !== 'completed' && task.locationDetails?.latitude && task.locationDetails?.longitude) {
        const targetRadius = (task.locationDetails as any).radius || 500;
        const dist = priorityService.getDistance(
          userCoords.latitude,
          userCoords.longitude,
          task.locationDetails.latitude,
          task.locationDetails.longitude
        );

        if (dist <= targetRadius) {
          const lastTriggered = triggeredGeofences[task.id] || 0;
          // Cool down: trigger once every 20 minutes per task
          if (now - lastTriggered > 20 * 60 * 1000) {
            triggeredGeofences[task.id] = now;
            setArrivedTask(task);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            // Immediate Loud Proximity Notification
            try {
              const locationLabel = task.location || 'Your Destination';
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: `📍 Arrived Near ${locationLabel}!`,
                  body: `Don't forget: "${task.title}". Tap to complete or focus!`,
                  data: { eventId: task.id, type: 'geofence', location: locationLabel },
                  sound: 'default',
                  priority: Notifications.AndroidNotificationPriority.MAX,
                  vibrate: [0, 500, 250, 500, 250, 500],
                  ...(Platform.OS === 'android' ? { channelId: 'focusflow_alarm_v2' } : {})
                } as any,
                trigger: null // Immediate trigger
              });
            } catch (notifyErr) {
              console.warn('Geofence notification error:', notifyErr);
            }
          }
        }
      }
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

  return {
    location,
    address,
    errorMsg,
    arrivedTask,
    dismissArrivedTask: () => setArrivedTask(null),
    reverseGeocode,
    geocodeAddress
  };
}
