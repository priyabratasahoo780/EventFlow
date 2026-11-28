import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from '../services/haptics';
import {
  Clock,
  CheckCircle2,
  Pause,
  ChevronDown,
  Sparkles,
  ExternalLink,
  GraduationCap,
  Briefcase,
  User as UserIcon,
  CalendarClock,
  Users,
  Code,
  Activity,
  ShoppingBag,
  Hash,
  Flame,
} from 'lucide-react-native';
import { useEventStore } from '../store/useEventStore';
import { useThemeStore } from '../store/useThemeStore';
import { useResponsive } from '../constants/responsive';
import { Event } from '../models/Event';

function getCategoryIcon(category: string = '', size = 12, color = '#FFFFFF') {
  const sw = 2.2;
  const cat = category.toLowerCase();
  switch (cat) {
    case 'academic': return <GraduationCap color={color} size={size} strokeWidth={sw} />;
    case 'work': return <Briefcase color={color} size={size} strokeWidth={sw} />;
    case 'personal': return <UserIcon color={color} size={size} strokeWidth={sw} />;
    case 'appointment': return <CalendarClock color={color} size={size} strokeWidth={sw} />;
    case 'interview': return <Users color={color} size={size} strokeWidth={sw} />;
    case 'hackathon': return <Code color={color} size={size} strokeWidth={sw} />;
    case 'meeting': return <Users color={color} size={size} strokeWidth={sw} />;
    case 'health': return <Activity color={color} size={size} strokeWidth={sw} />;
    case 'shopping': return <ShoppingBag color={color} size={size} strokeWidth={sw} />;
    default: return <Hash color={color} size={size} strokeWidth={sw} />;
  }
}

export default function DynamicIslandTaskBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winWidth, isSmall, isTablet } = useResponsive();
  const { getColors } = useThemeStore();
  const colors = getColors();
  const { events, updateTaskStatus } = useEventStore();

  // Find the single active task currently in progress
  const activeTask = useMemo<Event | undefined>(() => {
    return events.find(
      (e) => (e.status === 'in_progress') && !e.completed
    );
  }, [events]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Reanimated shared values
  const expandProgress = useSharedValue(0);
  const pulseAnim = useSharedValue(1);
  const barHeight1 = useSharedValue(6);
  const barHeight2 = useSharedValue(13);
  const barHeight3 = useSharedValue(8);

  // Track elapsed time from startedAt timestamp
  useEffect(() => {
    if (!activeTask) {
      setElapsedSeconds(0);
      return;
    }

    const calculateElapsed = () => {
      const startMs = activeTask.startedAt
        ? new Date(activeTask.startedAt).getTime()
        : new Date(activeTask.createdAt || Date.now()).getTime();
      const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setElapsedSeconds(diffSec);
    };

    calculateElapsed();
    const timer = setInterval(calculateElapsed, 1000);
    return () => clearInterval(timer);
  }, [activeTask?.id, activeTask?.startedAt]);

  // Subtle pulsing dot animation
  useEffect(() => {
    if (!activeTask) return;
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Audio/activity rhythm bars
    barHeight1.value = withRepeat(
      withSequence(
        withTiming(14, { duration: 400 }),
        withTiming(5, { duration: 500 })
      ),
      -1,
      true
    );
    barHeight2.value = withRepeat(
      withSequence(
        withTiming(6, { duration: 350 }),
        withTiming(16, { duration: 450 })
      ),
      -1,
      true
    );
    barHeight3.value = withRepeat(
      withSequence(
        withTiming(15, { duration: 480 }),
        withTiming(4, { duration: 380 })
      ),
      -1,
      true
    );
  }, [activeTask, pulseAnim, barHeight1, barHeight2, barHeight3]);

  // Handle expand/collapse animation
  const toggleExpand = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const toValue = isExpanded ? 0 : 1;
    expandProgress.value = withSpring(toValue, {
      damping: 17,
      stiffness: 180,
      mass: 0.8,
    });
    setIsExpanded(!isExpanded);
  }, [isExpanded, expandProgress]);

  const handleCollapse = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    expandProgress.value = withSpring(0, {
      damping: 18,
      stiffness: 190,
    });
    setIsExpanded(false);
  }, [expandProgress]);

  // Actions
  const handlePause = useCallback(() => {
    if (!activeTask) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleCollapse();
    updateTaskStatus(activeTask.id || (activeTask as any)._id, 'pending');
  }, [activeTask, handleCollapse, updateTaskStatus]);

  const handleComplete = useCallback(() => {
    if (!activeTask) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleCollapse();
    updateTaskStatus(activeTask.id || (activeTask as any)._id, 'completed');
  }, [activeTask, handleCollapse, updateTaskStatus]);

  const handleOpenDetails = useCallback(() => {
    if (!activeTask) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleCollapse();
    router.push(`/event/${activeTask.id || (activeTask as any)._id}` as any);
  }, [activeTask, handleCollapse, router]);

  // Format digital stopwatch string
  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Animated styles for Dynamic Island container
  const collapsedW = isSmall ? 198 : 226;
  const expandedW = Math.min(winWidth - 28, isTablet ? 480 : winWidth - 28);
  const containerStyle = useAnimatedStyle(() => {
    const width = interpolate(
      expandProgress.value,
      [0, 1],
      [collapsedW, expandedW]
    );
    const height = interpolate(expandProgress.value, [0, 1], [44, 218]);
    const borderRadius = interpolate(expandProgress.value, [0, 1], [22, 26]);

    return {
      width,
      height,
      borderRadius,
    };
  });

  const compactContentStyle = useAnimatedStyle(() => {
    const opacity = interpolate(expandProgress.value, [0, 0.4], [1, 0]);
    return {
      opacity,
      display: expandProgress.value > 0.5 ? 'none' : 'flex',
    };
  });

  const expandedContentStyle = useAnimatedStyle(() => {
    const opacity = interpolate(expandProgress.value, [0.35, 1], [0, 1]);
    const translateY = interpolate(expandProgress.value, [0, 1], [-10, 0]);
    return {
      opacity,
      transform: [{ translateY }],
      display: expandProgress.value < 0.1 ? 'none' : 'flex',
    };
  });

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseAnim.value,
    transform: [{ scale: interpolate(pulseAnim.value, [0.35, 1], [0.85, 1.1]) }],
  }));

  const wave1Style = useAnimatedStyle(() => ({ height: barHeight1.value }));
  const wave2Style = useAnimatedStyle(() => ({ height: barHeight2.value }));
  const wave3Style = useAnimatedStyle(() => ({ height: barHeight3.value }));

  if (!activeTask) {
    return null;
  }

  const checklistTotal = activeTask.checklist?.length || 0;
  const checklistDone = activeTask.checklist?.filter((c) => c.completed).length || 0;

  return (
    <>
      {/* Dimmed backdrop when expanded */}
      {isExpanded && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleCollapse}
          pointerEvents="auto"
        >
          <Animated.View style={styles.backdrop} />
        </Pressable>
      )}

      {/* Floating Dynamic Island */}
      <View
        pointerEvents="box-none"
        style={[
          styles.outerWrapper,
          { top: insets.top + (Platform.OS === 'ios' ? 6 : 10) },
        ]}
      >
        <Animated.View style={[styles.islandContainer, containerStyle]}>
          <LinearGradient
            colors={['#11151F', '#0B0D14']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Compact Island State */}
          <Animated.View style={[styles.compactRow, compactContentStyle]}>
            <Pressable
              onPress={toggleExpand}
              style={styles.compactClickArea}
              hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
            >
              {/* Pulsing Live Dot + Category Icon */}
              <View style={styles.compactLeft}>
                <Animated.View style={[styles.liveDot, pulseStyle]} />
                <View style={styles.compactIconCircle}>
                  {getCategoryIcon(activeTask.category, 11, colors.secondary)}
                </View>
              </View>

              {/* Task Title + Live Ticking Stopwatch */}
              <View style={styles.compactCenter}>
                <Text numberOfLines={1} style={styles.compactTitle}>
                  {activeTask.title || 'Focus Task'}
                </Text>
                <View style={styles.compactTimerBox}>
                  <Text style={styles.compactTimerText}>{formatTime(elapsedSeconds)}</Text>
                </View>
              </View>

              {/* Live soundwave activity bars */}
              <View style={styles.compactRight}>
                <View style={styles.waveBarContainer}>
                  <Animated.View style={[styles.waveBar, wave1Style]} />
                  <Animated.View style={[styles.waveBar, wave2Style]} />
                  <Animated.View style={[styles.waveBar, wave3Style]} />
                </View>
              </View>
            </Pressable>
          </Animated.View>

          {/* Expanded Island State */}
          <Animated.View style={[styles.expandedCard, expandedContentStyle]}>
            {/* Header: Live Badge + Category + Minimize Chevron */}
            <View style={styles.expandedHeader}>
              <View style={styles.badgeRow}>
                <Animated.View style={[styles.liveDot, pulseStyle]} />
                <Text style={styles.liveActivityText}>LIVE FOCUS</Text>
                <View style={styles.categoryDashedBadge}>
                  {getCategoryIcon(activeTask.category, 10, colors.secondary)}
                  <Text style={styles.categoryDashedBadgeText}>
                    {activeTask.category || 'Task'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleCollapse}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.closeBtn}
              >
                <ChevronDown color="rgba(255,255,255,0.7)" size={18} strokeWidth={2.4} />
              </Pressable>
            </View>

            {/* Task Title & Time Tracker */}
            <View style={styles.expandedTitleRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text numberOfLines={1} style={styles.expandedTitle}>
                  {activeTask.title}
                </Text>
                {checklistTotal > 0 && (
                  <Text style={styles.checklistSummary}>
                    ✓ {checklistDone} of {checklistTotal} items completed
                  </Text>
                )}
              </View>

              {/* Digital Stopwatch Counter */}
              <View style={styles.digitalStopwatch}>
                <Clock color={colors.secondary} size={14} strokeWidth={2.2} />
                <Text style={styles.digitalStopwatchText}>
                  {formatTime(elapsedSeconds)}
                </Text>
              </View>
            </View>

            {/* Action Buttons Row */}
            <View style={styles.actionsRow}>
              {/* Pause Task */}
              <Pressable
                onPress={handlePause}
                style={({ pressed }) => [
                  styles.actionBtnSecondary,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
                ]}
              >
                <Pause color="#FFFFFF" size={14} strokeWidth={2.5} />
                <Text style={styles.actionBtnSecondaryText}>Pause</Text>
              </Pressable>

              {/* Complete Task (Primary Action) */}
              <Pressable
                onPress={handleComplete}
                style={({ pressed }) => [
                  styles.actionBtnPrimary,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.96 }] },
                ]}
              >
                <LinearGradient
                  colors={[colors.secondary, '#FF6500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionBtnGrad}
                >
                  <CheckCircle2 color="#FFFFFF" size={15} strokeWidth={2.6} />
                  <Text style={styles.actionBtnPrimaryText}>Complete</Text>
                </LinearGradient>
              </Pressable>

              {/* Open Details */}
              <Pressable
                onPress={handleOpenDetails}
                style={({ pressed }) => [
                  styles.actionBtnSecondary,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
                ]}
              >
                <ExternalLink color="#FFFFFF" size={14} strokeWidth={2.2} />
                <Text style={styles.actionBtnSecondaryText}>Details</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 9998,
  },
  islandContainer: {
    overflow: 'hidden',
    backgroundColor: '#0F131C',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
  },

  // ── Compact Pill ──
  compactRow: {
    flex: 1,
    paddingHorizontal: 12,
  },
  compactClickArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  compactIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 122, 0, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactCenter: {
    flex: 1,
    marginHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactTitle: {
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11.5,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  compactTimerBox: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  compactTimerText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10.5,
    color: '#FFA043',
    letterSpacing: 0.5,
  },
  compactRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waveBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 18,
    width: 14,
    justifyContent: 'center',
  },
  waveBar: {
    width: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#10B981',
  },

  // ── Expanded Card ──
  expandedCard: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  liveActivityText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    color: '#10B981',
    letterSpacing: 0.9,
  },
  categoryDashedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 122, 0, 0.14)',
    borderStyle: 'dashed',
    borderWidth: 1.2,
    borderColor: '#FF7A00',
  },
  categoryDashedBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    color: '#FF9533',
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  expandedTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  checklistSummary: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 2,
  },
  digitalStopwatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 122, 0, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.3)',
  },
  digitalStopwatchText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: '#FFA043',
    letterSpacing: 0.8,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  actionBtnSecondary: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtnSecondaryText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  actionBtnPrimary: {
    flex: 1.3,
    height: 38,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  actionBtnGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 12,
  },
  actionBtnPrimaryText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
