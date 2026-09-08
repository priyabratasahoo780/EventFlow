import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from '../mock-expo-notifications';
import { Event } from '../models/Event';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GEOFENCING_TASK_NAME = 'BACKGROUND_GEOFENCE_TASK';
const TRIGGERED_TASKS_KEY = 'geofencing_triggered_tasks';

// Define the background task globally
TaskManager.defineTask(GEOFENCING_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Geofencing task error:', error);
    return;
  }
  
  if (data) {
    const { eventType, region } = data as { eventType: Location.GeofencingEventType; region: Location.LocationRegion };
    const taskId = region.identifier;

    if (!taskId) return;

    try {
      // 1. Get triggered status from storage
      const triggeredStr = await AsyncStorage.getItem(TRIGGERED_TASKS_KEY);
      let triggeredTasks: Record<string, boolean> = triggeredStr ? JSON.parse(triggeredStr) : {};

      // 2. Fetch the actual task from AsyncStorage
      const eventsStr = await AsyncStorage.getItem('@eventflow_events');
      if (!eventsStr) return;
      
      const events: Event[] = JSON.parse(eventsStr);
      const event = events.find((e: Event) => e.id === taskId || e._id === taskId);
      
      if (!event || !event.locationReminderEnabled) return;

      const expectedTrigger = event.triggerType === 'leave' 
        ? Location.GeofencingEventType.Exit 
        : Location.GeofencingEventType.Enter;

      if (eventType === expectedTrigger) {
        // Check if we already notified for this state
        if (!triggeredTasks[taskId]) {
          // 1. Trigger Notification
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `📍 Location Reminder`,
              body: `You're ${expectedTrigger === Location.GeofencingEventType.Enter ? 'near' : 'leaving'} ${event.location || 'the location'}.\n\nTask: ${event.title}\nDon't forget to complete this task.`,
              sound: true,
              data: { eventId: event.id || event._id },
            },
            trigger: null,
          });

          // 2. Trigger Full-Screen Native Alarm (fires in 1 second)
          const alarmService = require('./alarmService').alarmService;
          await alarmService.scheduleAlarm(
            `geo_${taskId}_${Date.now()}`,
            Date.now() + 1000,
            "📍 Location Alarm",
            `Task: ${event.title}\nLocation: ${event.location || 'Unknown'}`,
            (event.id || event._id) as string
          );

          // Mark as triggered
          triggeredTasks[taskId] = true;
          await AsyncStorage.setItem(TRIGGERED_TASKS_KEY, JSON.stringify(triggeredTasks));
        }
      } else {
        // Reset triggered state if they do the opposite action
        if (triggeredTasks[taskId]) {
          delete triggeredTasks[taskId];
          await AsyncStorage.setItem(TRIGGERED_TASKS_KEY, JSON.stringify(triggeredTasks));
        }
      }
    } catch (e) {
      console.error('Failed to handle geofencing event', e);
    }
  }
});

class GeofencingService {
  async startGeofence(event: Event) {
    if (!event.locationReminderEnabled || !event.locationDetails?.latitude || !event.locationDetails?.longitude) {
      return;
    }

    try {
      const { status } = await Location.getBackgroundPermissionsAsync();
      if (status !== 'granted') {
        const { status: reqStatus } = await Location.requestBackgroundPermissionsAsync();
        if (reqStatus !== 'granted') {
          console.warn('Background location permission denied');
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
      console.error('Failed to start geofencing:', error);
    }
  }

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
        let triggeredTasks = JSON.parse(triggeredStr);
        if (triggeredTasks[eventId]) {
          delete triggeredTasks[eventId];
          await AsyncStorage.setItem(TRIGGERED_TASKS_KEY, JSON.stringify(triggeredTasks));
        }
      }
    } catch (error) {
      console.error('Failed to stop geofencing:', error);
    }
  }
}

export const geofencingService = new GeofencingService();
