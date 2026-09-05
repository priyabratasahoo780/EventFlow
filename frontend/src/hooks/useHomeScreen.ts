/**
 * src/hooks/useHomeScreen.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Extracts all business logic from the home screen into a reusable hook.
 * The screen component becomes a thin rendering shell.
 */
import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEventStore } from '../store/useEventStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLocation } from './useLocation';
import { priorityService } from '../services/priorityService';
import { Event } from '../types/event.types';

export function useHomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    events, friendsEvents, loadEvents, syncFriendSharedEvents,
    updateTaskStatus, filters, setFilters, getFilteredEvents,
    getTopRecommendation, initSocket,
  } = useEventStore();

  const { location, arrivedTask, arrivedTriggerType, dismissArrivedTask } = useLocation(events);

  const [refreshing, setRefreshing] = useState(false);
  const [activeAlarmEvent, setActiveAlarmEvent] = useState<Event | null>(null);
  const [showAlarmModal, setShowAlarmModal] = useState(false);

  const appState = useRef(AppState.currentState);
  const triggeredAlarms = useRef<Set<string>>(new Set());

  // ── Data loading ──────────────────────────────────────────────────────────

  const fetchFriendsEvents = useCallback(async () => {
    try { await syncFriendSharedEvents(); } catch {}
  }, [syncFriendSharedEvents]);

  useEffect(() => {
    initSocket();
    loadEvents();
    fetchFriendsEvents();

    const syncInterval = setInterval(() => {
      syncFriendSharedEvents().catch(() => {});
    }, 15000);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchFriendsEvents();
        loadEvents();
      }
      appState.current = nextAppState;
    });

    return () => {
      clearInterval(syncInterval);
      subscription.remove();
    };
  }, [fetchFriendsEvents, loadEvents, syncFriendSharedEvents]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await Promise.all([loadEvents(), fetchFriendsEvents()]);
    setRefreshing(false);
  }, [loadEvents, fetchFriendsEvents]);

  // ── Computed values ───────────────────────────────────────────────────────

  const filteredEvents = useMemo(
    () => getFilteredEvents(location),
    [getFilteredEvents, location, events, filters],
  );

  const topTask = useMemo(
    () => getTopRecommendation(location),
    [getTopRecommendation, location, events],
  );

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const todayEvents = useMemo(
    () => events.filter(e => e.date?.startsWith(todayStr)),
    [events, todayStr],
  );

  const stats = useMemo(() => {
    const todayDueCount = todayEvents.filter(e => !e.completed && e.status !== 'completed').length;
    const todayCompletedCount = todayEvents.filter(e => e.completed || e.status === 'completed').length;
    const totalPendingCount = events.filter(e => !e.completed && e.status !== 'completed').length;
    const totalCompletedCount = events.filter(e => e.completed || e.status === 'completed').length;
    const totalCount = events.length;

    const totalTasks = todayEvents.length > 0 ? todayEvents.length : totalCount;
    const completedToCount = todayEvents.length > 0 ? todayCompletedCount : totalCompletedCount;
    const progressPercent = totalTasks > 0 ? Math.min(100, Math.round((completedToCount / totalTasks) * 100)) : 0;

    return { todayDueCount, todayCompletedCount, totalPendingCount, totalCompletedCount, totalCount, progressPercent };
  }, [events, todayEvents]);

  const heroTasks = useMemo(() => {
    const todayPending = events.filter(
      e => !e.completed && e.status !== 'completed' && e.date?.startsWith(todayStr),
    );
    const sorted = [...todayPending].sort(
      (a, b) => priorityService.calculateScore(b, location) - priorityService.calculateScore(a, location),
    );
    if (sorted.length >= 2) return sorted;
    return topTask ? [topTask] : [];
  }, [events, todayStr, topTask, location]);

  // ── User info ─────────────────────────────────────────────────────────────

  const userName = user?.name ? user.name.split(' ')[0] : 'User';
  const userInitial = (user?.name?.charAt(0) || 'U').toUpperCase();
  const hasValidPhoto = !!user?.profilePhoto && !user.profilePhoto.includes('unsplash.com');

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getFormattedDate = () =>
    new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // ── Task actions ──────────────────────────────────────────────────────────

  const handleCompleteTask = useCallback((task: Event) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateTaskStatus(task.id, 'completed');
  }, [updateTaskStatus]);

  const handleStartTask = useCallback((task: Event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateTaskStatus(task.id, 'in_progress');
    router.push(`/event/${task.id}` as any);
  }, [updateTaskStatus, router]);

  // ── Alarm state management ────────────────────────────────────────────────

  return {
    // state
    refreshing, events, friendsEvents, filters, location,
    activeAlarmEvent, setActiveAlarmEvent,
    showAlarmModal, setShowAlarmModal,
    arrivedTask, arrivedTriggerType, dismissArrivedTask,
    triggeredAlarms,
    // computed
    filteredEvents, topTask, todayStr, heroTasks, stats,
    // user
    user, userName, userInitial, hasValidPhoto,
    // actions
    onRefresh, handleCompleteTask, handleStartTask,
    setFilters, router,
    // helpers
    getGreeting, getFormattedDate,
  };
}
