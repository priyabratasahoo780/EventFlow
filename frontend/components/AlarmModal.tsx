import { useThemeStore } from '../store/useThemeStore';
import { ColorTheme } from '../constants/theme';
import React, { useEffect } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { Clock, Zap, CheckCircle2, Volume2, XCircle } from 'lucide-react-native';
import { Event } from '../models/Event';
import { alarmSoundService } from '../services/alarmSoundService';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  event: Event | null;
  onDismiss: () => void;
  onStartTask: (event: Event) => void;
}

export default function AlarmModal({ visible, event, onDismiss, onStartTask }: Props) {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);

  const isCompleted = !event || event.completed || event.status === 'completed';

  useEffect(() => {
    if (visible && event && !isCompleted) {
      alarmSoundService.playAlarmSound();
    } else {
      alarmSoundService.stopAlarmSound();
    }

    return () => {
      alarmSoundService.stopAlarmSound();
    };
  }, [visible, event, isCompleted]);

  if (isCompleted) {
    alarmSoundService.stopAlarmSound();
    return null;
  }

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    alarmSoundService.stopAlarmSound();
    onDismiss();
  };

  const handleStart = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    alarmSoundService.stopAlarmSound();
    onStartTask(event);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.alarmBadge}>
              <Volume2 color={colors.error} size={18} strokeWidth={2.5} />
              <Text style={styles.alarmBadgeText}>LOUD ALARM RINGING</Text>
            </View>
          </View>

          <Text style={styles.title}>{event.title}</Text>
          
          {/* Smart Contextual Prompt */}
          <View style={styles.contextBox}>
            <Text style={styles.contextHeader}>⚠️ DUE DEADLINE ALERT</Text>
            <Text style={styles.contextText}>
              {event.status === 'in_progress'
                ? `You're currently working on this task. Target finish in ~${event.estimatedDuration || 30} minutes.`
                : `You haven't started this task yet.\nYou need approximately ${event.estimatedDuration || 30} minutes to complete it. Start now?`}
            </Text>
          </View>

          {event.description ? <Text style={styles.description} numberOfLines={2}>{event.description}</Text> : null}

          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Clock color={colors.text} size={14} strokeWidth={2.5} />
              <Text style={styles.metaText}>Due: {event.time}</Text>
            </View>

            <View style={[styles.metaBadge, { backgroundColor: '#EEEDFB', borderColor: '#EEEDFB' }]}>
              <Zap color={colors.primary} size={14} strokeWidth={2.5} />
              <Text style={[styles.metaText, { color: colors.primary }]}>Est: {event.estimatedDuration || 30}m</Text>
            </View>

            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{event.category.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.btnColumn}>
            <Pressable style={styles.startBtn} onPress={handleStart}>
              <CheckCircle2 color={colors.card} size={22} strokeWidth={2.5} />
              <Text style={styles.startBtnText}>START TASK NOW</Text>
            </Pressable>

            <Pressable style={styles.stopBtn} onPress={handleDismiss}>
              <XCircle color={colors.text} size={22} strokeWidth={2.5} />
              <Text style={styles.stopBtnText}>STOP ALARM</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(24,34,53,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 32,
    padding: 24,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  alarmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  alarmBadgeText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 13,
    color: colors.error,
    letterSpacing: 1,
  },
  title: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    color: colors.text,
  },
  categoryBadge: {
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  categoryText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 12,
    color: colors.secondary,
  },
  btnColumn: {
    gap: 12,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.success,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  startBtnText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 15,
    color: colors.card,
    letterSpacing: 0.5,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    borderRadius: 16,
  },
  contextBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  contextHeader: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 13,
    color: '#D97706',
    marginBottom: 6,
  },
  contextText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
  },
  stopBtnText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 15,
    color: colors.text,
    letterSpacing: 0.5,
  },
});
