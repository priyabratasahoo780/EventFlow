import React, {
  useEffect, useState, useMemo, useCallback, useRef,
} from 'react';
import {
  StyleSheet, View, FlatList, TextInput, ScrollView,
  RefreshControl, Text, Pressable, AppState, Image, Modal,
  Animated, Dimensions, Easing,
} from 'react-native';
import { rs, ms, hs, SCREEN } from '../../constants/responsive';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEventStore } from '../../store/useEventStore';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { useLocation } from '../../hooks/useLocation';
import AlarmModal from '../../components/AlarmModal';
import LocationArrivalModal from '../../components/LocationArrivalModal';
import BuddyAlertModal from '../../components/BuddyAlertModal';
import * as Notifications from '../../mock-expo-notifications';
import {
  Search, Filter, CheckCircle2, Clock, X,
  Sparkles, Plus, Flame, Calendar as CalendarIcon,
  Hourglass, AlertTriangle, Zap, MapPin, Grid3x3, Bell,
  Menu, GraduationCap, Briefcase, User as UserIcon,
  Check, ChevronRight, LogOut,
  CalendarClock, Users, Code, Activity, ShoppingBag, Hash, Settings, MessageCircle
} from 'lucide-react-native';
import { Event } from '../../models/Event';
import { priorityService } from '../../services/priorityService';
import { useAuthStore } from '../../store/useAuthStore';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ZenModePermissionModal from '../../components/ZenModePermissionModal';
import { zenModeService } from '../../services/zenModeService';
import { getDepartureSuggestion, formatLeaveBy, modeEmoji, DepartureSuggestion } from '../../services/travelService';
import { notificationService } from '../../services/notificationService';

// ─── Constants ────────────────────────────────────────────────────────────────

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
  { id: 'all',         label: 'All Tasks',   Icon: Grid3x3 },
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

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { getColors } = useThemeStore();
  const colors = getColors();
  const s = getStyles(colors);
  const { user } = useAuthStore();
  const { events, friendsEvents, loadEvents, syncFriendSharedEvents, updateTaskStatus, filters, setFilters, getFilteredEvents, getTopRecommendation, initSocket, buddyAlert, clearBuddyAlert } = useEventStore();
  const { location, arrivedTask, arrivedTriggerType, dismissArrivedTask } = useLocation(events);
  const [refreshing, setRefreshing] = useState(false);
  const [activeAlarmEvent, setActiveAlarmEvent] = useState<Event | null>(null);
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const appState = useRef(AppState.currentState);

  // ── Zen Mode modal state ─────────────────────────────────────────────────
  const [zenModalVisible, setZenModalVisible] = useState(false);
  const [zenPendingTask, setZenPendingTask] = useState<Event | null>(null);
  // ─────────────────────────────────────────────────────────────────────────

  const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const emptyFloatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(emptyFloatAnim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(emptyFloatAnim, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();
  }, [emptyFloatAnim]);

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
        toValue: -Dimensions.get('window').width,
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
  }, [slideAnim, fadeAnim]);

  const fetchFriendsEvents = useCallback(async () => {
    try {
      await syncFriendSharedEvents();
    } catch {}
  }, [syncFriendSharedEvents]);

  useEffect(() => {
    initSocket();
    loadEvents();
    fetchFriendsEvents();

    let syncInterval: ReturnType<typeof setInterval> | null = setInterval(() => {
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
      if (syncInterval) clearInterval(syncInterval);
      subscription.remove();
    };
  }, [fetchFriendsEvents, loadEvents, syncFriendSharedEvents]);

  const triggeredAlarms = useRef<Set<string>>(new Set());

  // 1. Listen for system push notifications (works in background)
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification: any) => {
      const data = notification.request.content.data;
      const eventId = data?.eventId;
      // Only trigger alarm modal for event notifications (not cheers, messages, or friend requests)
      if (!eventId || data?.type === 'cheer_nudge' || data?.type === 'friend_request' || data?.type === 'message') {
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
      if (!eventId || data?.type === 'cheer_nudge' || data?.type === 'friend_request' || data?.type === 'message') {
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

  // 2. Precise foreground alarm checker (fixes Android exact alarm delays)
  useEffect(() => {
    if (events.length === 0 && friendsEvents.length === 0) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      // Only check at the first 5 seconds of each minute
      if (now.getSeconds() > 5) return; 
      
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      const allEvents = [...events, ...friendsEvents];
      
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      
      const dueTask = allEvents.find(e => {
        if (e.completed || e.status === 'completed' || e.status === 'in_progress') return false;
        
        let triggerTimes: { h: number; m: number }[] = [];
        
        // 1. Add main event time
        if (e.time && e.date && e.date.startsWith(todayStr)) {
          let timeParts = e.time.split(' ');
          let [h, m] = timeParts[0].split(':').map(Number);
          if (timeParts[1] === 'PM' && h !== 12) h += 12;
          if (timeParts[1] === 'AM' && h === 12) h = 0;
          triggerTimes.push({ h, m });
        }
        
        // 2. Add reminder times
        if (e.reminders && e.reminders.length > 0) {
          e.reminders.forEach((r: any) => {
            // Only trigger full-screen alarm modal if preference includes alarm or is undefined/both
            const pref = r.alarmPreference || 'both';
            if (pref === 'notification') return;

            if (r.type === 'exact' && r.time && (!r.date || r.date.startsWith(todayStr))) {
              let [h, m] = r.time.split(':').map(Number);
              triggerTimes.push({ h, m });
            } else if (r.type === 'before' && r.value && e.time) {
              let timeParts = e.time.split(' ');
              let [h, m] = timeParts[0].split(':').map(Number);
              if (timeParts[1] === 'PM' && h !== 12) h += 12;
              if (timeParts[1] === 'AM' && h === 12) h = 0;
              
              let triggerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
              if (r.unit === 'minutes') triggerDate.setMinutes(triggerDate.getMinutes() - r.value);
              else if (r.unit === 'hours') triggerDate.setHours(triggerDate.getHours() - r.value);
              else if (r.unit === 'days') triggerDate.setDate(triggerDate.getDate() - r.value);
              
              if (triggerDate.getDate() === now.getDate()) {
                triggerTimes.push({ h: triggerDate.getHours(), m: triggerDate.getMinutes() });
              }
            }
          });
        }
        
        // Check if ANY trigger time matches current time
        for (let time of triggerTimes) {
          const alarmKey = `${e.id || e._id}_${time.h}:${time.m}`;
          if (time.h === currentHours && time.m === currentMinutes && !triggeredAlarms.current.has(alarmKey)) {
            triggeredAlarms.current.add(alarmKey);
            return true;
          }
        }
        return false;
      });

      if (dueTask && !showAlarmModal) {
        setActiveAlarmEvent(dueTask);
        setShowAlarmModal(true);
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [events, friendsEvents, showAlarmModal]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await Promise.all([loadEvents(), fetchFriendsEvents()]);
    setRefreshing(false);
  }, [loadEvents, fetchFriendsEvents]);

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
      // ── Zen Mode: Check if user has been asked permission yet ─────────
      const permStatus = await zenModeService.getPermissionStatus();
      if (permStatus === null) {
        // Pehli baar — rich modal dikhao, task ke sath hold karo
        setZenPendingTask(task);
        setZenModalVisible(true);
        return; // Modal callbacks mein task start hoga
      }
      // Permission pehle se decide ho chuka hai — directly start
    }

    updateTaskStatus((task.id || task._id) as string, 'in_progress');
    router.push(`/event/${task.id || task._id}` as any);
  }, [updateTaskStatus, router]);

  const handleSmartSnooze = useCallback(async (task: Event, type: 'time' | 'exit_reentry') => {
    const taskId = (task.id || task._id) as string;
    if (type === 'exit_reentry') {
      try {
        const pendingExitStr = await AsyncStorage.getItem('geofencing_pending_exit_tasks');
        const pendingExitTasks = pendingExitStr ? JSON.parse(pendingExitStr) : {};
        pendingExitTasks[taskId] = true;
        await AsyncStorage.setItem('geofencing_pending_exit_tasks', JSON.stringify(pendingExitTasks));
        console.log(`[Smart Context] EC4: Task "${task.title}" marked as pending_exit. Will re-trigger when they leave and re-enter.`);
      } catch (e) {
        console.error('Failed to set pending_exit_task:', e);
      }
    } else {
      // Classic 15-min snooze
      const newTime = new Date(Date.now() + 15 * 60000);
      const h = String(newTime.getHours()).padStart(2, '0');
      const m = String(newTime.getMinutes()).padStart(2, '0');
      console.log(`[Smart Context] Standard 15-min snooze for "${task.title}". Reminding at ${h}:${m}`);
      // Assuming a generic update to triggers would happen here for a pure time snooze.
      // For now, it just dismisses and stops annoying the user until geofence changes.
    }
  }, []);

  // ─── Sub-components ───────────────────────────────────────────────────────

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

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderHeader = () => (
    <>
      {/* ── TOP NAVBAR ── */}
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
          <View style={s.datePill}>
            <CalendarIcon color={colors.secondary} size={11} strokeWidth={2.5} />
            <Text style={s.datePillText}>{getFormattedDate()}</Text>
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
                <Image source={{ uri: user!.profilePhoto }} style={s.avatarImg} />
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
          {getGreeting()}, {userName} 👋
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
            <Search color={filters.searchQuery ? colors.primary : colors.textSecondary} size={17} strokeWidth={2} />
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
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilters({ searchQuery: '' }); setShowSearchSuggestions(false); }}>
                <X color={colors.textSecondary} size={15} strokeWidth={2.5} />
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

        <Pressable
          style={[s.filterBtn, { marginLeft: 10 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/map' as any);
          }}
        >
          <LinearGradient colors={[colors.secondary, colors.secondary]} style={s.filterBtnGrad}>
            <Filter color="#FFF" size={17} strokeWidth={2.5} />
          </LinearGradient>
        </Pressable>
      </View>

      {/* ── STATUS FILTERS ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.statusScroll}
        style={{ marginBottom: 10 }}
      >
        {STATUS_FILTERS.map((st) => {
          const isActive = filters.status === st.id;
          return (
            <Pressable
              key={st.id}
              style={[s.statusPill, isActive && s.statusPillActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilters({ status: st.id as any });
              }}
            >
              {isActive ? (
                <View style={s.statusPillActiveInner}>
                  <st.Icon color={colors.secondary} size={13} strokeWidth={2.5} />
                  <Text style={[s.statusPillText, { color: colors.secondary }]}>{st.label}</Text>
                </View>
              ) : (
                <View style={s.statusPillInner}>
                  <st.Icon color={colors.textSecondary} size={13} strokeWidth={2.2} />
                  <Text style={s.statusPillText}>{st.label}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── CATEGORY CHIPS ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.categoryScroll}
        style={{ marginBottom: 16 }}
      >
        {CATEGORIES.map((cat) => {
          const isActive =
            (cat.id === 'all' && filters.category === 'all') ||
            filters.category.toLowerCase() === cat.id.toLowerCase();
          return (
            <Pressable
              key={cat.id}
              style={[s.catChip, isActive && s.catChipActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilters({ category: cat.id === 'all' ? 'all' : cat.label });
              }}
            >
              {isActive ? (
                <View style={[s.catChipGrad, { backgroundColor: colors.secondary }]}>
                  {renderCatIcon(cat.id, '#FFF')}
                  <Text style={[s.catChipText, { color: '#FFF' }]}>{cat.label}</Text>
                </View>
              ) : (
                <View style={s.catChipInner}>
                  {renderCatIcon(cat.id, colors.textSecondary)}
                  <Text style={s.catChipText}>{cat.label}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

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

  // ── Hero Carousel auto-scroll ──────────────────────────────────────────────
  const carouselRef = useRef<any>(null);
  const carouselIndex = useRef(0);
  const CARD_W = SCREEN.width * 0.85; // slightly smaller so next card peeks in

  // Build list: top pending events for today (2+ triggers carousel), fallback to topTask
  const heroTasks = useMemo(() => {
    const todayPending = events.filter(
      e => !e.completed && e.status !== 'completed' && e.date?.startsWith(todayStr)
    );
    // Sort by priority score descending
    const sorted = [...todayPending].sort(
      (a, b) => priorityService.calculateScore(b, location) - priorityService.calculateScore(a, location)
    );
    if (sorted.length >= 2) return sorted;
    // Fallback: topTask only
    return topTask ? [topTask] : [];
  }, [events, todayStr, topTask, location]);

  useEffect(() => {
    if (heroTasks.length < 2) return;
    const interval = setInterval(() => {
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
    const cover = task.image || defaults[cat2] || "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?q=80&w=800&auto=format&fit=crop";

    // Travel Departure Suggestion
    const departure: DepartureSuggestion | null = location
      ? getDepartureSuggestion(task, location.latitude, location.longitude)
      : null;

    return (
      <View key={task.id} style={[s.heroCard, { width: customWidth || CARD_W, padding: 0, marginHorizontal: 0, borderRadius: rs(24) }]}>
        <View style={{ width: '100%', height: hs(160), borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24), overflow: 'hidden' }}>
          <Image source={{ uri: cover }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
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
            {/* ─────────────────────────────────────── */}

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


  const renderHeroFocusCard = () => {
    if (heroTasks.length === 0) {
      return (
        <View style={{ paddingHorizontal: rs(16), marginBottom: rs(20), paddingTop: rs(10) }}>
          <LinearGradient 
            colors={[`${colors.secondary}15`, `${colors.secondary}05`, colors.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.heroCard, { 
              alignItems: 'center', 
              paddingVertical: rs(40), 
              borderWidth: 1.5, 
              borderColor: `${colors.secondary}40`,
              borderStyle: 'dashed',
              borderRadius: rs(32),
              marginHorizontal: 0,
              paddingHorizontal: rs(20),
              elevation: 0,
              shadowOpacity: 0
            }]}
          >
            {/* Perfectly centered layered circles */}
            <Animated.View style={{
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: rs(20),
              transform: [{
                translateY: emptyFloatAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -10]
                })
              }]
            }}>
              {/* Outer orange glow ring */}
              <View style={{
                width: rs(130),
                height: rs(130),
                borderRadius: rs(65),
                backgroundColor: `${colors.secondary}22`,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {/* Mid orange ring */}
                <View style={{
                  width: rs(104),
                  height: rs(104),
                  borderRadius: rs(52),
                  backgroundColor: `${colors.secondary}18`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {/* Inner white circle with icon */}
                  <View style={{
                    width: rs(76),
                    height: rs(76),
                    borderRadius: rs(38),
                    backgroundColor: colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.secondary,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.2,
                    shadowRadius: 16,
                    elevation: 10,
                  }}>
                    <Sparkles color={colors.secondary} size={rs(36)} strokeWidth={2} />
                  </View>
                </View>
              </View>
            </Animated.View>
            
            <Text style={[s.aiEmptyTitle, { fontSize: ms(24), marginBottom: rs(8), color: colors.secondary, letterSpacing: -0.5 }]}>All Caught Up! 🎉</Text>
            
            <Text style={[s.aiEmptySub, { fontSize: ms(15), textAlign: 'center', paddingHorizontal: rs(20), lineHeight: ms(22), color: colors.textSecondary }]}>
              You've conquered your list. Take a breather or plan your next move!
            </Text>
            
            <Pressable 
              style={({pressed}) => [{ 
                marginTop: rs(28), 
                backgroundColor: colors.secondary, 
                paddingHorizontal: rs(28), 
                paddingVertical: rs(16), 
                borderRadius: rs(20), 
                flexDirection: 'row', 
                alignItems: 'center', 
                gap: rs(10), 
                shadowColor: colors.secondary, 
                shadowOffset: { width: 0, height: 8 }, 
                shadowOpacity: 0.3, 
                shadowRadius: 16, 
                elevation: 8 
              }, pressed && { transform: [{ scale: 0.95 }] }]}
              onPress={() => { 
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
                router.push('/add-event'); 
              }}
            >
              <Plus color="#FFF" size={rs(20)} strokeWidth={3} />
              <Text style={{ fontFamily: 'Poppins_800ExtraBold', fontSize: ms(14), color: '#FFF', letterSpacing: 0.8 }}>PLAN NEW TASK</Text>
            </Pressable>
          </LinearGradient>
        </View>
      );
    }

    // Single event → plain card, no scroll
    if (heroTasks.length === 1) {
      return (
        <View style={{ paddingHorizontal: rs(16), paddingBottom: rs(20), paddingTop: rs(10), alignItems: 'center' }}>
          {buildHeroCard(heroTasks[0], SCREEN.width - rs(32))}
        </View>
      );
    }

    // 2+ events → horizontal auto-scroll carousel
    return (
      <View style={{ marginBottom: rs(10) }}>
        <FlatList
          ref={carouselRef}
          data={heroTasks}
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
    );
  };



  const renderEventCard = ({ item }: { item: Event }) => {
    const isCompleted = item.completed || item.status === 'completed';
    const isInProgress = item.status === 'in_progress';
    const PRIORITY_CONFIG = getPriorityConfig(colors);
    const prio = PRIORITY_CONFIG[item.priority?.toLowerCase()] || PRIORITY_CONFIG.medium;
    const dateFormatted = item.date ? item.date.split('T')[0] : '';
    const estDuration = item.estimatedDuration || 30;

    return (
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/event/${item.id || item._id}` as any); }}
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
            <CheckCircle2 color={isCompleted ? colors.success : '#CBD5E1'} size={22} strokeWidth={2.5} />
          </View>

          {/* Title & description */}
          <Text style={[s.taskTitle, isCompleted && s.taskTitleDone]} numberOfLines={2}>{item.title}</Text>
          {item.description ? (
            <Text style={[s.taskDesc, isCompleted && s.taskDescDone]} numberOfLines={1}>{item.description}</Text>
          ) : null}

          {/* Footer meta */}
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
                  <View style={[s.locTag, item.locationReminderEnabled && { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1 }]}>
                    <MapPin color={item.locationReminderEnabled ? '#15803D' : colors.textSecondary} size={11} />
                    <Text style={[s.locTagText, item.locationReminderEnabled && { color: '#15803D', fontFamily: 'Poppins_600SemiBold' }]} numberOfLines={1}>
                      {item.locationReminderEnabled ? `📍 Reminder Set` : item.location}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Pressable 
              style={[s.taskAddBtn, isCompleted && s.taskCompletedBtn]}
              onPress={(e) => {
                e.stopPropagation();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                if (isCompleted) {
                  // Allow undoing completion
                  handleCompleteTask(item);
                } else if (isInProgress) {
                  handleCompleteTask(item);
                } else {
                  handleStartTask(item);
                }
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
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <FlatList
        data={filteredEvents}
        keyExtractor={(item, index) => (item.id ? `${item.id}-${index}` : `task-${index}`)}
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
        contentContainerStyle={s.listContent}
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

      {/* ── ZEN MODE PERMISSION MODAL ─────────────────────────────────────── */}
      {/* Shows ONCE when user starts their first Critical task.               */}
      {/* After user decides, their choice is saved and modal never shows again */}
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
      {/* ─────────────────────────────────────────────────────────────────── */}

      {/* ── HAMBURGER MENU MODAL (SIDE NAVBAR) ── */}
      <Modal visible={isMenuOpen} transparent animationType="none" onRequestClose={() => closeMenu()}>
        <Animated.View style={[s.menuOverlay, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeMenu()} />
        </Animated.View>
        <Animated.View style={[s.sideNavbar, { transform: [{ translateX: slideAnim }] }]}>
          <View style={s.sideNavHeader}>
             <View style={s.sideNavAvatar}>
                {hasValidPhoto ? (
                  <Image source={{ uri: user?.profilePhoto }} style={s.sideNavAvatarImg} />
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
          </ScrollView>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Category icon helper ────────────────────────────────────────────────────

function renderCatIcon(id: string, color: string) {
  const size = 13;
  const sw = 2.3;
  switch (id) {
    case 'all':         return <Grid3x3 color={color} size={size} strokeWidth={sw} />;
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

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    alignItems: 'flex-start',
    marginHorizontal: 16,
    gap: 12,
    marginBottom: 16,
    zIndex: 100,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: colors.text,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  filterBtnGrad: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
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

  // ── Status Pills ──
  statusScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  statusPill: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  statusPillActive: {},
  statusPillActiveInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: colors.secondaryLight,
    borderWidth: 1.5,
    borderColor: colors.secondary,
  },
  statusPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  statusPillText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },

  // ── Category Chips ──
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  catChip: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  catChipActive: {},
  catChipGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
  },
  catChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  catChipText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
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
