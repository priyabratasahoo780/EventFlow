

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  Clock,
  Zap,
  Play,
  X,
  Volume2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react-native';
import { Event } from '../models/Event';
import { alarmSoundService } from '../services/alarmSoundService';
import { alarmService } from '../services/alarmService';
import { useThemeStore } from '../store/useThemeStore';
import { useResponsive } from '../constants/responsive';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  event: Event | null;
  onDismiss: () => void;
  onStartTask: (event: Event) => void;
  onSnooze?: (event: Event) => void;
}

export default function AlarmModal({
  visible,
  event,
  onDismiss,
  onStartTask,
  onSnooze,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useResponsive();
  const isShortScreen = screenHeight < 720;
  const topPadding = Math.max(
    insets.top + (Platform.OS === 'ios' ? 12 : 16),
    Platform.OS === 'ios' ? 56 : 48
  );
  const bottomPadding = Math.max(
    insets.bottom + (Platform.OS === 'android' ? 32 : 20),
    Platform.OS === 'android' ? 88 : 52
  );

  const { isDark } = useThemeStore();
  const isDarkMode = isDark();

  const isCompleted = !event || event.completed || event.status === 'completed';

  // ── Live Digital Clock 
  const [currentTime, setCurrentTime] = useState({
    timeStr: '',
    period: '',
    colonVisible: true,
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const mins = now.getMinutes().toString().padStart(2, '0');
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      setCurrentTime((prev) => ({
        timeStr: `${hours}:${mins}`,
        period,
        colonVisible: !prev.colonVisible,
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  //  Animated Values 
  const ring1Scale = useSharedValue(0.7);
  const ring1Opacity = useSharedValue(0.8);
  const ring2Scale = useSharedValue(0.7);
  const ring2Opacity = useSharedValue(0.8);
  const ring3Scale = useSharedValue(0.7);
  const ring3Opacity = useSharedValue(0.8);

  const bellRotation = useSharedValue(0);
  const bellScale = useSharedValue(1);

  const cardTranslateY = useSharedValue(40);
  const cardOpacity = useSharedValue(0);

  const orbPulse = useSharedValue(0.4);

  // ── Sound & Animation Triggers 
  useEffect(() => {
    if (visible && event && !isCompleted) {
      // Start loud alarm sound + haptics
      alarmSoundService.playAlarmSound();

      // Card entrance
      cardOpacity.value = withTiming(1, { duration: 400 });
      cardTranslateY.value = withSpring(0, { damping: 12, stiffness: 90 });

      // Ambient orb pulse
      orbPulse.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.35, { duration: 1800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );

      // Radar Ring 1
      ring1Scale.value = withRepeat(
        withTiming(1.6, { duration: 2200, easing: Easing.out(Easing.cubic) }),
        -1,
        false
      );
      ring1Opacity.value = withRepeat(
        withTiming(0, { duration: 2200, easing: Easing.out(Easing.cubic) }),
        -1,
        false
      );

      // Radar Ring 2 (staggered)
      ring2Scale.value = withDelay(
        700,
        withRepeat(
          withTiming(1.6, { duration: 2200, easing: Easing.out(Easing.cubic) }),
          -1,
          false
        )
      );
      ring2Opacity.value = withDelay(
        700,
        withRepeat(
          withTiming(0, { duration: 2200, easing: Easing.out(Easing.cubic) }),
          -1,
          false
        )
      );

      // Radar Ring 3 (staggered)
      ring3Scale.value = withDelay(
        1400,
        withRepeat(
          withTiming(1.6, { duration: 2200, easing: Easing.out(Easing.cubic) }),
          -1,
          false
        )
      );
      ring3Opacity.value = withDelay(
        1400,
        withRepeat(
          withTiming(0, { duration: 2200, easing: Easing.out(Easing.cubic) }),
          -1,
          false
        )
      );

      // Physical ringing bell vibration (high-energy pendulum swing)
      bellRotation.value = withRepeat(
        withSequence(
          withTiming(-28, { duration: 85, easing: Easing.inOut(Easing.ease) }),
          withTiming(28, { duration: 85, easing: Easing.inOut(Easing.ease) }),
          withTiming(-22, { duration: 75, easing: Easing.inOut(Easing.ease) }),
          withTiming(22, { duration: 75, easing: Easing.inOut(Easing.ease) }),
          withTiming(-14, { duration: 65, easing: Easing.inOut(Easing.ease) }),
          withTiming(14, { duration: 65, easing: Easing.inOut(Easing.ease) }),
          withTiming(-6, { duration: 55, easing: Easing.inOut(Easing.ease) }),
          withTiming(6, { duration: 55, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 50, easing: Easing.linear }),
          withDelay(200, withTiming(0, { duration: 10 }))
        ),
        -1,
        false
      );

      bellScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 240, easing: Easing.out(Easing.back(1.5)) }),
          withTiming(1.0, { duration: 240, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.1, { duration: 180, easing: Easing.out(Easing.quad) }),
          withTiming(1.0, { duration: 180, easing: Easing.inOut(Easing.ease) }),
          withDelay(200, withTiming(1.0, { duration: 10 }))
        ),
        -1,
        false
      );
    } else {
      alarmSoundService.stopAlarmSound();
    }

    return () => {
      alarmSoundService.stopAlarmSound();
    };
  }, [visible, event, isCompleted]);

  // Reanimated Styles 
  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const bellAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: bellScale.value },
      { rotate: `${bellRotation.value}deg` },
    ],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: ring1Opacity.value,
    transform: [{ scale: ring1Scale.value }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: ring2Opacity.value,
    transform: [{ scale: ring2Scale.value }],
  }));

  const ring3Style = useAnimatedStyle(() => ({
    opacity: ring3Opacity.value,
    transform: [{ scale: ring3Scale.value }],
  }));

  const orbAnimStyle = useAnimatedStyle(() => ({
    opacity: orbPulse.value,
  }));

  //  Action Handlers 
  const handleDismiss = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (_) {}
    alarmSoundService.stopAlarmSound();
    onDismiss();
  };

  const handleStart = () => {
    if (!event) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (_) {}
    alarmSoundService.stopAlarmSound();
    onStartTask(event);
  };

  const handleSnooze = () => {
    if (!event) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (_) {}
    alarmSoundService.stopAlarmSound();

    if (onSnooze) {
      onSnooze(event);
    } else {
      // Schedule quick 5-minute snooze
      const snoozeMs = Date.now() + 5 * 60 * 1000;
      alarmService.scheduleAlarm(
        `snooze_${event.id}_${Date.now()}`,
        snoozeMs,
        `⏰ Snoozed: ${event.title}`,
        `Your 5-minute snooze has ended. Time to start!`,
        event.id,
        true
      ).catch(() => {});
      onDismiss();
    }
  };

  if (isCompleted || !visible || !event) {
    return null;
  }

  const BELL_ARENA = isShortScreen ? 115 : 135;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <StatusBar style="light" />

      <View style={styles.root}>
        {/*  1. Cosmic Aurora & Alert Gradient  */}
        <LinearGradient
          colors={['#070714', '#150A22', '#220814', '#070714']}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/*  2. Ambient Alert Glow Orbs  */}
        <Animated.View style={[StyleSheet.absoluteFill, orbAnimStyle]} pointerEvents="none">
          <View style={styles.glowOrbTop} />
          <View style={styles.glowOrbBottom} />
        </Animated.View>

        {/*  3. Content Stage  */}
        <ScrollView
          style={StyleSheet.absoluteFill}
          contentContainerStyle={[
            styles.stage,
            {
              paddingTop: topPadding,
              paddingBottom: bottomPadding,
              minHeight: '100%',
            },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >

          {/* Alert Header Pill */}
          <View style={styles.alertPillContainer}>
            <LinearGradient
              colors={['rgba(255, 68, 68, 0.25)', 'rgba(255, 122, 0, 0.15)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.alertPill}
            >
              <View style={styles.alertPillDot} />
              <Volume2 color="#FF4D4D" size={14} strokeWidth={2.6} />
              <Text style={styles.alertPillText}>LOUD ALARM ACTIVE</Text>
            </LinearGradient>
          </View>

          {/* Digital Clock Display */}
          <View style={styles.clockRow}>
            <Text style={styles.clockNumbers}>
              {currentTime.timeStr.split(':')[0]}
              <Text style={{ opacity: currentTime.colonVisible ? 1 : 0.3 }}>:</Text>
              {currentTime.timeStr.split(':')[1]}
            </Text>
            <Text style={styles.clockPeriod}>{currentTime.period}</Text>
          </View>

          {/*  Ringing Bell Hero with Expanding Shockwaves  */}
          <View style={[styles.bellArena, { width: BELL_ARENA, height: BELL_ARENA }]}>
            {/* Concentric Radar Rings */}
            <Animated.View style={[styles.shockwaveRing, ring1Style]} />
            <Animated.View style={[styles.shockwaveRing, ring2Style]} />
            <Animated.View style={[styles.shockwaveRing, ring3Style]} />

            {/* Glowing Bell Emblem */}
            <View style={styles.bellCardWrapper}>
              <LinearGradient
                colors={['#FF7A00', '#FF3B30']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bellCard}
              >
                <Animated.View style={bellAnimStyle}>
                  <Bell color="#FFFFFF" size={44} strokeWidth={2.4} />
                </Animated.View>
              </LinearGradient>
            </View>
          </View>

          {/*  Task Details Glassmorphic Card  */}
          <Animated.View style={[styles.eventCard, cardAnimStyle]}>
            {/* Top Tag Row */}
            <View style={styles.cardHeaderRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>
                  {event.category ? event.category.toUpperCase() : 'GENERAL TASK'}
                </Text>
              </View>

              <View style={styles.dueBadge}>
                <Clock size={12} color="#CBD5E1" strokeWidth={2.4} />
                <Text style={styles.dueBadgeText}>DUE: {event.time || 'NOW'}</Text>
              </View>
            </View>

            {/* Task Title */}
            <Text style={styles.taskTitle} numberOfLines={2}>
              {event.title}
            </Text>

            {/* Context Prompt Box */}
            <View style={styles.contextBox}>
              <View style={styles.contextHeaderRow}>
                <AlertTriangle size={14} color="#FF9500" strokeWidth={2.6} />
                <Text style={styles.contextHeaderText}>TARGET TIME REACHED</Text>
              </View>
              <Text style={styles.contextBody}>
                {event.status === 'in_progress'
                  ? `You are currently focusing on this task. Wrap up in ~${event.estimatedDuration || 30}m.`
                  : `Requires ~${event.estimatedDuration || 30} minutes of focus. Start immediately to stay 100% on schedule.`}
              </Text>
            </View>

            {/* Duration Pill */}
            <View style={styles.durationRow}>
              <Zap size={14} color="#FF7A00" strokeWidth={2.5} />
              <Text style={styles.durationText}>
                Estimated focus: {event.estimatedDuration || 30} mins
              </Text>
            </View>
          </Animated.View>

          {/*  Action Buttons  */}
          <View style={styles.actionsContainer}>
            {/* Primary Action: START TASK NOW */}
            <Pressable
              onPress={handleStart}
              style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            >
              <LinearGradient
                colors={['#FF7A00', '#FF4500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startBtnGradient}
              >
                <Play color="#FFFFFF" size={20} fill="#FFFFFF" />
                <Text style={styles.startBtnText}>START TASK NOW</Text>
              </LinearGradient>
            </Pressable>

            {/* Secondary Action Row: Snooze & Dismiss */}
            <View style={styles.secondaryRow}>
              {/* Snooze 5 Min */}
              <Pressable
                onPress={handleSnooze}
                style={({ pressed }) => [styles.snoozeBtn, pressed && { opacity: 0.8 }]}
              >
                <RotateCcw size={16} color="#CBD5E1" strokeWidth={2.4} />
                <Text style={styles.snoozeBtnText}>SNOOZE 5M</Text>
              </Pressable>

              {/* Stop / Dismiss */}
              <Pressable
                onPress={handleDismiss}
                style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.8 }]}
              >
                <X size={16} color="#FF5252" strokeWidth={2.6} />
                <Text style={styles.dismissBtnText}>STOP ALARM</Text>
              </Pressable>
            </View>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}

//  Stylesheet 
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#070714',
  },

  // Ambient Glow Orbs
  glowOrbTop: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#FF3B30',
    opacity: 0.18,
  },
  glowOrbBottom: {
    position: 'absolute',
    bottom: -90,
    left: -50,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: '#FF7A00',
    opacity: 0.14,
  },

  // Content Stage
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },

  // Alert Pill Header
  alertPillContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 77, 0.4)',
  },
  alertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  alertPillDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF4D4D',
  },
  alertPillText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: '#FF4D4D',
    letterSpacing: 1.5,
  },

  // Digital Clock
  clockRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 6,
  },
  clockNumbers: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 48,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  clockPeriod: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#94A3B8',
  },

  // Ringing Bell Arena
  bellArena: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  shockwaveRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255, 122, 0, 0.65)',
  },
  bellCardWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 20,
  },
  bellCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Event Details Glassmorphic Card
  eventCard: {
    width: '100%',
    backgroundColor: 'rgba(26, 26, 46, 0.85)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 122, 0, 0.28)',
    padding: 16,
    gap: 9,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 122, 0, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    color: '#FF9500',
    letterSpacing: 1.2,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 12,
  },
  dueBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10.5,
    color: '#CBD5E1',
    letterSpacing: 0.8,
  },
  taskTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 22,
    lineHeight: 28,
    color: '#FFFFFF',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  contextBox: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.22)',
    gap: 4,
  },
  contextHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contextHeaderText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    color: '#FF9500',
    letterSpacing: 1.2,
  },
  contextBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#E2E8F0',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  durationText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#94A3B8',
  },

  // Action Buttons Stack
  actionsContainer: {
    width: '100%',
    gap: 12,
    marginTop: 6,
    paddingBottom: Platform.OS === 'android' ? 14 : 4,
  },
  startBtn: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  startBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
  },
  startBtnText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  snoozeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingVertical: 12,
    borderRadius: 16,
  },
  snoozeBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: '#CBD5E1',
    letterSpacing: 0.8,
  },
  dismissBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    paddingVertical: 12,
    borderRadius: 16,
  },
  dismissBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: '#FF5252',
    letterSpacing: 0.8,
  },
});
