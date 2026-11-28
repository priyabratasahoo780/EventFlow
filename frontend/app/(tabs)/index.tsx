import React, {
  useEffect, useState, useMemo, useCallback, useRef,
} from 'react';
import {
  StyleSheet, View, FlatList, TextInput, ScrollView,
  RefreshControl, Text, Pressable, AppState, Image, Modal,
  Animated, Easing, Platform,
} from 'react-native';
import { rs, ms, hs, SCREEN, useResponsive } from '../../constants/responsive';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEventStore } from '../../store/useEventStore';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { useLocation } from '../../hooks/useLocation';
import AlarmModal from '../../components/AlarmModal';
import LocationArrivalModal from '../../components/LocationArrivalModal';
import BuddyAlertModal from '../../components/BuddyAlertModal';
import AllCaughtUpCard from '../../components/AllCaughtUpCard';
import AnimatedDashedChip from '../../components/AnimatedDashedChip';
import * as Notifications from '../../mock-expo-notifications';
import {
  Search, Filter, CheckCircle2, Clock, X,
  Sparkles, Plus, Flame, Calendar as CalendarIcon,
  Hourglass, AlertTriangle, Zap, MapPin, Grid3x3, Bell,
  Menu, GraduationCap, Briefcase, User as UserIcon,
  Check, ChevronRight, LogOut, Layers,
  CalendarClock, Users, Code, Activity, ShoppingBag, Hash, Settings, MessageCircle,
  SlidersHorizontal, RotateCcw, Tag
} from 'lucide-react-native';
import { Event } from '../../models/Event';
import { priorityService } from '../../services/priorityService';
import api, { resolveMediaUrl } from '../../services/api';
import { socketService } from '../../services/socketService';
import { useAuthStore } from '../../store/useAuthStore';
import * as Haptics from '../../services/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ZenModePermissionModal from '../../components/ZenModePermissionModal';
import { zenModeService } from '../../services/zenModeService';
import { getDepartureSuggestion, formatLeaveBy, modeEmoji, DepartureSuggestion } from '../../services/travelService';
import { notificationService } from '../../services/notificationService';
import { geofencingService } from '../../services/geofencingService';
import { alarmService } from '../../services/alarmService';
import { findDueAlarmTask } from '../../services/alarmCheck';


const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'Academic', label: 'Academic' },
  { id: 'Work', label: 'Work' },
  { id: 'Personal', label: 'Personal' },
  { id: 'Appointment', label: 'Appointment' },
  { id: 'Interview', label: 'Interview' },
  { id: 'Hackathon', label: 'Hackathon' },
  { id: 'Meeting', label: 'Meeting' },
  { id: 'Health', label: 'Health' },
  { id: 'Shopping', label: 'Shopping' },
  { id: 'Other', label: 'Other' },
];

const STATUS_FILTERS = [
  { id: 'all',         label: 'All Tasks',   Icon: Layers },
  { id: 'today',       label: 'Today',       Icon: CalendarIcon },
  { id: 'in_progress', label: 'In Progress', Icon: Clock },
  { id: 'pending',     label: 'Pending',     Icon: Hourglass },
  { id: 'completed',   label: 'Completed',   Icon: CheckCircle2 },
  { id: 'overdue',     label: 'Overdue',     Icon: AlertTriangle },
] as const;

const getPriorityConfig = (colors: ColorTheme): Record<string, { strip: string; bg: string; text: string; label: string }> => ({
  critical: { strip: colors.error, bg: colors.dangerLight, text: colors.error, label: 'CRITICAL' },
  high:     { strip: colors.secondary, bg: colors.secondaryLight, text: colors.secondary, label: 'HIGH' },
  medium:   { strip: colors.warning, bg: colors.warningLight, text: colors.warning, label: 'MEDIUM' },
  low:      { strip: colors.success, bg: colors.successLight, text: colors.success, label: 'LOW' },
});


const FALLBACK_HERO_COVER =
  'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?q=80&w=800&auto=format&fit=crop';

/** Renders the user-attached task photo on the Hero card, falling back cleanly to the default cover on absence or load error. */
const HeroCoverImage = ({ userUri, defaultUri }: { userUri?: string; defaultUri: string }) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [userUri]);

  const activeUri = !imageFailed && userUri ? userUri : defaultUri;

  return (
    <Image
      key={activeUri}
      source={{ uri: activeUri }}
      style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
      onError={() => {
        if (!imageFailed && userUri) {
          setImageFailed(true);
        }
      }}
    />
  );
};

const HomeTaskCard = React.memo(function HomeTaskCard({
  item,
  colors,
  s,
  prio,
  onPressCard,
  onToggleCompletion,
  onActionPress,
}: {
  item: Event;
  colors: ColorTheme;
  s: ReturnType<typeof getStyles>;
  prio: { strip: string; bg: string; text: string; label: string };
  onPressCard: (item: Event) => void;
  onToggleCompletion: (id: string) => void;
  onActionPress: (item: Event) => void;
}) {
  const isCompleted = item.completed || item.status === 'completed';
  const isInProgress = item.status === 'in_progress';
  const dateFormatted = item.date ? item.date.split('T')[0] : '';
  const estDuration = item.estimatedDuration || 30;

  return (
    <Pressable
      onPress={() => onPressCard(item)}
      style={s.taskCard}
    >
      {/* Left orange accent bar */}
      <LinearGradient
        colors={isInProgress ? [colors.primary, '#3F35C8'] : isCompleted ? [colors.success, colors.success] : [colors.secondary, colors.secondary]}
        style={s.taskBar}
      />
      <View style={s.taskContent}>
        {/* Top row: chips + check */}
        <View style={s.taskTopRow}>
          <View style={s.taskChips}>
            {item.category ? (
              <View style={s.catBadge}>
                <Text style={s.catBadgeText}>{item.category.toUpperCase()}</Text>
              </View>
            ) : null}
            <View style={[s.prioBadge, { backgroundColor: prio.bg }]}>
              <Text style={[s.prioBadgeText, { color: prio.text }]}>{prio.label}</Text>
            </View>
            {isInProgress && (
              <View style={s.focusingBadge}>
                <Zap color={colors.primary} size={9} strokeWidth={3} />
                <Text style={s.focusingText}>FOCUSING</Text>
              </View>
            )}
            {item.visibility && item.visibility !== 'onlyMe' && (
              <View style={[s.focusingBadge, { backgroundColor: '#E0E7FF' }]}>
                <Users color="#4F46E5" size={10} strokeWidth={2.5} />
                <Text style={[s.focusingText, { color: '#4F46E5' }]}>SHARED</Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleCompletion((item.id || item._id) as string);
            }}
            hitSlop={10}
          >
            <CheckCircle2 color={isCompleted ? colors.success : '#CBD5E1'} size={22} strokeWidth={2.5} />
          </Pressable>
        </View>

        {/* Title & description */}
        <Text style={[s.taskTitle, isCompleted && s.taskTitleDone]} numberOfLines={2}>{item.title}</Text>
        {item.description ? (
          <Text style={[s.taskDesc, isCompleted && s.taskDescDone]} numberOfLines={1}>{item.description}</Text>
        ) : null}

        {/* Footer meta */}
        <View style={s.taskFooter}>
          <View style={s.taskFooterLeft}>
            <View style={s.taskMeta}>
              {dateFormatted ? (
                <View style={s.metaTag}>
                  <CalendarIcon color={colors.textSecondary} size={11} strokeWidth={2} />
                  <Text style={s.metaTagText}>{dateFormatted}</Text>
                </View>
              ) : null}
              {item.time ? (
                <View style={s.metaTag}>
                  <Clock color={colors.textSecondary} size={11} strokeWidth={2} />
                  <Text style={s.metaTagText}>{item.time}</Text>
                </View>
              ) : null}
              <View style={s.durationTag}>
                <Text style={s.durationText}>~{estDuration}m</Text>
              </View>
              {item.reminders && item.reminders.length > 0 && (
                <View style={[s.metaTag, { backgroundColor: colors.secondaryLight, borderColor: colors.secondary, borderWidth: 0.5 }]}>
                  <Bell color={colors.secondary} size={11} strokeWidth={2.5} />
                  <Text style={[s.metaTagText, { color: colors.secondary, fontFamily: 'Poppins_600SemiBold' }]}>
                    {item.reminders[0].type === 'exact' ? item.reminders[0].time : item.reminders[0].type === 'before' ? `${item.reminders[0].value}${item.reminders[0].unit?.charAt(0)} bfr` : item.reminders[0].time || 'Reminder'}
                  </Text>
                </View>
              )}
              {item.location ? (
                <View
                  style={[
                    s.locTag,
                    item.locationReminderEnabled && {
                      backgroundColor: item.triggerType === 'leave' ? '#FFFBEB' : '#F0FDF4',
                      borderColor: item.triggerType === 'leave' ? '#FDE68A' : '#BBF7D0',
                      borderWidth: 1,
                    },
                  ]}
                >
                  <MapPin
                    color={
                      item.locationReminderEnabled
                        ? item.triggerType === 'leave'
                          ? '#D97706'
                          : '#15803D'
                        : colors.textSecondary
                    }
                    size={11}
                  />
                  <Text
                    style={[
                      s.locTagText,
                      item.locationReminderEnabled && {
                        color: item.triggerType === 'leave' ? '#D97706' : '#15803D',
                        fontFamily: 'Poppins_600SemiBold',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.locationReminderEnabled
                      ? `${item.triggerType === 'leave' ? '🚶 Leave' : '📍 Arrive'} (${item.geofenceRadius || 500}m)`
                      : item.location}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <Pressable
            style={[s.taskAddBtn, isCompleted && s.taskCompletedBtn]}
            onPress={(e) => {
              e.stopPropagation();
              onActionPress(item);
            }}
          >
            <LinearGradient
              colors={isCompleted ? [colors.success, colors.success] : [colors.dangerLight || '#FEF2F2', colors.dangerLight || '#FEE2E2']}
              style={[s.taskAddBtnGrad, !isCompleted && { borderWidth: 1, borderColor: colors.error }, isCompleted && { borderWidth: 0 }]}
            >
              {isCompleted ? <Check color="#FFF" size={20} strokeWidth={3} /> : <X color={colors.error} size={20} strokeWidth={2.5} />}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winWidth, contentMaxWidth, containerStyle } = useResponsive();
  const { getColors } = useThemeStore();
  const colors = getColors();
  const s = useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuthStore();
  const { events, friendsEvents, loadEvents, syncFriendSharedEvents, updateTaskStatus, toggleEventCompletion, filters, setFilters, getFilteredEvents, getTopRecommendation, initSocket, buddyAlert, clearBuddyAlert } = useEventStore();
  const { location, arrivedTask, arrivedTriggerType, dismissArrivedTask } = useLocation(events);
  const [refreshing, setRefreshing] = useState(false);
  const [activeAlarmEvent, setActiveAlarmEvent] = useState<Event | null>(null);
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [festivalBanner, setFestivalBanner] = useState<{
    _id?: string;
    title: string;
    imageUrl: string;
    greeting: string;
    startDate?: string | null;
    endDate?: string | null;
  } | null>(null);
  const appState = useRef(AppState.currentState);

  const statusCounts = useMemo<Record<string, number>>(() => {
    const today = new Date().toISOString().split('T')[0];
    let all = events.length;
    let todayCount = 0;
    let inProgress = 0;
    let pending = 0;
    let completed = 0;
    let overdue = 0;

    for (const e of events) {
      const isDone = e.completed || e.status === 'completed' || e.status === 'late_completed';
      if (isDone) {
        completed++;
      } else {
        pending++;
        if (e.status === 'in_progress') inProgress++;
        if (e.date?.startsWith(today)) todayCount++;
        if (e.date && e.date.split('T')[0] < today) overdue++;
      }
    }

    return {
      all,
      today: todayCount,
      in_progress: inProgress,
      pending,
      completed,
      overdue,
    };
  }, [events]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.status && filters.status !== 'all') count++;
    if (filters.category && filters.category !== 'all') count++;
    if (filters.priority && filters.priority !== 'all') count++;
    if (filters.searchQuery?.trim()) count++;
    return count;
  }, [filters]);

  const resetFilters = useCallback(() => {
    setFilters({
      status: 'all',
      category: 'all',
      priority: 'all',
      searchQuery: '',
    });
  }, [setFilters]);

  const [zenModalVisible, setZenModalVisible] = useState(false);
  const [zenPendingTask, setZenPendingTask] = useState<Event | null>(null);

  const slideAnim = useRef(new Animated.Value(-winWidth)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.poly(4)),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  }, [slideAnim, fadeAnim]);

  const closeMenu = useCallback((callback?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -winWidth,
        duration: 250,
        easing: Easing.in(Easing.poly(4)),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      setIsMenuOpen(false);
      if (callback) callback();
    });
  }, [slideAnim, fadeAnim, winWidth]);

  const fetchFriendsEvents = useCallback(async () => {
    try {
      await syncFriendSharedEvents();
    } catch {}
  }, [syncFriendSharedEvents]);

  const fetchActiveFestival = useCallback(async () => {
    try {
      const res = await api.get('/festival/active');
      setFestivalBanner(res.data?.banner || null);
    } catch {
      // Non-blocking if offline
    }
  }, []);

  useEffect(() => {
    initSocket();
    loadEvents();
    fetchFriendsEvents();
    fetchActiveFestival();

    const onFestivalUpdated = () => {
      fetchActiveFestival();
    };
    socketService.on('festival_updated', onFestivalUpdated);

    let syncInterval: ReturnType<typeof setInterval> | null = setInterval(() => {
      if (appState.current === 'active') {
        syncFriendSharedEvents().catch(() => {});
      }
    }, 15000);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current?.match(/inactive|background/) && nextAppState === 'active') {
        socketService.connect();
        fetchFriendsEvents();
        loadEvents();
        fetchActiveFestival();
      }
      appState.current = nextAppState;
    });

    return () => {
      socketService.off('festival_updated', onFestivalUpdated);
      if (syncInterval) clearInterval(syncInterval);
      subscription.remove();
    };
  }, [fetchFriendsEvents, loadEvents, syncFriendSharedEvents, fetchActiveFestival]);

  // Auto-hide festival banner the moment its scheduled endDate+time expires
  useEffect(() => {
    if (!festivalBanner) return;
    const nowMs = Date.now();
    const startMs = festivalBanner.startDate ? new Date(festivalBanner.startDate).getTime() : null;
    const endMs = festivalBanner.endDate ? new Date(festivalBanner.endDate).getTime() : null;

    if ((startMs && nowMs < startMs) || (endMs && nowMs > endMs)) {
      setFestivalBanner(null);
      return;
    }

    if (endMs) {
      const remaining = endMs - nowMs;
      // Cap setTimeout below 32-bit signed max (~24 days)
      if (remaining > 0 && remaining < 2_000_000_000) {
        const timer = setTimeout(() => {
          setFestivalBanner(null);
          fetchActiveFestival();
        }, remaining + 500);
        return () => clearTimeout(timer);
      }
    }
  }, [festivalBanner, fetchActiveFestival]);

  const triggeredAlarms = useRef<Set<string>>(new Set());

  // 1. Listen for system push notifications (works in background)
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification: any) => {
      const data = notification.request.content.data;
      const eventId = data?.eventId;
      // Only trigger alarm modal for event notifications (not cheers, messages, or friend requests)
      if (!eventId || data?.type === 'geofence' || data?.type === 'cheer_nudge' || data?.type === 'friend_request' || data?.type === 'message') {
        return;
      }

      const targetEvent = events.find(e => e.id === eventId) || friendsEvents.find(e => (e.id || e._id) === eventId);
      if (targetEvent && !targetEvent.completed && targetEvent.status !== 'completed') {
        setActiveAlarmEvent(targetEvent);
        setShowAlarmModal(true);
      }
    });

    // 1b. Listen for when user TAPS a notification (app was in background/closed)
    const resSub = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;
      const eventId = data?.eventId;
      if (!eventId || data?.type === 'geofence' || data?.type === 'cheer_nudge' || data?.type === 'friend_request' || data?.type === 'message') {
        return;
      }

      const targetEvent = events.find(e => e.id === eventId) || friendsEvents.find(e => (e.id || e._id) === eventId);
      if (targetEvent && !targetEvent.completed && targetEvent.status !== 'completed') {
        setActiveAlarmEvent(targetEvent);
        setShowAlarmModal(true);
      }
    });

    return () => {
      sub?.remove?.();
      resSub?.remove?.();
    };
  }, [events, friendsEvents]);

  // 2. Minute-gated foreground alarm checker (avoids redundant 1s scanning when idle)
  useEffect(() => {
    if (events.length === 0 && friendsEvents.length === 0) return;

    let lastCheckedMinute = '';
    let lastEventsRef: Event[] | null = null;
    let lastFriendsRef: Event[] | null = null;

    const runCheck = () => {
      if (appState.current !== 'active' || showAlarmModal) return;
      const now = new Date();
      const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}_${now.getHours()}:${now.getMinutes()}`;
      if (minuteKey === lastCheckedMinute && events === lastEventsRef && friendsEvents === lastFriendsRef) {
        return;
      }
      lastCheckedMinute = minuteKey;
      lastEventsRef = events;
      lastFriendsRef = friendsEvents;

      const dueTask = findDueAlarmTask(events, friendsEvents, triggeredAlarms.current, now);
      if (dueTask) {
        setActiveAlarmEvent(dueTask);
        setShowAlarmModal(true);
      }
    };

    runCheck();
    const interval = setInterval(runCheck, 3000);
    return () => clearInterval(interval);
  }, [events, friendsEvents, showAlarmModal]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await Promise.all([loadEvents(), fetchFriendsEvents(), fetchActiveFestival()]);
    setRefreshing(false);
  }, [loadEvents, fetchFriendsEvents, fetchActiveFestival]);

  const filteredEvents = useMemo(() => getFilteredEvents(location), [getFilteredEvents, location, events, filters]);
  const topTask = useMemo(() => getTopRecommendation(location), [getTopRecommendation, location, events]);
  
  const overdueTasks = useMemo(() => {
    const now = new Date();
    return events.filter(e => {
      if (e.status === 'overdue') return true;
      if (e.completed || e.status === 'completed' || e.status === 'in_progress') return false;
      if (!e.date) return false;
      const dateStr = e.date.split('T')[0];
      const timeStr = e.time || '23:59';
      const dl = new Date(`${dateStr}T${timeStr.length <= 5 ? timeStr + ':00' : timeStr}`);
      return dl < now;
    });
  }, [events]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayEvents = useMemo(() => events.filter(e => e.date?.startsWith(todayStr)), [events, todayStr]);
  const todayDueCount = useMemo(() => todayEvents.filter(e => !e.completed && e.status !== 'completed' && e.status !== 'late_completed').length, [todayEvents]);
  // Edge Case Fix #4: Include late_completed in completion counts
  const todayCompletedCount = useMemo(() => todayEvents.filter(e => e.completed || e.status === 'completed' || e.status === 'late_completed').length, [todayEvents]);
  const totalPendingCount = useMemo(() => events.filter(e => !e.completed && e.status !== 'completed' && e.status !== 'late_completed').length, [events]);
  const totalCompletedCount = useMemo(() => events.filter(e => e.completed || e.status === 'completed' || e.status === 'late_completed').length, [events]);
  const totalCount = events.length;

  const totalTasks = todayEvents.length > 0 ? todayEvents.length : totalCount;
  const completedTasksToCount = todayEvents.length > 0 ? todayCompletedCount : totalCompletedCount;
  const progressPercent = totalTasks > 0 ? Math.min(100, Math.round((completedTasksToCount / totalTasks) * 100)) : 0;

  const handleCompleteTask = useCallback((task: Event) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateTaskStatus(task.id, 'completed');
  }, [updateTaskStatus]);

  const handleStartTask = useCallback(async (task: Event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const isCritical = task.priority?.toLowerCase() === 'critical';

    if (isCritical) {
      const permStatus = await zenModeService.getPermissionStatus();
      if (permStatus === null) {
        setZenPendingTask(task);
        setZenModalVisible(true);
        return; 
      }
    }

    updateTaskStatus((task.id || task._id) as string, 'in_progress');
    router.push(`/event/${task.id || task._id}` as any);
  }, [updateTaskStatus, router]);

  const handleSmartSnooze = useCallback(async (task: Event, type: 'time' | 'exit_reentry') => {
    const taskId = (task.id || task._id) as string;
    if (type === 'exit_reentry') {
      await geofencingService.setTaskPendingExit(taskId);
    } else {
      const triggerMs = Date.now() + 15 * 60 * 1000;
      const triggerDate = new Date(triggerMs);
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `⏱ Snoozed Reminder: ${task.title}`,
            body: `15-minute snooze complete${task.location ? ` for ${task.location}` : ''}. Ready to start?`,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            data: { eventId: taskId, type: 'snooze_reminder' },
            ...(Platform.OS === 'android' ? { channelId: 'focusflow_alarm_v2' } : {}),
          } as any,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            ...(Platform.OS === 'android' ? { channelId: 'focusflow_alarm_v2' } : {}),
          } as any,
        });

        await alarmService.scheduleAlarm(
          `geo_snooze_${taskId}_${triggerMs}`,
          triggerMs,
          `⏱ Snoozed: ${task.title}`,
          `Time to handle "${task.title}"`,
          taskId,
          task.isCritical ?? false
        );
      } catch (e) {
        console.warn('15-min smart snooze schedule error:', e);
      }
    }
  }, []);


  const userName = useMemo(() => (user?.name ? user.name.split(' ')[0] : 'User'), [user?.name]);
  const userInitial = useMemo(() => (user?.name?.charAt(0) || 'U').toUpperCase(), [user?.name]);
  const hasValidPhoto = useMemo(() => (!!user?.profilePhoto && !user.profilePhoto.includes('unsplash.com')), [user?.profilePhoto]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const formattedDate = useMemo(() =>
    new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  []);


  const renderHeader = () => (
    <>
      <View style={s.navbar}>
        <Pressable
          style={s.navIconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            openMenu();
          }}
        >
          <Menu color={colors.text} size={22} strokeWidth={2} />
        </Pressable>

        <View style={s.navCenter}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={{ width: rs(20), height: rs(20), borderRadius: rs(5) }}
            resizeMode="contain"
          />
          <View style={s.datePill}>
            <CalendarIcon color={colors.secondary} size={11} strokeWidth={2.5} />
            <Text style={s.datePillText}>{formattedDate}</Text>
          </View>
          <View style={s.brandDot} />
          <Text style={s.navBrand}>EVENTFLOW</Text>
        </View>

        <View style={s.navRight}>
          <Pressable
            style={s.bellBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/friends/requests' as any);
            }}
          >
            <Bell color={colors.text} size={19} strokeWidth={2} />
            {todayDueCount > 0 && <View style={s.notifDot} />}
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/profile' as any);
            }}
          >
            <View style={s.avatarWrapper}>
              {hasValidPhoto ? (
                <Image source={{ uri: resolveMediaUrl(user!.profilePhoto) }} style={s.avatarImg} />
              ) : (
                <LinearGradient colors={[colors.secondary, colors.secondary]} style={s.avatarFallback}>
                  <Text style={s.avatarFallbackText}>{userInitial}</Text>
                </LinearGradient>
              )}
              <View style={s.onlineDot} />
            </View>
          </Pressable>
        </View>
      </View>

      {/* ── GREETING & HERO FOCUS ── */}
      <View style={s.greetingRow}>
        <Text style={s.greeting}>
          {greeting}, {userName} 👋
        </Text>
        <Text style={s.greetingSub}>
          You have {totalPendingCount} pending tasks.
        </Text>
      </View>

      {renderHeroFocusCard()}

      {/* ── TIER 2: BATCH TRIAGE BUTTON (Between Hero Card & Daily Momentum) ── */}
      {overdueTasks.length > 0 ? (
        <Pressable 
          style={({ pressed }) => [
            s.triageCard,
            { 
              transform: [{ scale: pressed ? 0.985 : 1 }],
              opacity: pressed ? 0.92 : 1
            }
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/triage' as any);
          }}
        >
          <View style={s.triageCardInner}>
            {/* Left Icon with subtle gradient glow */}
            <LinearGradient
              colors={['#FF5252', '#DC2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.triageIconWrap}
            >
              <AlertTriangle color="#FFFFFF" size={20} strokeWidth={2.5} />
            </LinearGradient>

            {/* Center Information */}
            <View style={s.triageInfo}>
              <View style={s.triageBadgeRow}>
                <View style={s.triageOverdueBadge}>
                  <View style={s.triagePulseDot} />
                  <Text style={s.triageOverdueText}>OVERDUE</Text>
                </View>
                <Text style={s.triageCountHint}>
                  {overdueTasks.length} {overdueTasks.length === 1 ? 'task needs action' : 'tasks need action'}
                </Text>
              </View>

              <Text style={s.triageTitle} numberOfLines={1}>
                Triage Overdue Tasks
              </Text>
              <Text style={s.triageSubtitle} numberOfLines={1}>
                Swipe to reschedule or resolve in seconds
              </Text>
            </View>

            {/* Right Action CTA */}
            <View style={s.triageActionCircle}>
              <ChevronRight color={colors.error} size={18} strokeWidth={2.5} />
            </View>
          </View>
        </Pressable>
      ) : (
        <Pressable
          style={({ pressed }) => [
            s.triageCard,
            {
              transform: [{ scale: pressed ? 0.985 : 1 }],
              opacity: pressed ? 0.92 : 1,
              borderColor: '#22C55E',
            }
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/triage' as any);
          }}
        >
          <View style={s.triageCardInner}>
            <LinearGradient
              colors={['#22C55E', '#16A34A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.triageIconWrap}
            >
              <CheckCircle2 color="#FFFFFF" size={20} strokeWidth={2.5} />
            </LinearGradient>

            <View style={s.triageInfo}>
              <View style={s.triageBadgeRow}>
                <View style={[s.triageOverdueBadge, { backgroundColor: '#DCFCE7', borderColor: '#22C55E' }]}>
                  <View style={[s.triagePulseDot, { backgroundColor: '#22C55E' }]} />
                  <Text style={[s.triageOverdueText, { color: '#16A34A' }]}>ALL CLEAR</Text>
                </View>
                <Text style={s.triageCountHint}>{totalPendingCount} active tasks</Text>
              </View>

              <Text style={s.triageTitle} numberOfLines={1}>
                Task Triage Centre
              </Text>
              <Text style={s.triageSubtitle} numberOfLines={1}>
                No overdue tasks · Tap to review all tasks
              </Text>
            </View>

            <View style={[s.triageActionCircle, { borderColor: '#DCFCE7', backgroundColor: '#DCFCE7' }]}>
              <ChevronRight color="#16A34A" size={18} strokeWidth={2.5} />
            </View>
          </View>
        </Pressable>
      )}

      {/* ── DAILY MOMENTUM CARD ── */}
      <View style={s.momentumCard}>
        <View style={s.momentumTop}>
          <View style={s.momentumLeft}>
            <View style={s.flameBadge}>
              <Flame color={colors.secondary} size={15} fill={colors.secondary} />
            </View>
            <Text style={s.momentumTitle}>Daily Momentum</Text>
          </View>
          <View style={s.donePill}>
            <Text style={s.donePillText}>{progressPercent}% Done</Text>
          </View>
        </View>

        {/* Orange Progress Bar */}
        <View style={s.progressBg}>
          <LinearGradient
            colors={[colors.secondary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[s.progressFill, { width: `${Math.max(3, progressPercent)}%` as any }]}
          />
        </View>

        <View style={s.divider} />

        {/* 3 Stats */}
        <View style={s.statsRow}>
          <Pressable style={s.statCol} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilters({ status: 'today' }); }}>
            <View style={[s.statIconNum, { backgroundColor: colors.secondaryLight }]}>
              <CalendarIcon color={colors.secondary} size={13} strokeWidth={2.3} />
              <Text style={[s.statNum, { color: colors.secondary }]}>{todayDueCount}</Text>
            </View>
            <Text style={s.statLabel}>Due Today</Text>
          </Pressable>

          <View style={s.vertDiv} />

          <Pressable style={s.statCol} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilters({ status: 'pending' }); }}>
            <View style={[s.statIconNum, { backgroundColor: colors.secondaryLight }]}>
              <Hourglass color={colors.secondary} size={13} strokeWidth={2.3} />
              <Text style={[s.statNum, { color: colors.secondary }]}>{totalPendingCount}</Text>
            </View>
            <Text style={s.statLabel}>Pending</Text>
          </Pressable>

          <View style={s.vertDiv} />

          <Pressable style={s.statCol} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilters({ status: 'completed' }); }}>
            <View style={[s.statIconNum, { backgroundColor: colors.successLight }]}>
              <CheckCircle2 color={colors.success} size={13} strokeWidth={2.3} />
              <Text style={[s.statNum, { color: colors.success }]}>{totalCompletedCount}</Text>
            </View>
            <Text style={s.statLabel}>Completed</Text>
          </Pressable>
        </View>
      </View>


      {/* ── SEARCH + FILTER ── */}
      <View style={s.searchRow}>
        <View style={{ flex: 1 }}>
          <View style={s.searchBox}>
            <Search color={filters.searchQuery ? colors.secondary : colors.textSecondary} size={17} strokeWidth={2.2} />
            <TextInput
              style={s.searchInput}
              placeholder="Search tasks, categories, tags..."
              placeholderTextColor={colors.textSecondary}
              value={filters.searchQuery}
              onChangeText={(text) => {
                setFilters({ searchQuery: text });
                setShowSearchSuggestions(text.length > 0);
              }}
              onFocus={() => setShowSearchSuggestions(filters.searchQuery.length > 0 || true)}
              onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 180)}
              returnKeyType="search"
              onSubmitEditing={() => setShowSearchSuggestions(false)}
            />
            {filters.searchQuery ? (
              <Pressable
                style={s.searchClearBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFilters({ searchQuery: '' });
                  setShowSearchSuggestions(false);
                }}
              >
                <X color={colors.textSecondary} size={13} strokeWidth={2.5} />
              </Pressable>
            ) : null}
          </View>

          {/* ── SMART SEARCH SUGGESTIONS DROPDOWN ── */}
          {showSearchSuggestions && !filters.searchQuery && (
            <View style={s.suggestionsPanel}>
              {/* Quick filter chips — always shown when focused */}
              <Text style={s.suggestionsHeader}>Quick Filters</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: 10 }}>
                {[
                  { label: '🔥 Today', action: () => { setFilters({ status: 'today' as any }); setShowSearchSuggestions(false); } },
                  { label: '⚠️ Overdue', action: () => { setFilters({ status: 'overdue' as any }); setShowSearchSuggestions(false); } },
                  { label: '🚀 Critical', action: () => { setFilters({ priority: 'critical' as any }); setShowSearchSuggestions(false); } },
                  { label: '🔄 In Progress', action: () => { setFilters({ status: 'in_progress' as any }); setShowSearchSuggestions(false); } },
                  { label: '✅ Completed', action: () => { setFilters({ status: 'completed' as any }); setShowSearchSuggestions(false); } },
                  ...CATEGORIES.filter(c => c.id !== 'all').map(c => ({ label: c.label, action: () => { setFilters({ category: c.label, searchQuery: '' }); setShowSearchSuggestions(false); } }))
                ].map((chip, idx) => (
                  <Pressable
                    key={idx}
                    style={s.suggestionChip}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); chip.action(); }}
                  >
                    <Text style={s.suggestionChipText}>{chip.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Filter Modal Action Button */}
        <Pressable
          style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.95 }] }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowFilterModal(true);
          }}
        >
          {activeFiltersCount > 0 ? (
            <LinearGradient colors={[colors.secondary, '#FF6500']} style={s.actionBtnGrad}>
              <SlidersHorizontal color="#FFF" size={17} strokeWidth={2.4} />
              <View style={s.filterBadgeCount}>
                <Text style={s.filterBadgeCountText}>{activeFiltersCount}</Text>
              </View>
            </LinearGradient>
          ) : (
            <View style={s.actionBtnSolid}>
              <SlidersHorizontal color={colors.text} size={17} strokeWidth={2.2} />
            </View>
          )}
        </Pressable>

        {/* Task Map Pin Button */}
        <Pressable
          style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.95 }] }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/map' as any);
          }}
        >
          <View style={s.actionBtnSolid}>
            <MapPin color={colors.secondary} size={17} strokeWidth={2.4} />
          </View>
        </Pressable>
      </View>

      {/* ── STATUS SEGMENT CONTROL (PRIMARY TASK LIFECYCLE) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.statusScroll}
        style={{ marginBottom: 12 }}
      >
        {STATUS_FILTERS.map((st) => {
          const isActive = filters.status === st.id;
          const count = statusCounts[st.id] ?? 0;
          return (
            <Pressable
              key={st.id}
              style={({ pressed }) => [s.statusTab, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilters({ status: st.id as any });
              }}
            >
              {isActive ? (
                <LinearGradient
                  colors={[colors.secondary, '#FF6500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.statusTabActiveInner}
                >
                  <st.Icon color="#FFF" size={13.5} strokeWidth={2.4} />
                  <Text style={s.statusTabActiveText}>{st.label}</Text>
                  <View style={s.statusCountBadgeActive}>
                    <Text style={s.statusCountBadgeActiveText}>{count}</Text>
                  </View>
                </LinearGradient>
              ) : (
                <View style={s.statusTabInner}>
                  <st.Icon color={colors.textSecondary} size={13.5} strokeWidth={2} />
                  <Text style={s.statusTabText}>{st.label}</Text>
                  <View style={s.statusCountBadge}>
                    <Text style={s.statusCountBadgeText}>{count}</Text>
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── CATEGORY TAGS BAR (DISTINCT DASHED-BORDER DESIGN) ── */}
      <View style={s.categorySection}>
        <View style={s.categoryHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Tag color={colors.secondary} size={12} strokeWidth={2.4} />
            <Text style={s.categoryBarLabel}>CATEGORY</Text>
          </View>
          {((filters.category && filters.category !== 'all') || filters.status !== 'all' || (filters.priority && filters.priority !== 'all')) && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                resetFilters();
              }}
              hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
              style={s.resetInlineBtn}
            >
              <RotateCcw color={colors.secondary} size={11} strokeWidth={2.2} />
              <Text style={s.resetInlineText}>Reset</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isActive = Boolean(
              (cat.id === 'all' && (!filters.category || filters.category === 'all')) ||
              (filters.category && filters.category.toLowerCase() === cat.id.toLowerCase())
            );
            return (
              <AnimatedDashedChip
                key={cat.id}
                isActive={isActive}
                activeBorderColor={colors.secondary}
                inactiveBorderColor={colors.border}
                activeBackgroundColor={colors.secondaryLight}
                inactiveBackgroundColor={colors.card}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFilters({ category: cat.id === 'all' ? 'all' : cat.label });
                }}
              >
                {renderCatIcon(cat.id, isActive ? colors.secondary : colors.textSecondary)}
                <Text style={[s.catDashedTagText, isActive && s.catDashedTagTextActive]}>
                  {cat.label}
                </Text>
                {isActive && cat.id !== 'all' && (
                  <View style={s.catClearDot}>
                    <X color={colors.secondary} size={10} strokeWidth={2.6} />
                  </View>
                )}
              </AnimatedDashedChip>
            );
          })}
        </ScrollView>
      </View>

      {/* ── TASKS HEADER ── */}
      <View style={s.taskHeader}>
        <View style={s.taskHeaderLeft}>
          <Flame color={colors.secondary} size={18} fill={colors.secondary} />
          <Text style={s.taskHeaderTitle}>Smart Ranked Tasks</Text>
        </View>
        <Text style={s.taskCount}>{filteredEvents.length} Tasks</Text>
      </View>
    </>
  );

  const carouselRef = useRef<any>(null);
  const carouselIndex = useRef(0);
  const CARD_W = SCREEN.width * 0.85; 

  const heroTasks = useMemo(() => {
    const todayPending = events.filter(
      e => !e.completed && e.status !== 'completed' && e.date?.startsWith(todayStr)
    );
    // Sort by priority score descending
    const sorted = [...todayPending].sort(
      (a, b) => priorityService.calculateScore(b, location) - priorityService.calculateScore(a, location)
    );
    if (sorted.length >= 2) return sorted;
    return topTask ? [topTask] : [];
  }, [events, todayStr, topTask, location]);

  useEffect(() => {
    if (heroTasks.length < 2) return;
    const interval = setInterval(() => {
      if (appState.current !== 'active') return;
      const next = (carouselIndex.current + 1) % heroTasks.length;
      carouselIndex.current = next;
      carouselRef.current?.scrollToIndex({ index: next, animated: true });
    }, 3500);
    return () => clearInterval(interval);
  }, [heroTasks.length]);

  const getCategoryDefaults = (): Record<string, string> => ({
    work:     "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800&auto=format&fit=crop",
    study:    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=800&auto=format&fit=crop",
    health:   "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=800&auto=format&fit=crop",
    personal: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=800&auto=format&fit=crop",
    shopping: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=800&auto=format&fit=crop",
    fitness:  "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?q=80&w=800&auto=format&fit=crop",
    academic: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=800&auto=format&fit=crop",
    meeting:  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800&auto=format&fit=crop",
  });

  const buildHeroCard = (task: Event, customWidth?: number) => {
    const score = priorityService.calculateScore(task, location);
    const prioInfo = priorityService.getPriorityInfo(score);
    const dateStr2 = task.date ? task.date.split('T')[0] : new Date().toISOString().split('T')[0];
    const timeStr2 = task.time || '23:59';
    const deadline2 = new Date(`${dateStr2}T${timeStr2.length <= 5 ? timeStr2 + ':00' : timeStr2}`);
    const diffMin2 = Math.round((deadline2.getTime() - Date.now()) / 60000);
    let timeFmt = diffMin2 < 0
      ? `Overdue by ${Math.abs(Math.round(diffMin2 / 60))}h`
      : diffMin2 < 60 ? `Due in ${diffMin2} min`
      : diffMin2 < 1440 ? `Due in ${Math.round(diffMin2 / 60)}h`
      : `Due in ${Math.round(diffMin2 / 1440)}d`;
    const durationMins2 = task.estimatedDuration || 30;
    const defaults = getCategoryDefaults();
    const cat2 = (task.category || '').toLowerCase();
    const defaultCover = defaults[cat2] || FALLBACK_HERO_COVER;
    const userCover = resolveMediaUrl(task.image);

    const departure: DepartureSuggestion | null = location
      ? getDepartureSuggestion(task, location.latitude, location.longitude)
      : null;

    return (
      <View key={task.id} style={[s.heroCard, { width: customWidth || CARD_W, padding: 0, marginHorizontal: 0, borderRadius: rs(24) }]}>
        <View style={{ width: '100%', height: hs(160), borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24), overflow: 'hidden', backgroundColor: '#182235' }}>
          <HeroCoverImage userUri={userCover} defaultUri={defaultCover} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', padding: rs(20) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(6), marginBottom: rs(6) }}>
              <Flame color={colors.secondary} size={rs(16)} fill={colors.secondary} />
              <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: ms(12), color: colors.secondary, textTransform: 'uppercase', letterSpacing: 1 }}>Focus on this</Text>
            </View>
            <Text style={{ fontFamily: 'Poppins_800ExtraBold', fontSize: ms(22), color: '#FFF', lineHeight: ms(30) }} numberOfLines={2}>{task.title}</Text>
          </LinearGradient>
        </View>

        <View style={{ padding: rs(20), backgroundColor: colors.card, borderBottomLeftRadius: rs(24), borderBottomRightRadius: rs(24) }}>
          <View style={{ gap: rs(10), marginBottom: rs(16) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(12) }}>
              <Text style={{ fontSize: ms(15) }}>{prioInfo.badge}</Text>
              <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: ms(13), color: colors.text }}>{task.priority.toUpperCase()} PRIORITY</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(12) }}>
              <Clock color={colors.textSecondary} size={rs(18)} strokeWidth={2.5} />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: ms(13), color: colors.textSecondary }}>{timeFmt}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(12) }}>
              <Zap color={colors.textSecondary} size={rs(18)} strokeWidth={2.5} />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: ms(13), color: colors.textSecondary }}>Estimated: {durationMins2} mins</Text>
            </View>

            {/* ── Travel Departure Intelligence ── */}
            {departure && !departure.isMissed && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: rs(10),
                backgroundColor: departure.isUrgent ? '#FF525215' : `${colors.secondary}12`,
                borderRadius: rs(12), paddingHorizontal: rs(12), paddingVertical: rs(8),
                borderWidth: 1, borderColor: departure.isUrgent ? '#FF525240' : `${colors.secondary}30`,
              }}>
                <Text style={{ fontSize: ms(16) }}>{modeEmoji(departure.mode)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: ms(12), color: departure.isUrgent ? '#EF4444' : colors.secondary }}>
                    {departure.isUrgent
                      ? `⚠️ Leave by ${formatLeaveBy(departure.leaveByMs)} — URGENT`
                      : `🧭 Leave by ${formatLeaveBy(departure.leaveByMs)}`}
                  </Text>
                  <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: ms(10), color: colors.textSecondary }}>
                    {departure.travelMins} min travel · {departure.distanceKm} km · {departure.leaveInMins > 0 ? `in ${departure.leaveInMins} min` : 'now'}
                  </Text>
                </View>
              </View>
            )}
            {departure?.isMissed && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(10), backgroundColor: '#EF444415', borderRadius: rs(12), paddingHorizontal: rs(12), paddingVertical: rs(8), borderWidth: 1, borderColor: '#EF444440' }}>
                <Text style={{ fontSize: ms(14) }}>🚨</Text>
                <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: ms(12), color: '#EF4444', flex: 1 }}>
                  You should have left {Math.abs(departure.leaveInMins)} min ago
                </Text>
              </View>
            )}

            {task.reminders && task.reminders.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(12) }}>
                <Bell color={colors.secondary} size={rs(18)} strokeWidth={2.5} />
                <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: ms(13), color: colors.secondary }} numberOfLines={1}>
                  {task.reminders.map(r => {
                    if (r.type === 'exact') return `Reminder at ${r.time}`;
                    if (r.type === 'before') return `Reminder: ${r.value} ${r.unit} before`;
                    if (r.type === 'daily') return `Daily Reminder: ${r.time}`;
                    return `Reminder: ${r.time || r.type}`;
                  }).join(' · ')}
                </Text>
              </View>
            )}
          </View>

          <Pressable
            style={s.heroBtnWrapper}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (task.status === 'in_progress') handleCompleteTask(task);
              else handleStartTask(task);
            }}
          >
            <LinearGradient
              colors={task.status === 'in_progress' ? [colors.success, colors.success] : [colors.secondary, colors.secondary]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[s.heroBtn, { borderRadius: rs(16), height: rs(56), flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
            >
              {task.status === 'in_progress'
                ? <CheckCircle2 color="#FFF" size={rs(20)} strokeWidth={2.5} style={{ marginRight: rs(8) }} />
                : <Zap color="#FFF" size={rs(20)} fill="#FFF" style={{ marginRight: rs(8) }} />}
              <Text style={[s.heroBtnText, { fontSize: ms(14), fontFamily: 'Poppins_800ExtraBold', color: '#FFF' }]}>
                {task.status === 'in_progress' ? 'MARK COMPLETED' : 'START TASK NOW'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  };


  const resolveFestivalImage = useCallback((url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) return url;
    const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || '';
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  }, []);

  const renderFestivalCardBody = () => {
    if (!festivalBanner) return null;
    const nowMs = Date.now();
    if (festivalBanner.startDate && nowMs < new Date(festivalBanner.startDate).getTime()) return null;
    if (festivalBanner.endDate && nowMs > new Date(festivalBanner.endDate).getTime()) return null;
    const imgUri = resolveFestivalImage(festivalBanner.imageUrl);

    return (
      <View style={{ width: '100%', alignItems: 'center' }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: rs(6),
          backgroundColor: `${colors.secondary}18`,
          paddingHorizontal: rs(12),
          paddingVertical: rs(4),
          borderRadius: rs(14),
          marginBottom: rs(10),
        }}>
          <Sparkles color={colors.secondary} size={rs(13)} strokeWidth={2.3} />
          <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: ms(10.5), color: colors.secondary, letterSpacing: 0.6 }}>
            FESTIVAL WISHES
          </Text>
        </View>

        <Text style={[s.aiEmptyTitle, { fontSize: ms(22), marginBottom: rs(12), color: colors.secondary, textAlign: 'center', letterSpacing: -0.4 }]}>
          {festivalBanner.title}
        </Text>

        {imgUri ? (
          <Image
            source={{ uri: imgUri }}
            style={{
              width: '100%',
              height: rs(175),
              borderRadius: rs(20),
              marginBottom: rs(14),
            }}
            resizeMode="cover"
          />
        ) : null}

        <Text style={[s.aiEmptySub, { fontSize: ms(14.5), textAlign: 'center', paddingHorizontal: rs(10), lineHeight: ms(22), color: colors.textSecondary }]}>
          {festivalBanner.greeting}
        </Text>
      </View>
    );
  };

  const renderHeroFocusCard = () => {
    if (heroTasks.length === 0) {
      return (
        <AllCaughtUpCard
          colors={colors}
          festivalContent={festivalBanner ? renderFestivalCardBody() : undefined}
          onPlanNewTask={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/add-event');
          }}
        />
      );
    }

    const festivalBannerStrip = festivalBanner ? (
      <View style={{ paddingHorizontal: rs(16), marginTop: rs(10), marginBottom: rs(10) }}>
        <LinearGradient
          colors={[`${colors.secondary}15`, `${colors.secondary}05`, colors.card]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.heroCard, {
            alignItems: 'center',
            paddingVertical: rs(20),
            borderWidth: 1.5,
            borderColor: `${colors.secondary}40`,
            borderStyle: 'dashed',
            borderRadius: rs(28),
            marginHorizontal: 0,
            paddingHorizontal: rs(18),
            elevation: 0,
            shadowOpacity: 0,
          }]}
        >
          {renderFestivalCardBody()}
        </LinearGradient>
      </View>
    ) : null;

    // Single event → plain card, no scroll
    if (heroTasks.length === 1) {
      return (
        <>
          {festivalBannerStrip}
          <View style={{ paddingHorizontal: rs(16), paddingBottom: rs(20), paddingTop: rs(10), alignItems: 'center' }}>
            {buildHeroCard(heroTasks[0], Math.min(winWidth, contentMaxWidth) - rs(32))}
          </View>
        </>
      );
    }

    // 2+ events → horizontal auto-scroll carousel
    return (
      <>
        {festivalBannerStrip}
        <View style={{ marginBottom: rs(10) }}>
        <FlatList
          ref={carouselRef}
          data={heroTasks}
          extraData={heroTasks}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={3}
          removeClippedSubviews={false}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled={false}
          snapToInterval={CARD_W + rs(12)}
          snapToAlignment="start"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: rs(16), gap: rs(12), paddingBottom: rs(24), paddingTop: rs(10) }}
          renderItem={({ item }) => buildHeroCard(item)}
          onScrollToIndexFailed={() => {}}
        />
        {/* Dot indicators */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: rs(6), marginTop: rs(-5) }}>
          {heroTasks.map((_, i) => (
            <View key={i} style={{ width: rs(6), height: rs(6), borderRadius: rs(3), backgroundColor: i === 0 ? colors.secondary : colors.border }} />
          ))}
        </View>
      </View>
      </>
    );
  };



  const priorityConfig = useMemo(() => getPriorityConfig(colors), [colors]);

  const handlePressTaskCard = useCallback((item: Event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/event/${item.id || item._id}` as any);
  }, [router]);

  const handleActionTaskCard = useCallback((item: Event) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const isCompleted = item.completed || item.status === 'completed';
    const isInProgress = item.status === 'in_progress';
    if (isCompleted || isInProgress) {
      handleCompleteTask(item);
    } else {
      handleStartTask(item);
    }
  }, [handleCompleteTask, handleStartTask]);

  const handleToggleCardCompletion = useCallback((id: string) => {
    toggleEventCompletion(id);
  }, [toggleEventCompletion]);

  const renderEventCard = useCallback(({ item }: { item: Event }) => {
    const prio = priorityConfig[item.priority?.toLowerCase()] || priorityConfig.medium;
    return (
      <HomeTaskCard
        item={item}
        colors={colors}
        s={s}
        prio={prio}
        onPressCard={handlePressTaskCard}
        onToggleCompletion={handleToggleCardCompletion}
        onActionPress={handleActionTaskCard}
      />
    );
  }, [priorityConfig, colors, s, handlePressTaskCard, handleToggleCardCompletion, handleActionTaskCard]);

  const keyExtractorTask = useCallback(
    (item: Event, index: number) => item.id || item._id || `task-${index}`,
    []
  );


  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <FlatList
        data={filteredEvents}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={30}
        windowSize={5}
        removeClippedSubviews={true}
        keyExtractor={keyExtractorTask}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader()}
        renderItem={renderEventCard}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <View style={s.emptyIconBox}>
              <Sparkles color={colors.primary} size={32} strokeWidth={2.2} />
            </View>
            <Text style={s.emptyTitle}>No Matching Tasks</Text>
            <Text style={s.emptySub}>
              {filters.searchQuery || filters.status !== 'all' || filters.category !== 'all'
                ? 'Try adjusting your filters or search query'
                : 'Stay ahead of your goals by creating your first task!'}
            </Text>
            <Pressable
              style={s.emptyBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/add-event'); }}
            >
              <LinearGradient colors={[colors.secondary, colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtnGrad}>
                <Plus color="#FFF" size={16} strokeWidth={2.8} />
                <Text style={s.emptyBtnText}>Create New Task</Text>
              </LinearGradient>
            </Pressable>
          </View>
        }
        contentContainerStyle={[s.listContent, containerStyle]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.secondary}
            colors={[colors.secondary]}
          />
        }
      />

      <AlarmModal
        visible={showAlarmModal}
        event={activeAlarmEvent}
        onDismiss={() => setShowAlarmModal(false)}
        onStartTask={(ev) => { setShowAlarmModal(false); handleStartTask(ev); }}
      />

      <LocationArrivalModal
        visible={!!arrivedTask && !showAlarmModal}
        event={arrivedTask}
        triggerType={arrivedTriggerType}
        onDismiss={dismissArrivedTask}
        onStartTask={(ev) => { dismissArrivedTask(); handleStartTask(ev); }}
        onSmartSnooze={handleSmartSnooze}
      />

      {buddyAlert && (
        <BuddyAlertModal
          alert={buddyAlert}
          onDismiss={clearBuddyAlert}
        />
      )}

      <ZenModePermissionModal
        visible={zenModalVisible}
        taskTitle={zenPendingTask?.title || 'Critical Task'}
        onAllow={async () => {
          // Save permission granted
          await zenModeService.savePermissionChoice(true);
          setZenModalVisible(false);
          // Now open Android DND settings
          try {
            const { Linking } = require('react-native');
            await Linking.openURL('android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS').catch(() =>
              Linking.openSettings()
            );
          } catch { /* ignore */ }
          // Start the pending task
          if (zenPendingTask) {
            const taskId = (zenPendingTask.id || zenPendingTask._id) as string;
            updateTaskStatus(taskId, 'in_progress');
            router.push(`/event/${taskId}` as any);
            setZenPendingTask(null);
          }
        }}
        onDeny={async () => {
          // Save user's denial — won't ask again
          await zenModeService.savePermissionChoice(false);
          setZenModalVisible(false);
          // Still start the task, just without DND
          if (zenPendingTask) {
            const taskId = (zenPendingTask.id || zenPendingTask._id) as string;
            updateTaskStatus(taskId, 'in_progress');
            router.push(`/event/${taskId}` as any);
            setZenPendingTask(null);
          }
        }}
      />

      {/* ── HAMBURGER MENU MODAL (SIDE NAVBAR) ── */}
      <Modal visible={isMenuOpen} transparent animationType="none" onRequestClose={() => closeMenu()}>
        <Animated.View style={[s.menuOverlay, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeMenu()} />
        </Animated.View>
        <Animated.View style={[s.sideNavbar, { transform: [{ translateX: slideAnim }] }]}>
          <View style={s.sideNavHeader}>
             <View style={s.sideNavAvatar}>
                {hasValidPhoto ? (
                  <Image source={{ uri: resolveMediaUrl(user?.profilePhoto) }} style={s.sideNavAvatarImg} />
                ) : (
                  <Text style={s.sideNavAvatarText}>{userInitial}</Text>
                )}
             </View>
             <View style={{ flex: 1 }}>
                <Text style={s.sideNavName} numberOfLines={1}>{user?.name || 'User'}</Text>
                <Text style={s.sideNavEmail} numberOfLines={1}>{user?.email || '@username'}</Text>
             </View>
             <Pressable onPress={() => closeMenu()} style={s.sideNavCloseBtn}>
                <X color={colors.textSecondary} size={22} strokeWidth={2.5} />
             </Pressable>
          </View>
          
          <ScrollView style={s.sideNavScroll} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.sideNavSectionLabel}>ACCOUNT</Text>
            
            <Pressable style={s.sideNavItem} onPress={() => closeMenu(() => router.push('/(tabs)/profile' as any))}>
              <View style={[s.sideNavIconBox, { backgroundColor: colors.primaryLight || '#EEF2FF' }]}>
                <UserIcon color={colors.primary} size={20} strokeWidth={2.5} />
              </View>
              <Text style={s.sideNavItemText}>My Profile</Text>
              <ChevronRight color={colors.border} size={18} strokeWidth={2.5} />
            </Pressable>

            <Pressable style={s.sideNavItem} onPress={() => closeMenu(() => router.push('/friends/list' as any))}>
              <View style={[s.sideNavIconBox, { backgroundColor: colors.secondaryLight }]}>
                <Users color={colors.secondary} size={20} strokeWidth={2.5} />
              </View>
              <Text style={s.sideNavItemText}>My Friends</Text>
              <ChevronRight color={colors.border} size={18} strokeWidth={2.5} />
            </Pressable>

            <Pressable style={s.sideNavItem} onPress={() => closeMenu(() => router.push('/(tabs)/settings' as any))}>
              <View style={[s.sideNavIconBox, { backgroundColor: colors.surface }]}>
                <Settings color={colors.icon} size={20} strokeWidth={2.5} />
              </View>
              <Text style={s.sideNavItemText}>Settings</Text>
              <ChevronRight color={colors.border} size={18} strokeWidth={2.5} />
            </Pressable>

            <View style={s.sideNavDivider} />
            <Text style={s.sideNavSectionLabel}>EXPLORE</Text>

            <Pressable style={s.sideNavItem} onPress={() => closeMenu(() => router.push('/community/reviews' as any))}>
              <View style={[s.sideNavIconBox, { backgroundColor: colors.warningLight || '#FEF3C7' }]}>
                <MessageCircle color={colors.warning || '#D97706'} size={20} strokeWidth={2.5} />
              </View>
              <Text style={s.sideNavItemText}>Community Reviews</Text>
              <ChevronRight color={colors.border} size={18} strokeWidth={2.5} />
            </Pressable>

            {/* Side Nav Brand Footer */}
            <View style={{ marginTop: 24, padding: 14, backgroundColor: colors.surface, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={{ width: 36, height: 36, borderRadius: 10 }}
                resizeMode="contain"
              />
              <View>
                <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 13, color: colors.text }}>EventFlow</Text>
                <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 10, color: colors.textSecondary }}>Smart Event Platform</Text>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* ── SMART FILTER MODAL SHEET ── */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFilterModal(false)} />
          <View style={[s.filterModalCard, { paddingBottom: Math.max(insets.bottom + 24, 48) }]}>
            <View style={s.filterModalHandle} />

            <View style={s.filterModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={s.filterModalHeaderIconBox}>
                  <SlidersHorizontal color={colors.secondary} size={18} strokeWidth={2.4} />
                </View>
                <View>
                  <Text style={s.filterModalTitle}>Filter Tasks</Text>
                  <Text style={s.filterModalSubtitle}>Customize your task view</Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  resetFilters();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={s.resetAllBtn}
              >
                <RotateCcw color={colors.secondary} size={13} strokeWidth={2.2} />
                <Text style={s.resetAllBtnText}>Reset</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Status Section */}
              <Text style={s.filterSectionTitle}>TASK STATUS</Text>
              <View style={s.filterChipGrid}>
                {STATUS_FILTERS.map((st) => {
                  const isSelected = filters.status === st.id;
                  const count = statusCounts[st.id] ?? 0;
                  return (
                    <Pressable
                      key={st.id}
                      style={[
                        s.filterModalChip,
                        isSelected && s.filterModalChipSelected,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setFilters({ status: st.id as any });
                      }}
                    >
                      <st.Icon color={isSelected ? colors.secondary : colors.textSecondary} size={13.5} strokeWidth={2.2} />
                      <Text style={[s.filterModalChipText, isSelected && s.filterModalChipTextSelected]}>
                        {st.label}
                      </Text>
                      <View style={[s.filterCountBadge, isSelected && s.filterCountBadgeSelected]}>
                        <Text style={[s.filterCountBadgeText, isSelected && s.filterCountBadgeTextSelected]}>
                          {count}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Priority Section */}
              <Text style={[s.filterSectionTitle, { marginTop: 16 }]}>PRIORITY</Text>
              <View style={s.filterChipGrid}>
                {[
                  { id: 'all', label: 'All', color: colors.textSecondary },
                  { id: 'critical', label: 'Critical', color: colors.error },
                  { id: 'high', label: 'High', color: colors.secondary },
                  { id: 'medium', label: 'Medium', color: colors.warning },
                  { id: 'low', label: 'Low', color: colors.success },
                ].map((p) => {
                  const isSelected = (filters.priority || 'all') === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      style={[
                        s.filterModalChip,
                        isSelected && s.filterModalChipSelected,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setFilters({ priority: p.id as any });
                      }}
                    >
                      <View style={[s.priorityDot, { backgroundColor: p.color }]} />
                      <Text style={[s.filterModalChipText, isSelected && s.filterModalChipTextSelected]}>
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Category Grid (with signature dashed borders!) */}
              <Text style={[s.filterSectionTitle, { marginTop: 16 }]}>CATEGORIES</Text>
              <View style={s.filterCategoryGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected =
                    (cat.id === 'all' && (!filters.category || filters.category === 'all')) ||
                    (filters.category && filters.category.toLowerCase() === cat.id.toLowerCase());
                  return (
                    <Pressable
                      key={cat.id}
                      style={[
                        s.categoryDashedCard,
                        isSelected && s.categoryDashedCardSelected,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setFilters({ category: cat.id === 'all' ? 'all' : cat.label });
                      }}
                    >
                      {renderCatIcon(cat.id, isSelected ? colors.secondary : colors.textSecondary)}
                      <Text
                        numberOfLines={1}
                        style={[s.categoryDashedCardText, isSelected && s.categoryDashedCardTextSelected]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Bottom Apply Action */}
            <Pressable
              style={s.filterApplyBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowFilterModal(false);
              }}
            >
              <LinearGradient colors={[colors.secondary, '#FF6500']} style={s.filterApplyGrad}>
                <Text style={s.filterApplyText}>Show {filteredEvents.length} Tasks</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}


function renderCatIcon(id: string, color: string) {
  const size = 12.5;
  const sw = 2.2;
  switch (id) {
    case 'all':         return <Sparkles color={color} size={size} strokeWidth={sw} />;
    case 'Academic':    return <GraduationCap color={color} size={size} strokeWidth={sw} />;
    case 'Work':        return <Briefcase color={color} size={size} strokeWidth={sw} />;
    case 'Personal':    return <UserIcon color={color} size={size} strokeWidth={sw} />;
    case 'Appointment': return <CalendarClock color={color} size={size} strokeWidth={sw} />;
    case 'Interview':   return <Users color={color} size={size} strokeWidth={sw} />;
    case 'Hackathon':   return <Code color={color} size={size} strokeWidth={sw} />;
    case 'Meeting':     return <Users color={color} size={size} strokeWidth={sw} />;
    case 'Health':      return <Activity color={color} size={size} strokeWidth={sw} />;
    case 'Shopping':    return <ShoppingBag color={color} size={size} strokeWidth={sw} />;
    default:            return <Hash color={color} size={size} strokeWidth={sw} />;
  }
}


const getStyles = (colors: ColorTheme) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: hs(160),
  },

  // ── Navbar ──
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(16),
    paddingTop: rs(10),
    paddingBottom: rs(4),
  },
  navIconBtn: {
    width: rs(38),
    height: rs(38),
    borderRadius: rs(12),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(5),
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
  },
  datePillText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: ms(11),
    color: colors.textSecondary,
  },
  brandDot: {
    width: rs(3),
    height: rs(3),
    borderRadius: rs(2),
    backgroundColor: '#D1D9E6',
  },
  navBrand: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: ms(11),
    color: colors.secondary,
    letterSpacing: 1.2,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
  },
  bellBtn: {
    width: rs(38),
    height: rs(38),
    borderRadius: rs(12),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: rs(8),
    right: rs(8),
    width: rs(8),
    height: rs(8),
    borderRadius: rs(4),
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImg: {
    width: rs(38),
    height: rs(38),
    borderRadius: rs(12),
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  avatarFallback: {
    width: rs(38),
    height: rs(38),
    borderRadius: rs(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: ms(16),
    color: '#FFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: rs(10),
    height: rs(10),
    borderRadius: rs(5),
    backgroundColor: colors.success,
    borderWidth: 1.5,
    borderColor: colors.background,
  },

  // ── Greeting ──
  greetingRow: {
    paddingHorizontal: rs(16),
    paddingTop: rs(10),
    paddingBottom: rs(14),
  },
  greeting: {
    fontFamily: 'Poppins_700Bold',
    fontSize: ms(22),
    color: colors.text,
    lineHeight: ms(30),
  },

  // ── Momentum Card ──
  momentumCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  momentumTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  momentumLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flameBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentumTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  donePill: {
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  donePillText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: colors.secondary,
  },
  progressBg: {
    height: 8,
    backgroundColor: colors.divider,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statIconNum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 2,
  },
  statNum: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 16,
  },
  statLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  vertDiv: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  greetingSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: ms(14),
    color: colors.textSecondary,
    marginTop: rs(2),
  },

  // ── Hero Focus Card ──
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: rs(24),
    padding: rs(24),
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  heroLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: ms(14),
    color: colors.secondary,
    marginBottom: rs(8),
  },
  heroTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: ms(22),
    color: colors.text,
    lineHeight: ms(30),
    marginBottom: rs(16),
  },
  heroMetaCol: {
    gap: rs(8),
    marginBottom: rs(24),
  },
  heroMetaText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: ms(14),
    color: colors.textSecondary,
  },
  heroBtnWrapper: {
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  heroBtn: {
    paddingVertical: rs(14),
    borderRadius: rs(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: ms(14),
    color: colors.card,
    letterSpacing: 0.5,
  },
  aiBadgeEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  // Triage UI
  triageCard: {
    marginHorizontal: rs(16),
    marginBottom: rs(16),
    backgroundColor: colors.card,
    borderRadius: rs(20),
    borderWidth: 1.5,
    borderColor: colors.error + '25',
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  triageCardInner: {
    paddingVertical: rs(13),
    paddingHorizontal: rs(14),
    flexDirection: 'row',
    alignItems: 'center',
  },
  triageIconWrap: {
    width: rs(44),
    height: rs(44),
    borderRadius: rs(14),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: rs(13),
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  triageInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  triageBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    marginBottom: rs(3),
  },
  triageOverdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    paddingHorizontal: rs(7),
    paddingVertical: rs(2),
    borderRadius: rs(6),
    gap: rs(4),
  },
  triagePulseDot: {
    width: rs(6),
    height: rs(6),
    borderRadius: rs(3),
    backgroundColor: colors.error,
  },
  triageOverdueText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: ms(9.5),
    color: colors.error,
    letterSpacing: 0.5,
  },
  triageCountHint: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: ms(11),
    color: colors.textSecondary,
  },
  triageTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: ms(15),
    color: colors.text,
    lineHeight: ms(20),
  },
  triageSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: ms(11.5),
    color: colors.textSecondary,
    marginTop: rs(1),
  },
  triageActionCircle: {
    width: rs(34),
    height: rs(34),
    borderRadius: rs(17),
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: rs(8),
  },
  aiBadge: {
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  aiBadgeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: colors.secondary,
    letterSpacing: 0.3,
  },
  prioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  prioDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  prioPillText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 9,
    letterSpacing: 0.4,
  },
  aiTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: colors.text,
    lineHeight: 25,
    marginBottom: 2,
  },
  aiDesc: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  aiEmptyBody: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  aiEmptyTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  aiEmptySub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  aiCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    marginTop: 4,
  },
  aiCreateBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: colors.secondary,
  },
  aiMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  aiMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  aiMetaPillOverdue: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  aiMetaPillText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: colors.secondary,
  },
  aiLocPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  aiLocText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  aiActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiActionBtnWrapper: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
  aiActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 14,
  },
  aiActionBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: '#FFF',
    letterSpacing: 0.2,
  },
  bookmarkBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Search Row ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 12,
    zIndex: 100,
  },
  searchBox: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13.5,
    color: colors.text,
    paddingVertical: 0,
  },
  searchClearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  actionBtnSolid: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnGrad: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeCount: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3.5,
  },
  filterBadgeCountText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 9.5,
    color: colors.secondary,
  },

  // ── Search Suggestions Dropdown ──
  suggestionsPanel: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 999,
    overflow: 'hidden',
    maxHeight: 320,
  },
  suggestionsHeader: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginLeft: 14,
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  suggestionChip: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionChipText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: colors.text,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  suggestionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  suggestionItemTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: colors.text,
  },
  suggestionItemSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  suggestionItemDate: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },

  // ── Status Segment Tabs (Primary Task Lifecycle) ──
  statusScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  statusTab: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  statusTabActiveInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  statusTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1.2,
    borderColor: colors.border,
  },
  statusTabText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12.5,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  statusTabActiveText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12.5,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  statusCountBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 6.5,
    paddingVertical: 1.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusCountBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  statusCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    paddingHorizontal: 6.5,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  statusCountBadgeActiveText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10.5,
    color: '#FFFFFF',
  },

  // ── Category Tags Section (Dashed Border Tags) ──
  categorySection: {
    marginBottom: 14,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  categoryBarLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10.5,
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  resetInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.secondaryLight,
  },
  resetInlineText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: colors.secondary,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    gap: 8,
    alignItems: 'center',
  },
  catDashedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  catDashedTagActive: {
    backgroundColor: colors.secondaryLight,
    borderColor: colors.secondary,
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  catDashedTagText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  catDashedTagTextActive: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: colors.secondary,
  },
  catClearDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 122, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },

  // ── Filter Modal Sheet Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  filterModalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
    maxHeight: SCREEN.height * 0.85,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  filterModalHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterModalHeaderIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  filterModalSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  resetAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.secondaryLight,
  },
  resetAllBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: colors.secondary,
  },
  filterSectionTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  filterChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterModalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7.5,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.2,
    borderColor: colors.border,
  },
  filterModalChipSelected: {
    backgroundColor: colors.secondaryLight,
    borderColor: colors.secondary,
  },
  filterModalChipText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.text,
  },
  filterModalChipTextSelected: {
    fontFamily: 'Poppins_600SemiBold',
    color: colors.secondary,
  },
  filterCountBadge: {
    backgroundColor: colors.card,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  filterCountBadgeSelected: {
    backgroundColor: colors.secondary,
  },
  filterCountBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    color: colors.textSecondary,
  },
  filterCountBadgeTextSelected: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    color: '#FFFFFF',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryDashedCard: {
    width: '31%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  categoryDashedCardSelected: {
    backgroundColor: colors.secondaryLight,
    borderColor: colors.secondary,
  },
  categoryDashedCardText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  categoryDashedCardTextSelected: {
    fontFamily: 'Poppins_600SemiBold',
    color: colors.secondary,
  },
  filterApplyBtn: {
    marginTop: 14,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  filterApplyGrad: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  filterApplyText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // ── Task Header ──
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 10,
  },
  taskHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskHeaderTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  taskCount: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: colors.secondary,
  },

  // ── Task Cards ──
  taskCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  taskBar: {
    width: 4,
  },
  taskContent: {
    flex: 1,
    padding: 14,
  },
  taskTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  taskChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  catBadge: {
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  catBadgeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 9,
    color: colors.secondary,
    letterSpacing: 0.3,
  },
  prioBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  prioBadgeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 9,
    letterSpacing: 0.3,
  },
  focusingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  focusingText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 9,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  unchecked: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#D1D9E6',
    backgroundColor: '#F9F9F9',
  },
  taskTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: ms(15),
    color: colors.text,
    lineHeight: ms(22),
    marginBottom: rs(3),
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  taskDesc: {
    fontFamily: 'Poppins_400Regular',
    fontSize: ms(12),
    color: colors.textSecondary,
    lineHeight: ms(17),
    marginBottom: rs(9),
  },
  taskDescDone: {
    color: '#B0B9C6',
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: rs(2),
  },
  taskFooterLeft: {
    flex: 1,
    paddingRight: rs(8),
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    flexWrap: 'wrap',
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(3),
    backgroundColor: colors.surface,
    paddingHorizontal: rs(7),
    paddingVertical: rs(3),
    borderRadius: rs(7),
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaTagText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: ms(10),
    color: colors.textSecondary,
  },
  durationTag: {
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: rs(7),
    paddingVertical: rs(3),
    borderRadius: rs(7),
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  durationText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: ms(10),
    color: colors.secondary,
  },
  locTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(3),
  },
  locTagText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: ms(10),
    color: colors.textSecondary,
  },
  taskAddBtn: {
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  taskCompletedBtn: {
    shadowOpacity: 0,
    elevation: 0,
  },
  taskAddBtnGrad: {
    width: rs(48),
    height: rs(48),
    borderRadius: rs(24),
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty State ──
  emptyBox: {
    alignItems: 'center',
    paddingHorizontal: rs(24),
    paddingTop: rs(32),
    paddingBottom: rs(20),
  },
  emptyIconBox: {
    width: rs(72),
    height: rs(72),
    borderRadius: rs(24),
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rs(16),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: ms(17),
    color: colors.text,
    marginBottom: rs(6),
  },
  emptySub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: ms(13),
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: ms(19),
    marginBottom: rs(20),
  },
  emptyBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  emptyBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
  },
  emptyBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: '#FFF',
    letterSpacing: 0.3,
  },
  
  // ── Hamburger Menu (Side Navbar) ──
  menuOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sideNavbar: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: SCREEN.width * 0.8,
    maxWidth: rs(340),
    backgroundColor: colors.card,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
    paddingTop: 60, // Avoid safe area notch
  },
  sideNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  sideNavAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sideNavAvatarImg: {
    width: '100%',
    height: '100%',
  },
  sideNavAvatarText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 22,
    color: colors.secondary,
  },
  sideNavName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  sideNavEmail: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -2,
  },
  sideNavCloseBtn: {
    padding: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  sideNavScroll: {
    flex: 1,
    paddingTop: 16,
  },
  sideNavSectionLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginLeft: 24,
    marginTop: 12,
    marginBottom: 8,
  },
  sideNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 14,
  },
  sideNavIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideNavItemText: {
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: colors.text,
  },
  sideNavDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 24,
    marginVertical: 8,
  },
});
