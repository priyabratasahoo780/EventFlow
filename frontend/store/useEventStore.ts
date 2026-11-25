
/**
 * useEventStore.ts
 * Core state store managing events, alarms, filtering, and cloud synchronization.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event, EventFilters, TaskStatus, ReminderConfig } from '../models/Event';
import { storageService } from '../services/storageService';
import { notificationService } from '../services/notificationService';
import { priorityService } from '../services/priorityService';
import { Platform } from 'react-native';
import * as Notifications from '../mock-expo-notifications';
import * as Haptics from 'expo-haptics';
import api from '../services/api';
import { socketService } from '../services/socketService';
import { geofencingService } from '../services/geofencingService';
import { zenModeService } from '../services/zenModeService';
import { behaviorService } from '../services/behaviorService';
import { alarmService } from '../services/alarmService';
import { useCelebrationStore } from './useCelebrationStore';

export function parseDeadline(event: { date?: string; time?: string; isAllDay?: boolean }): Date | null {
  if (!event.date) return null;

  if (event.date.includes('Z') || /[+-]\d{2}:\d{2}$/.test(event.date)) {
    return new Date(event.date);
  }

  if (event.isAllDay) {
    const dateStr = event.date.split('T')[0];
    return new Date(`${dateStr}T23:59:59`);
  }

  const dateStr = event.date.split('T')[0];
  if (event.time && event.time.trim()) {
    const timeStr = event.time.trim();
    const normalizedTime = timeStr.length <= 5 ? `${timeStr}:00` : timeStr;
    return new Date(`${dateStr}T${normalizedTime}`);
  }

  return new Date(`${dateStr}T23:59:59`);
}

export interface BuddyAlertPayload {
  taskId: string;
  taskTitle: string;
  taskLocation: string;
  taskChecklist: Array<{ id: string; text: string; completed: boolean }>;
  friendId: string;
  friendName: string;
  friendUsername: string;
  friendPhoto: string;
}


interface EventState {
  events: Event[];
  friendsEvents: any[];
  filters: EventFilters;
  isLoading: boolean;
  isSocketInitialized: boolean;

  buddyAlert: BuddyAlertPayload | null;

  // Actions
  loadEvents: () => Promise<void>;
  addEvent: (event: Event) => Promise<void>;
  updateEvent: (event: Event) => Promise<void>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  clearCompletedEvents: () => Promise<void>;
  toggleEventCompletion: (id: string) => Promise<void>;
  setFilters: (filters: Partial<EventFilters>) => void;
  syncFriendSharedEvents: () => Promise<any[]>;
  initSocket: () => void;
  clearBuddyAlert: () => void;

  // Getters
  getFilteredEvents: (userLocation?: { latitude: number; longitude: number } | null) => Event[];
  getEventsByDate: (date: string) => Event[];
  getTopRecommendation: (userLocation?: { latitude: number; longitude: number } | null) => Event | null;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  friendsEvents: [],
  isLoading: true,
  isSocketInitialized: false,
  buddyAlert: null,
  filters: {
    searchQuery: '',
    category: 'all',
    status: 'all',
    timeframe: 'all',
    priority: 'all',
  },

  initSocket: () => {
    if (get().isSocketInitialized) return;
    socketService.connect();

    socketService.on('task_updated', async (updatedEvent: Event) => {
      const { events, friendsEvents } = get();
      const newEvents = events.map(e => e.id === updatedEvent.id ? updatedEvent : e);
      const newFriendsEvents = friendsEvents.map(e => (e.id || e._id) === (updatedEvent.id || updatedEvent._id) ? updatedEvent : e);
      set({ events: newEvents, friendsEvents: newFriendsEvents });

      try {
        if (updatedEvent.completed || updatedEvent.status === 'completed') {
          const idsToCancel = (updatedEvent.reminders || []).flatMap(r => r.notificationIds || []);
          await notificationService.cancelEventNotifications(updatedEvent.id, idsToCancel);
        } else {
          const reminders: ReminderConfig[] = (updatedEvent.reminders && updatedEvent.reminders.length > 0)
            ? updatedEvent.reminders
            : [{ id: 'rem_' + Date.now(), type: 'exact', time: updatedEvent.time, date: updatedEvent.date.split('T')[0] }];
          
          await notificationService.scheduleEventNotifications({
            ...updatedEvent,
            title: `👥 ${typeof updatedEvent.ownerId === 'object' && updatedEvent.ownerId?.name ? updatedEvent.ownerId.name + ': ' : ''}${updatedEvent.title}`
          }, reminders);
        }
      } catch (scheduleErr) {
        console.warn('Error rescheduling updated shared event alarms:', scheduleErr);
      }
    });

    socketService.on('task_created', async (rawNewEvent: Event) => {
      const { events, friendsEvents } = get();
      const newEvent: Event = { ...rawNewEvent, id: rawNewEvent.id || rawNewEvent._id || '' };
      const alreadyExists = events.find(e => {
        const eId = e.id || e._id;
        const newId = newEvent.id || newEvent._id;
        return eId === newId;
      });
      if (!alreadyExists) {
        set({ events: [...events, newEvent], friendsEvents: [...friendsEvents, newEvent] });
      }

      try {
        const reminders: ReminderConfig[] = (newEvent.reminders && newEvent.reminders.length > 0)
          ? newEvent.reminders
          : [{ id: 'rem_' + Date.now(), type: 'exact', time: newEvent.time, date: newEvent.date.split('T')[0] }];
        
        await notificationService.scheduleEventNotifications({
          ...newEvent,
          title: `👥 ${typeof newEvent.ownerId === 'object' && newEvent.ownerId?.name ? newEvent.ownerId.name + ': ' : ''}${newEvent.title}`
        }, reminders);
      } catch (scheduleErr) {
        console.warn('Error scheduling friend shared event alarm:', scheduleErr);
      }
    });

    socketService.on('task_deleted', (deletedId: string) => {
      const { events } = get();
      set({ events: events.filter(e => e.id !== deletedId && e._id !== deletedId) });
    });

    socketService.on('cheer_received', async (data: { message: string; senderName?: string; senderUsername?: string }) => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `📣 ${data.senderName || 'Your friend'} cheered you on!`,
            body: data.message,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 250, 250, 250],
            ...(Platform.OS === 'android' ? { channelId: 'focusflow_alarm_v2' } : {})
          } as any,
          trigger: null,
        });
      } catch (err) {
        console.warn('Cheer notification display error:', err);
      }
    });
    
    socketService.on('buddy_near_location', (payload: BuddyAlertPayload) => {
      console.log(`[Buddy Alert] 🛒 ${payload.friendName} is near "${payload.taskLocation}" for task "${payload.taskTitle}"`);
      set({ buddyAlert: payload });
    });

    set({ isSocketInitialized: true });
  },

  clearBuddyAlert: () => set({ buddyAlert: null }),

  syncFriendSharedEvents: async () => {
    try {
      const res = await api.get('/friends/events');
      const friendEvents = res.data || [];
      
      const scheduledRaw = await AsyncStorage.getItem('scheduled_friend_alarms');
      const scheduledMap: Record<string, boolean> = scheduledRaw ? JSON.parse(scheduledRaw) : {};
      
      const muteRaw = await AsyncStorage.getItem('muteFriendAlarms');
      const isMuted = muteRaw ? JSON.parse(muteRaw) : false;

      for (const fe of friendEvents) {
        const key = `${fe.id || fe._id}_${fe.updatedAt || fe.createdAt || 'v1'}`;
        if (!scheduledMap[key]) {
          if (!isMuted) {
            const reminders: ReminderConfig[] = (fe.reminders && fe.reminders.length > 0) 
              ? fe.reminders 
              : [{ id: 'auto_rem_' + Date.now(), type: 'exact', time: fe.time, date: fe.date.split('T')[0] }];
            
            await notificationService.scheduleEventNotifications({
              ...fe,
              title: `👥 ${typeof fe.ownerId === 'object' && fe.ownerId?.name ? fe.ownerId.name + ': ' : ''}${fe.title}`
            }, reminders);
          }

          scheduledMap[key] = true;
        }
      }

      await AsyncStorage.setItem('scheduled_friend_alarms', JSON.stringify(scheduledMap));
      set({ friendsEvents: friendEvents });
      return friendEvents;
    } catch (e) {
      console.log('Friend events sync deferred:', e);
      return [];
    }
  },

  loadEvents: async () => {
    set({ isLoading: true });
    
    const localEvents = await storageService.getEvents();
    const localMap = new Map<string, Event>();
    for (const le of localEvents) {
      const lid = le.id || le._id;
      if (lid) localMap.set(lid, le);
    }

    let rawEvents = null;
    try {
      const res = await api.get('/tasks');
      if (res.data && Array.isArray(res.data)) {
        rawEvents = res.data.map((remote: any) => {
          const rid = remote.id || remote._id;
          const local = rid ? localMap.get(rid) : undefined;
          if (!local) return remote;
          // Preserve local geofence settings when older server records omit them
          return {
            ...remote,
            locationReminderEnabled: remote.locationReminderEnabled ?? local.locationReminderEnabled,
            geofenceRadius: remote.geofenceRadius ?? local.geofenceRadius,
            triggerType: remote.triggerType ?? local.triggerType,
            locationTimeGate: remote.locationTimeGate ?? local.locationTimeGate,
            isCritical: remote.isCritical ?? local.isCritical,
            checklist: (remote.checklist && remote.checklist.length > 0) ? remote.checklist : local.checklist,
          };
        });
        await storageService.saveEvents(rawEvents);
      }
    } catch (e) {
      console.log('Backend sync failed, falling back to local storage', e);
    }

    if (!rawEvents) {
      rawEvents = localEvents;
    }
    const migratedEvents: Event[] = rawEvents.map((e: any) => ({
      ...e,
      id: e.id || e._id,
      reminders: e.reminders || [],
      status: e.status || (e.completed ? 'completed' : 'pending'),
      estimatedDuration: e.estimatedDuration || 30
    }));

    set({ events: migratedEvents, isLoading: false });

    // Re-sync active Arrive/Leave geofences after load & prune stale ones
    geofencingService.syncGeofences(migratedEvents).catch(() => {});
  },

  addEvent: async (event: Event) => {
    const { events } = get();
    
    const initialStatus = event.status || 'pending';
    const initialEvent = {
      ...event,
      status: initialStatus,
      completed: initialStatus === 'completed',
      estimatedDuration: event.estimatedDuration || 30,
      priorityScore: priorityService.calculateScore(event)
    };

    const updatedReminders = await notificationService.scheduleEventNotifications(initialEvent, initialEvent.reminders || []);
    const finalEvent = { ...initialEvent, reminders: updatedReminders };
    
    
    const newEvents = [...events, finalEvent];
    await storageService.saveEvents(newEvents);
    set({ events: newEvents });

    api.post('/tasks', finalEvent).catch(e => {
      console.log('Backend sync failed, saved locally', e);
    });

    if (finalEvent.locationReminderEnabled) {
      await geofencingService.startGeofence(finalEvent as Event);
    }
  },

  updateEvent: async (updatedEvent: Event) => {
    const { events } = get();
    
    const oldEvent = events.find(e => e.id === updatedEvent.id);
    if (oldEvent && oldEvent.reminders) {
      const idsToCancel = oldEvent.reminders.flatMap(r => r.notificationIds || []);
      await notificationService.cancelNotifications(idsToCancel);
    }

    const isAlreadyDone = updatedEvent.status === 'completed' || updatedEvent.status === 'late_completed';
    let updatedReminders = updatedEvent.reminders || [];
    if (!isAlreadyDone) {
      updatedReminders = await notificationService.scheduleEventNotifications(updatedEvent, updatedEvent.reminders || []);
    } else {
      const idsToCancel = (updatedEvent.reminders || []).flatMap(r => r.notificationIds || []);
      await notificationService.cancelEventNotifications(updatedEvent.id, idsToCancel);
    }
    
    const finalEvent = {
      ...updatedEvent,
      reminders: updatedReminders,
      priorityScore: priorityService.calculateScore(updatedEvent)
    };
    const newEvents = events.map(e => (e.id === finalEvent.id ? finalEvent : e));
    
    await storageService.saveEvents(newEvents);
    set({ events: newEvents });

    api.put(`/tasks/${finalEvent.id}`, finalEvent).catch(e => {
      console.log('Backend update sync failed, updated locally', e);
    });
    
    await geofencingService.stopGeofence(finalEvent.id);
    if (finalEvent.locationReminderEnabled) {
      await geofencingService.startGeofence(finalEvent as Event);
    }
  },

  updateTaskStatus: async (id: string, status: TaskStatus) => {
    const { events } = get();
    const nowIso = new Date().toISOString();
    const now = new Date();

    const targetEvent = events.find(e => e.id === id);
    if (!targetEvent) return;

    let startedAt = targetEvent.startedAt;
    let completedAt = targetEvent.completedAt;
    let resolvedStatus = status;

    if (status === 'in_progress' && !startedAt) {
      startedAt = nowIso;
    } else if (status === 'completed') {
      completedAt = nowIso;
      useCelebrationStore.getState().triggerCelebration();

      const deadline = parseDeadline(targetEvent);
      if (deadline && now > deadline) {
        resolvedStatus = 'late_completed';
      }

      const idsToCancel = targetEvent.reminders ? targetEvent.reminders.flatMap(r => r.notificationIds || []) : [];
      await notificationService.cancelEventNotifications(id, idsToCancel);
      await geofencingService.stopGeofence(id);
      await alarmService.cancelAlarm(id);
      if (idsToCancel.length > 0) {
        await alarmService.cancelEventAlarms(idsToCancel);
      }
    }

    const isCompleted = resolvedStatus === 'completed' || resolvedStatus === 'late_completed';
    const updatedEvent: Event = {
      ...targetEvent,
      status: resolvedStatus,
      completed: isCompleted,
      startedAt,
      completedAt,
      updatedAt: nowIso
    };

    const newEvents = events.map(e => e.id === id ? updatedEvent : e);
    await storageService.saveEvents(newEvents);

    api.patch(`/tasks/${id}/status`, { status: resolvedStatus, startedAt, completedAt }).catch(e => {
      console.log('Backend status sync failed, updated locally', e);
    });

    set({ events: newEvents });

    if (resolvedStatus === 'completed' || resolvedStatus === 'late_completed') {
      behaviorService.recordTaskComplete(updatedEvent).catch(e =>
        console.warn('[BehaviorService] record error (non-fatal):', e)
      );
      behaviorService.clearDismissals(id).catch(() => {});
    } else if (resolvedStatus === 'pending' && updatedEvent.locationReminderEnabled) {
      // Task unmarked back to pending: re-arm Arrive/Leave geofence
      geofencingService.startGeofence(updatedEvent).catch(() => {});
    }

    zenModeService
      .onTaskStatusChanged(resolvedStatus, targetEvent.priority, targetEvent.title)
      .catch(e => console.warn('[ZenMode] Status change handler error:', e));
  },

  deleteEvent: async (id: string) => {
    const { events } = get();
    
    const oldEvent = events.find(e => e.id === id);
    if (oldEvent) {
      const idsToCancel = oldEvent.reminders ? oldEvent.reminders.flatMap(r => r.notificationIds || []) : [];
      await notificationService.cancelEventNotifications(id, idsToCancel);
    }

    const newEvents = events.filter(e => e.id !== id);
    await storageService.saveEvents(newEvents);
    
    try {
      await api.delete(`/tasks/${id}`);
    } catch (e) {
      console.log('Backend delete sync failed, deleted locally');
    }

    await geofencingService.stopGeofence(id);

    set({ events: newEvents });
  },

  clearCompletedEvents: async () => {
    const { events } = get();
    
    const isTaskDone = (e: Event) =>
      e.completed || e.status === 'completed' || e.status === 'late_completed';

    const completedEvents = events.filter(isTaskDone);
    for (const ev of completedEvents) {
      const idsToCancel = (ev.reminders || []).flatMap(r => r.notificationIds || []);
      await notificationService.cancelEventNotifications(ev.id, idsToCancel);
    }

    const newEvents = events.filter(e => !isTaskDone(e));
    await storageService.saveEvents(newEvents);
    set({ events: newEvents });
    geofencingService.syncGeofences(newEvents).catch(() => {});

    for (const ev of completedEvents) {
      try {
        await api.delete(`/tasks/${ev.id}`);
      } catch (e) {
        console.log(`Backend delete failed for ${ev.id}`);
      }
    }
  },

  toggleEventCompletion: async (id: string) => {
    const { events } = get();
    const target = events.find(e => e.id === id);
    if (!target) return;

    const isAlreadyDone = target.completed || target.status === 'completed' || target.status === 'late_completed';
    const newStatus: TaskStatus = isAlreadyDone ? 'pending' : 'completed';
    await get().updateTaskStatus(id, newStatus);
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters }
    }));
  },

  getFilteredEvents: (userLocation = null) => {
    const { events, filters } = get();
    
    return events.filter(event => {
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesTitle = (event.title || '').toLowerCase().includes(query);
        const matchesCategory = (event.category || '').toLowerCase().includes(query);
        const matchesLocation = (event.location || '').toLowerCase().includes(query);
        const matchesDate = (event.date || '').toLowerCase().includes(query);
        const matchesDesc = (event.description || '').toLowerCase().includes(query);

        if (!matchesTitle && !matchesCategory && !matchesLocation && !matchesDate && !matchesDesc) {
          return false;
        }
      }
      
      if (filters.category !== 'all' && (event.category || '').toLowerCase() !== filters.category.toLowerCase()) {
        return false;
      }
      
      if (filters.status === 'completed' && (!event.completed && event.status !== 'completed' && event.status !== 'late_completed')) return false;
      if (filters.status === 'pending' && (event.completed || event.status === 'completed' || event.status === 'late_completed')) return false;
      if (filters.status === 'in_progress' && event.status !== 'in_progress') return false;
      if (filters.status === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (!event.date.startsWith(todayStr)) return false;
      }
      if (filters.status === 'overdue') {
        const deadline = parseDeadline(event);
        const isPast = deadline ? deadline.getTime() < new Date().getTime() : false;
        if (!isPast || event.completed || event.status === 'completed' || event.status === 'late_completed') return false;
      }
      
      if (filters.priority !== 'all' && event.priority !== filters.priority) {
        return false;
      }

      if (filters.timeframe === 'this_week') {
        const now = new Date();
        const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const taskDate = new Date(event.date);
        if (taskDate < now || taskDate > weekEnd) return false;
      }
      
      return true;
    }).sort((a, b) => {
      const scoreA = priorityService.calculateScore(a, userLocation);
      const scoreB = priorityService.calculateScore(b, userLocation);
      return scoreB - scoreA;
    });
  },
  
  getEventsByDate: (date: string) => {
    const { events } = get();
    return events.filter(e => e.date.startsWith(date));
  },

  getTopRecommendation: (userLocation = null) => {
    const { events } = get();
    return priorityService.getRecommendation(events, userLocation);
  }
}));
