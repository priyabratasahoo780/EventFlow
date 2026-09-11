import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Image, AppState, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEventStore, parseDeadline } from '../store/useEventStore';
import { Event } from '../models/Event';
import { 
  ChevronLeft, Check, X, Clock, Flame, Calendar as CalendarIcon, 
  MapPin, CheckSquare, AlertTriangle, ArrowRight, RotateCcw,
  Sparkles, Tag, CheckCircle2, Zap
} from 'lucide-react-native';
import { useThemeStore } from '../store/useThemeStore';
import { ColorTheme } from '../constants/theme';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { reschedulingService, RescheduleSuggestion } from '../services/reschedulingService';

import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  interpolate, 
  runOnJS,
  Extrapolation,
  withTiming,
  withRepeat,
  withSequence,
  Easing
} from 'react-native-reanimated';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

const CATEGORY_COVERS: Record<string, string> = {
  work:     "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800&auto=format&fit=crop",
  academic: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=800&auto=format&fit=crop",
  study:    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=800&auto=format&fit=crop",
  health:   "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=800&auto=format&fit=crop",
  personal: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=800&auto=format&fit=crop",
  shopping: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=800&auto=format&fit=crop",
  meeting:  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800&auto=format&fit=crop",
  interview:"https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop",
  hackathon:"https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=800&auto=format&fit=crop",
  default:  "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?q=80&w=800&auto=format&fit=crop",
};

const TriageCard = ({ 
  event, 
  onSwipeRight, 
  onSwipeLeft, 
  colors,
  isBehind = false
}: { 
  event: Event; 
  onSwipeRight: () => void; 
  onSwipeLeft: () => void; 
  colors: ColorTheme;
  isBehind?: boolean;
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const panGestureEvent = (e: any) => {
    'worklet';
    if (isBehind) return;
    translateX.value = e.nativeEvent.translationX;
    translateY.value = e.nativeEvent.translationY * 0.4;
  };

  const panGestureEnd = (e: any) => {
    'worklet';
    if (isBehind) return;
    if (translateX.value > SWIPE_THRESHOLD) {
      translateX.value = withSpring(SCREEN_WIDTH * 1.5, { velocity: e.nativeEvent.velocityX }, () => {
        runOnJS(onSwipeRight)();
      });
    } else if (translateX.value < -SWIPE_THRESHOLD) {
      translateX.value = withSpring(-SCREEN_WIDTH * 1.5, { velocity: e.nativeEvent.velocityX }, () => {
        runOnJS(onSwipeLeft)();
      });
    } else {
      translateX.value = withSpring(0, { damping: 15 });
      translateY.value = withSpring(0, { damping: 15 });
    }
  };

  const cardStyle = useAnimatedStyle(() => {
    if (isBehind) {
      return {
        transform: [{ scale: 0.94 }, { translateY: 16 }],
        opacity: 0.7,
      };
    }

    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-12, 0, 12],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const doNowOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(translateX.value, [20, SWIPE_THRESHOLD], [0.8, 1], Extrapolation.CLAMP) }],
  }));

  const cancelOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-20, -SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(translateX.value, [-20, -SWIPE_THRESHOLD], [0.8, 1], Extrapolation.CLAMP) }],
  }));

  const cat = (event.category || '').toLowerCase();
  const coverUrl = event.image || CATEGORY_COVERS[cat] || CATEGORY_COVERS.default;

  // Edge Case Fix #1: Use UTC-aware parseDeadline + Edge Case Fix #7: isAllDay support
  const overdueText = useMemo(() => {
    if (!event.date) return 'Overdue';
    if (event.isAllDay) return 'All Day (Overdue)';
    const deadline = parseDeadline(event);
    if (!deadline) return 'Overdue';
    const diffMins = Math.round((Date.now() - deadline.getTime()) / 60000);
    if (diffMins <= 0) return 'Overdue just now';
    if (diffMins < 60) return `Overdue by ${diffMins}m`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `Overdue by ${diffHours}h`;
    return `Overdue by ${Math.round(diffHours / 24)}d`;
  }, [event.date, event.time, event.isAllDay]);

  const priorityColor = event.priority === 'critical' ? '#EF4444' 
    : event.priority === 'high' ? '#F97316'
    : event.priority === 'medium' ? '#EAB308'
    : '#10B981';

  return (
    <PanGestureHandler onGestureEvent={panGestureEvent} onEnded={panGestureEnd}>
      <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, cardStyle]}>
        
        {/* DO NOW STAMP */}
        <Animated.View style={[styles.stamp, styles.stampRight, doNowOpacity]}>
          <LinearGradient colors={['#10B981', '#059669']} style={styles.stampGrad}>
            <Check color="#FFF" size={20} strokeWidth={3} />
            <Text style={styles.stampText}>DO NOW</Text>
          </LinearGradient>
        </Animated.View>

        {/* CANCEL STAMP */}
        <Animated.View style={[styles.stamp, styles.stampLeft, cancelOpacity]}>
          <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.stampGrad}>
            <X color="#FFF" size={20} strokeWidth={3} />
            <Text style={styles.stampText}>DISMISS</Text>
          </LinearGradient>
        </Animated.View>

        {/* COVER HEADER WITH GRADIENT */}
        <View style={styles.coverWrapper}>
          <Image source={{ uri: coverUrl }} style={styles.coverImg} />
          <LinearGradient 
            colors={['rgba(0,0,0,0.2)', 'transparent', 'rgba(0,0,0,0.85)']} 
            style={styles.coverGradient}
          >
            {/* Top Badges */}
            <View style={styles.topBadgeRow}>
              <View style={[styles.priorityChip, { backgroundColor: priorityColor }]}>
                <Flame color="#FFF" size={12} strokeWidth={3} />
                <Text style={styles.priorityChipText}>{event.priority.toUpperCase()}</Text>
              </View>

              <View style={styles.overdueBadge}>
                <AlertTriangle color="#FFF" size={12} strokeWidth={2.5} />
                <Text style={styles.overdueText}>{overdueText}</Text>
              </View>
            </View>

            {/* Bottom Title on Image */}
            <View style={styles.titleArea}>
              <Text style={styles.cardCategory}>{event.category ? event.category.toUpperCase() : 'TASK'}</Text>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {event.title}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* CARD BODY */}
        <View style={styles.cardBody}>
          <View style={{ gap: 12 }}>
            {/* DESCRIPTION */}
            {event.description ? (
              <View style={[styles.descBox, { borderLeftColor: colors.secondary }]}>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                  {event.description}
                </Text>
              </View>
            ) : null}

            {/* AI CONTEXT & SMART RECOVERY BANNER */}
            <View style={[styles.smartContextBox, { backgroundColor: colors.secondary + '12' }]}>
              <View style={styles.smartContextTop}>
                <View style={[styles.sparkleIconWrap, { backgroundColor: colors.secondary + '20' }]}>
                  <Sparkles color={colors.secondary} size={14} strokeWidth={2.5} />
                </View>
                <Text style={[styles.smartContextTitle, { color: colors.text }]}>Smart Context & Urgency</Text>
                <View style={[styles.urgencyTag, { backgroundColor: priorityColor + '20' }]}>
                  <Text style={[styles.urgencyTagText, { color: priorityColor }]}>High Impact</Text>
                </View>
              </View>
              <Text style={[styles.smartContextDesc, { color: colors.textSecondary }]}>
                This task was set for {event.time || 'earlier today'}. Clearing or starting it now will recover your daily momentum and keep your streak active.
              </Text>
            </View>

            {/* META INFO ROW */}
            <View style={styles.metaRow}>
              {event.time ? (
                <View style={[styles.metaChip, { backgroundColor: colors.surface }]}>
                  <Clock color={colors.secondary} size={13} strokeWidth={2.5} />
                  <Text style={[styles.metaChipText, { color: colors.text }]}>{event.time}</Text>
                </View>
              ) : null}

              <View style={[styles.metaChip, { backgroundColor: colors.surface }]}>
                <CalendarIcon color={colors.textSecondary} size={13} strokeWidth={2.5} />
                <Text style={[styles.metaChipText, { color: colors.text }]}>
                  {event.date ? event.date.split('T')[0] : 'Today'}
                </Text>
              </View>

              <View style={[styles.metaChip, { backgroundColor: colors.surface }]}>
                <Zap color="#EAB308" size={13} strokeWidth={2.5} />
                <Text style={[styles.metaChipText, { color: colors.text }]}>
                  ~{event.estimatedDuration || 30}m
                </Text>
              </View>
              
              <View style={[styles.metaChip, { backgroundColor: colors.surface }]}>
                <Tag color={colors.primary} size={13} strokeWidth={2.5} />
                <Text style={[styles.metaChipText, { color: colors.text }]}>
                  {event.category || 'Work'}
                </Text>
              </View>
            </View>

            {/* LOCATION OR DESTINATION BADGE */}
            {event.location ? (
              <View style={[styles.locationRow, { backgroundColor: colors.surface }]}>
                <View style={styles.locIconWrap}>
                  <MapPin color={colors.primary} size={15} strokeWidth={2.5} />
                </View>
                <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
                  {event.location}
                </Text>
              </View>
            ) : null}

            {/* CHECKLIST PREVIEW */}
            {event.checklist && event.checklist.length > 0 ? (
              <View style={[styles.checklistPreview, { backgroundColor: colors.surface }]}>
                <View style={styles.checklistHead}>
                  <CheckSquare color={colors.secondary} size={14} strokeWidth={2.5} />
                  <Text style={[styles.checklistHeadText, { color: colors.text }]}>
                    Checklist ({event.checklist.length})
                  </Text>
                </View>
                <Text style={[styles.checklistPreviewText, { color: colors.textSecondary }]} numberOfLines={1}>
                  • {event.checklist[0].text}
                  {event.checklist.length > 1 ? ` (+${event.checklist.length - 1} more)` : ''}
                </Text>
              </View>
            ) : null}
          </View>

          {/* SWIPE HINT FOOTER */}
          <View style={styles.swipeHintBar}>
            <View style={styles.hintPill}>
              <X color={colors.error} size={16} strokeWidth={3} />
              <Text style={[styles.hintSide, { color: colors.error }]}>Dismiss</Text>
            </View>
            <View style={styles.hintDot} />
            <View style={styles.hintPill}>
              <Text style={[styles.hintSide, { color: colors.success }]}>Start Task</Text>
              <Check color={colors.success} size={16} strokeWidth={3} />
            </View>
          </View>
        </View>

      </Animated.View>
    </PanGestureHandler>
  );
};
const FloatingDoneIcon = ({ color }: { color: string }) => {
  const floatAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(1);

  useEffect(() => {
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    scaleAnim.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatAnim.value },
      { scale: scaleAnim.value }
    ]
  }));

  return (
    <Animated.View style={[styles.doneIconCircle, { backgroundColor: color + '18' }, animatedStyle]}>
      <CheckCircle2 color={color} size={68} strokeWidth={2.5} />
    </Animated.View>
  );
};

export default function TriageScreen() {
  const colors = useThemeStore(state => state.getColors());
  const router = useRouter();
  const { events, updateEvent } = useEventStore();
  
  const [overdueTasks, setOverdueTasks] = useState<Event[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Edge Case Fix #3: Undo state for accidental cancel
  const [undoVisible, setUndoVisible] = useState(false);
  const lastCancelledTask = useRef<Event | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiSlots, setAiSlots] = useState<RescheduleSuggestion[]>([]);
  const [aiModalTask, setAiModalTask] = useState<Event | null>(null);
  const [aiModalVisible, setAiModalVisible] = useState(false);


  // Compute overdue task list — extracted so it can be called from multiple effects
  const computeOverdue = useCallback(() => {
    const now = new Date();
    const tasks = events.filter(e => {
      if (e.status === 'overdue') return true;
      if (e.completed || e.status === 'completed' || e.status === 'late_completed' || e.status === 'in_progress') return false;
      if (!e.date) return false;
      // Edge Case Fix #7: All-day tasks are only overdue after the calendar day ends
      if (e.isAllDay) {
        const dateStr = e.date.split('T')[0];
        const endOfDay = new Date(`${dateStr}T23:59:59`);
        return endOfDay < now;
      }
      // Edge Case Fix #1: Use UTC-aware deadline parser
      const dl = parseDeadline(e);
      return dl ? dl < now : false;
    });
    setOverdueTasks(tasks);
  }, [events]);

  // Recompute overdue list when events change
  useEffect(() => {
    computeOverdue();
  }, [computeOverdue]);

  // Edge Case Fix #2: Recompute when app comes back to foreground (midnight crossing)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        computeOverdue();
      }
    });
    return () => sub.remove();
  }, [computeOverdue]);

  const handleSwipeRight = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const task = overdueTasks[currentIndex];
    if (task) {
      // AI Reschedule: show slot picker instead of just marking in_progress
      const suggestions = reschedulingService.generateAiSlots(events, task);
      if (suggestions.length > 0) {
        setAiSlots(suggestions);
        setAiModalTask(task);
        setAiModalVisible(true);
        return; // Wait for user choice in AI modal
      }
      // Fallback: mark in_progress directly
      await updateEvent({ 
        ...task, 
        status: 'in_progress', 
        startedAt: new Date().toISOString() 
      } as Event);
    }
    setCurrentIndex(prev => prev + 1);
  };

  const handleAiReschedule = async (suggestion: RescheduleSuggestion) => {
    const task = aiModalTask;
    setAiModalVisible(false);
    setAiModalTask(null);
    setAiSlots([]);
    if (!task) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateEvent({
      ...task,
      date: suggestion.slot.date + 'T00:00:00.000Z',
      time: suggestion.slot.time,
      status: 'pending',
      updatedAt: new Date().toISOString(),
    } as Event);
    setCurrentIndex(prev => prev + 1);
  };

  const handleAiModalDismiss = async () => {
    const task = aiModalTask;
    setAiModalVisible(false);
    setAiModalTask(null);
    setAiSlots([]);
    if (!task) return;
    // User dismissed AI modal: just mark in_progress
    await updateEvent({ 
      ...task, 
      status: 'in_progress', 
      startedAt: new Date().toISOString() 
    } as Event);
    setCurrentIndex(prev => prev + 1);
  };


  // Edge Case Fix #3: Cancel with 4-second Undo window
  const handleSwipeLeft = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const task = overdueTasks[currentIndex];
    if (task) {
      lastCancelledTask.current = task;
      await updateEvent({ 
        ...task, 
        status: 'cancelled',
        updatedAt: new Date().toISOString() 
      } as Event);
      // Show undo bar for 4 seconds
      setUndoVisible(true);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        setUndoVisible(false);
        lastCancelledTask.current = null;
      }, 4000);
    }
    setCurrentIndex(prev => prev + 1);
  };

  const handleUndo = async () => {
    const task = lastCancelledTask.current;
    if (!task) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateEvent({ ...task, status: 'pending', updatedAt: new Date().toISOString() } as Event);
    lastCancelledTask.current = null;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoVisible(false);
    // Go back one index to show the restored task
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentIndex(prev => prev + 1);
  };

  const isDone = currentIndex >= overdueTasks.length || overdueTasks.length === 0;
  const progress = overdueTasks.length > 0 ? Math.min(1, currentIndex / overdueTasks.length) : 1;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── AI RESCHEDULE MODAL ── */}
      <Modal
        visible={aiModalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleAiModalDismiss}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Text style={{ fontSize: 22 }}>🤖</Text>
              <Text style={{ fontFamily: 'Poppins_800ExtraBold', fontSize: 18, color: colors.text }}>AI Reschedule</Text>
            </View>
            <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 13, color: colors.textSecondary, marginBottom: 18 }}>
              Pick a free slot to move "{aiModalTask?.title}" to
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {aiSlots.map((s, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleAiReschedule(s)}
                  style={{
                    borderRadius: 16, padding: 16, marginBottom: 10,
                    borderWidth: 1.5,
                    borderColor: i === 0 ? colors.secondary + '60' : colors.border,
                    backgroundColor: i === 0 ? colors.secondary + '10' : colors.background,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      {i === 0 && <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 10, color: colors.secondary, backgroundColor: colors.secondary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>AI PICK</Text>}
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: colors.text }}>{s.slot.label}</Text>
                    </View>
                    <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: colors.textSecondary }}>{s.reason}</Text>
                  </View>
                  <View style={{
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
                    backgroundColor: s.slot.confidence === 'high' ? '#22C55E20' : s.slot.confidence === 'medium' ? '#F59E0B20' : '#EF444420',
                  }}>
                    <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 10, color: s.slot.confidence === 'high' ? '#22C55E' : s.slot.confidence === 'medium' ? '#F59E0B' : '#EF4444', textTransform: 'uppercase' }}>
                      {s.slot.confidence}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={handleAiModalDismiss}
              style={{ alignItems: 'center', marginTop: 10, padding: 14, borderRadius: 14, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: colors.textSecondary }}>Do it Now Instead</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {/* ─────────────────────────────────── */}

        {/* TOP BAR */}
        <View style={styles.header}>
          <Pressable 
            style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={() => router.back()}
          >
            <ChevronLeft color={colors.text} size={22} strokeWidth={2.5} />
          </Pressable>


          <View style={styles.headerTitleWrap}>
            <View style={styles.headerTitleRow}>
              <Sparkles color={colors.secondary} size={18} strokeWidth={2.5} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>Batch Triage</Text>
            </View>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              {overdueTasks.length > 0 
                ? `${Math.max(0, overdueTasks.length - currentIndex)} remaining`
                : 'Zero overdue'}
            </Text>
          </View>

          <View style={styles.placeholder} />
        </View>

        {/* PROGRESS BAR */}
        {overdueTasks.length > 0 && !isDone && (
          <View style={styles.progressBarWrapper}>
            <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    backgroundColor: colors.secondary,
                    width: `${Math.round(progress * 100)}%` 
                  }
                ]} 
              />
            </View>
          </View>
        )}

        {/* MAIN BODY / CARD STACK */}
        <View style={styles.content}>
          {isDone ? (
            <View style={styles.doneState}>
              <FloatingDoneIcon color={colors.success} />
              <Text style={[styles.doneTitle, { color: colors.text }]}>All Caught Up! 🎉</Text>
              <Text style={[styles.doneSub, { color: colors.textSecondary }]}>
                You triaged all overdue tasks. Your calendar and momentum are pristine.
              </Text>
              <Pressable
                style={[styles.doneBtn, { backgroundColor: colors.secondary }]}
                onPress={() => router.back()}
              >
                <Text style={styles.doneBtnText}>Back to Dashboard</Text>
                <ArrowRight color="#FFF" size={18} strokeWidth={2.5} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.cardStack}>
              {overdueTasks.map((task, index) => {
                if (index < currentIndex) return null;
                if (index > currentIndex + 1) return null;

                const isTop = index === currentIndex;
                
                return (
                  <View 
                    key={task.id || task._id || String(index)} 
                    style={[styles.cardWrapper, { zIndex: overdueTasks.length - index }]}
                  >
                    <TriageCard
                      event={task}
                      onSwipeRight={handleSwipeRight}
                      onSwipeLeft={handleSwipeLeft}
                      colors={colors}
                      isBehind={!isTop}
                    />
                  </View>
                );
              })}
            </View>
          )}

          {/* BOTTOM CONTROLS */}
          {!isDone && (
            <View style={styles.controls}>
              {/* DISMISS / CANCEL BUTTON */}
              <Pressable 
                style={({ pressed }) => [
                  styles.actionBtn, 
                  styles.cancelBtn,
                  { opacity: pressed ? 0.8 : 1 }
                ]} 
                onPress={handleSwipeLeft}
              >
                <X color="#EF4444" size={26} strokeWidth={3} />
              </Pressable>
              
              {/* SKIP BUTTON */}
              <Pressable 
                style={({ pressed }) => [
                  styles.skipBtn, 
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }
                ]} 
                onPress={handleSkip}
              >
                <RotateCcw color={colors.textSecondary} size={15} strokeWidth={2.5} />
                <Text style={[styles.skipText, { color: colors.text }]}>Skip for now</Text>
              </Pressable>

              {/* DO NOW / START BUTTON */}
              <Pressable 
                style={({ pressed }) => [
                  styles.actionBtn, 
                  styles.startBtn,
                  { opacity: pressed ? 0.8 : 1 }
                ]} 
                onPress={handleSwipeRight}
              >
                <Check color="#10B981" size={28} strokeWidth={3.5} />
              </Pressable>
            </View>
          )}

          {/* Edge Case Fix #3: Undo Snackbar */}
          {undoVisible && (
            <View style={[styles.undoBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.undoText, { color: colors.text }]}>Task dismissed</Text>
              <Pressable style={[styles.undoBtn, { backgroundColor: colors.secondary }]} onPress={handleUndo}>
                <Text style={styles.undoBtnText}>Undo</Text>
              </Pressable>
            </View>
          )}
        </View>

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.9, 390);
const CARD_HEIGHT = Math.min(SCREEN_HEIGHT * 0.65, 540);

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backBtn: { 
    width: 42, 
    height: 42, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: { 
    fontFamily: 'Poppins_700Bold', 
    fontSize: 18 
  },
  headerSub: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  placeholder: { width: 42 },

  progressBarWrapper: {
    paddingHorizontal: 24,
    marginBottom: 6,
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
  },
  cardStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },

  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
  },

  coverWrapper: {
    width: '100%',
    height: '42%',
    position: 'relative',
    backgroundColor: '#000',
  },
  coverImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverGradient: {
    ...StyleSheet.absoluteFill,
    padding: 16,
    justifyContent: 'space-between',
  },
  topBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  priorityChipText: {
    color: '#FFF',
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  overdueText: {
    color: '#FFF',
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
  },

  titleArea: {
    gap: 2,
  },
  cardCategory: {
    color: '#FFB266',
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  cardTitle: {
    color: '#FFF',
    fontFamily: 'Poppins_700Bold',
    fontSize: 22,
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  cardBody: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  descBox: {
    paddingLeft: 12,
    borderLeftWidth: 3,
  },
  cardDesc: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
  },

  smartContextBox: {
    padding: 14,
    borderRadius: 16,
    gap: 8,
  },
  smartContextTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sparkleIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartContextTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    flex: 1,
  },
  urgencyTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgencyTagText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
  },
  smartContextDesc: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
  },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  metaChipText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11.5,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
  },
  locIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(75, 63, 220, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    flex: 1,
  },

  checklistPreview: {
    padding: 12,
    borderRadius: 12,
    gap: 4,
  },
  checklistHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checklistHeadText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
  },
  checklistPreviewText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
  },

  swipeHintBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 8,
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  hintSide: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  hintDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingBottom: 24,
    paddingTop: 8,
  },
  actionBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  cancelBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
  },
  startBtn: {
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: '#86EFAC',
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  skipText: { 
    fontFamily: 'Poppins_600SemiBold', 
    fontSize: 13 
  },

  stamp: {
    position: 'absolute',
    top: 50,
    zIndex: 999,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 12,
  },
  stampGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  stampRight: {
    left: 20,
    transform: [{ rotate: '-14deg' }],
  },
  stampLeft: {
    right: 20,
    transform: [{ rotate: '14deg' }],
  },
  stampText: {
    color: '#FFF',
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 18,
    letterSpacing: 1,
  },

  doneState: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 36,
  },
  doneIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  doneTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 26,
    marginBottom: 10,
    textAlign: 'center',
  },
  doneSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 32,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  doneBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: '#FFF',
  },

  // Edge Case Fix #3: Undo Snackbar
  undoBar: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  undoText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  undoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  undoBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
});
