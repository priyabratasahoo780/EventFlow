import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, Pressable, Animated, Easing,
} from 'react-native';
import { MapPin, Navigation, CheckCircle2, X, Clock, Zap } from 'lucide-react-native';
import { Event } from '../../types/event.types';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  event: Event | null;
  triggerType?: 'arrive' | 'leave';
  onDismiss: () => void;
  onStartTask: (event: Event) => void;
}

export default function LocationArrivalModal({
  visible, event, triggerType = 'arrive', onDismiss, onStartTask,
}: Props) {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);

  // Pulse animation for the pin icon
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(80)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && event) {
      // Entrance animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulse the pin
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      slideAnim.setValue(80);
      fadeAnim.setValue(0);
    }
  }, [visible, event]);

  if (!event) return null;

  const isArrive = triggerType === 'arrive';
  const accentColor = isArrive ? '#15803D' : '#D97706';
  const bgColor = isArrive ? '#F0FDF4' : '#FFFBEB';
  const borderColor = isArrive ? '#BBF7D0' : '#FDE68A';

  const handleStart = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onStartTask(event);
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Top pill badge */}
          <View style={[styles.topBadge, { backgroundColor: bgColor, borderColor }]}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              {isArrive
                ? <MapPin color={accentColor} size={16} strokeWidth={2.5} />
                : <Navigation color={accentColor} size={16} strokeWidth={2.5} />}
            </Animated.View>
            <Text style={[styles.topBadgeText, { color: accentColor }]}>
              {isArrive ? '📍 ARRIVED AT LOCATION' : '🚶 LEAVING LOCATION'}
            </Text>
          </View>

          {/* Icon circle */}
          <View style={styles.iconCircleOuter}>
            <View style={[styles.iconCircleMid, { backgroundColor: `${accentColor}15` }]}>
              <View style={[styles.iconCircleInner, { backgroundColor: `${accentColor}25` }]}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  {isArrive
                    ? <MapPin color={accentColor} size={30} strokeWidth={2.2} />
                    : <Navigation color={accentColor} size={30} strokeWidth={2.2} />}
                </Animated.View>
              </View>
            </View>
          </View>

          {/* Task title */}
          <Text style={styles.title} numberOfLines={2}>{event.title}</Text>

          {/* Location info */}
          <View style={[styles.locationBox, { backgroundColor: bgColor, borderColor }]}>
            <MapPin color={accentColor} size={13} strokeWidth={2.5} />
            <Text style={[styles.locationText, { color: accentColor }]} numberOfLines={1}>
              {event.location || 'Your Destination'}
            </Text>
            {event.geofenceRadius ? (
              <Text style={[styles.radiusBadge, { color: accentColor }]}>
                within {event.geofenceRadius}m
              </Text>
            ) : null}
          </View>

          {/* Context message */}
          <Text style={styles.contextMsg}>
            {isArrive
              ? `You've arrived near ${event.location || 'your destination'}. This task is linked to this location — ready to start?`
              : `You're leaving ${event.location || 'your destination'}. Don't forget to complete your task!`}
          </Text>

          {/* Meta row */}
          <View style={styles.metaRow}>
            {event.time ? (
              <View style={styles.metaChip}>
                <Clock color={colors.textSecondary} size={12} strokeWidth={2} />
                <Text style={styles.metaChipText}>Due {event.time}</Text>
              </View>
            ) : null}
            <View style={styles.metaChip}>
              <Zap color={colors.textSecondary} size={12} strokeWidth={2} />
              <Text style={styles.metaChipText}>~{event.estimatedDuration || 30}m</Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: colors.secondaryLight }]}>
              <Text style={[styles.metaChipText, { color: colors.secondary, fontFamily: 'Poppins_700Bold' }]}>
                {(event.priority || 'medium').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.btnCol}>
            <Pressable
              style={({ pressed }) => [
                styles.startBtn,
                { backgroundColor: accentColor, opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={handleStart}
            >
              <CheckCircle2 color="#FFF" size={20} strokeWidth={2.5} />
              <Text style={styles.startBtnText}>START TASK NOW</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.dismissBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={handleDismiss}
            >
              <X color={colors.textSecondary} size={18} strokeWidth={2.5} />
              <Text style={styles.dismissBtnText}>Dismiss Reminder</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,20,40,0.55)',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  card: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 28,
    paddingBottom: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 24,
  },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 24,
  },
  topBadgeText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  iconCircleOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconCircleMid: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 30,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 16,
    maxWidth: '100%',
  },
  locationText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    flex: 1,
  },
  radiusBadge: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
  },
  contextMsg: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 24,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaChipText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  btnCol: {
    width: '100%',
    gap: 12,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  startBtnText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 15,
    color: '#FFF',
    letterSpacing: 0.8,
  },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  dismissBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
  },
});
