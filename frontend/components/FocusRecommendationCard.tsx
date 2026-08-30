import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Event } from '../models/Event';
import { priorityService } from '../services/priorityService';
import {
  Clock, MapPin, Play, CheckCircle2, Sparkles,
  Timer, ArrowRight, Target,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  task: Event | null;
  onStartTask: (task: Event) => void;
  onCompleteTask?: (task: Event) => void;
  onCreateTask?: () => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

export default function FocusRecommendationCard({
  task,
  onStartTask,
  onCompleteTask,
  onCreateTask,
  userLocation,
}: Props) {
  // Empty state
  if (!task) {
    return (
      <View style={styles.cardEmpty}>
        <View style={styles.emptyIconCircle}>
          <Sparkles color="#4B3FDC" size={20} strokeWidth={2.4} />
        </View>
        <View style={styles.emptyText}>
          <Text style={styles.emptyTitle}>All Caught Up! 🎉</Text>
          <Text style={styles.emptySub}>No pending high-priority tasks right now.</Text>
        </View>
        {onCreateTask && (
          <Pressable
            style={styles.emptyAddBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onCreateTask();
            }}
          >
            <Text style={styles.emptyAddBtnText}>+ Add Task</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const score = priorityService.calculateScore(task, userLocation);
  const prioInfo = priorityService.getPriorityInfo(score);

  // Time left
  const dateStr = task.date ? task.date.split('T')[0] : new Date().toISOString().split('T')[0];
  const timeStr = task.time || '23:59';
  const deadline = new Date(`${dateStr}T${timeStr.length <= 5 ? timeStr + ':00' : timeStr}`);
  const diffMinutes = Math.round((deadline.getTime() - Date.now()) / (1000 * 60));

  let timeFormatted = '';
  let isOverdue = false;
  if (diffMinutes < 0) {
    isOverdue = true;
    timeFormatted = `Overdue by ${Math.abs(Math.round(diffMinutes / 60))}h`;
  } else if (diffMinutes < 60) {
    timeFormatted = `Due in ${diffMinutes}m`;
  } else if (diffMinutes < 1440) {
    timeFormatted = `Due in ${Math.round(diffMinutes / 60)}h`;
  } else {
    timeFormatted = `Due in ${Math.round(diffMinutes / 1440)}d`;
  }

  const isInProgress = task.status === 'in_progress';
  const durationMins = task.estimatedDuration || 30;

  return (
    <View style={styles.card}>
      {/* AI Badge Header */}
      <View style={styles.headerRow}>
        <View style={styles.aiBadge}>
          <Target color="#4B3FDC" size={12} strokeWidth={2.8} />
          <Text style={styles.aiBadgeText}>AI TOP FOCUS</Text>
        </View>

        <View style={[styles.priorityPill, { backgroundColor: prioInfo.color + '18', borderColor: prioInfo.color + '60' }]}>
          <View style={[styles.prioDot, { backgroundColor: prioInfo.color }]} />
          <Text style={[styles.priorityPillText, { color: prioInfo.color }]}>
            {task.priority.toUpperCase()} · {score} PTS
          </Text>
        </View>
      </View>

      {/* Title & Description */}
      <Text style={styles.title} numberOfLines={1}>{task.title}</Text>
      {task.description ? (
        <Text style={styles.description} numberOfLines={2}>{task.description}</Text>
      ) : null}

      {/* Meta Pills */}
      <View style={styles.metaRow}>
        <View style={[styles.metaPill, isOverdue && styles.metaPillOverdue]}>
          <Clock color={isOverdue ? '#EF4444' : '#4B3FDC'} size={12} strokeWidth={2.3} />
          <Text style={[styles.metaPillText, isOverdue && styles.metaPillTextOverdue]}>
            {timeFormatted}
          </Text>
        </View>

        <View style={styles.metaPill}>
          <Timer color="#FF7A00" size={12} strokeWidth={2.3} />
          <Text style={styles.metaPillText}>{durationMins}m est</Text>
        </View>

        <View style={styles.categoryPill}>
          <Text style={styles.categoryPillText}>{task.category}</Text>
        </View>

        {task.location ? (
          <View style={styles.locationPill}>
            <MapPin color="#667085" size={11} />
            <Text style={styles.locationText} numberOfLines={1}>{task.location}</Text>
          </View>
        ) : null}
      </View>

      {/* Action Button */}
      <View style={styles.actionRow}>
        {isInProgress ? (
          <Pressable
            style={styles.completeBtn}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onCompleteTask && onCompleteTask(task);
            }}
          >
            <CheckCircle2 color="#FFF" size={16} strokeWidth={2.5} />
            <Text style={styles.actionBtnText}>Mark Completed</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              onStartTask(task);
            }}
            style={styles.focusBtnWrapper}
          >
            <LinearGradient
              colors={['#FF7A00', '#FF5C00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.focusBtn}
            >
              <Play color="#FFF" size={14} fill="#FFF" />
              <Text style={styles.actionBtnText}>Focus on this Task</Text>
              <ArrowRight color="#FFF" size={14} strokeWidth={2.5} />
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E9EDF3',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  cardEmpty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E9EDF3',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#4B3FDC',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#EDEAFD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    flex: 1,
  },
  emptyTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: '#182235',
  },
  emptySub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: '#667085',
    marginTop: 1,
  },
  emptyAddBtn: {
    backgroundColor: '#4B3FDC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  emptyAddBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#FFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EDEAFD',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C4BEF8',
  },
  aiBadgeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    color: '#4B3FDC',
    letterSpacing: 0.6,
  },
  priorityPill: {
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
  priorityPillText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 9,
    letterSpacing: 0.4,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 17,
    color: '#182235',
    lineHeight: 24,
    marginBottom: 3,
  },
  description: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#667085',
    lineHeight: 17,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9EDF3',
  },
  metaPillOverdue: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  metaPillText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#182235',
  },
  metaPillTextOverdue: {
    color: '#EF4444',
  },
  categoryPill: {
    backgroundColor: '#EDEAFD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C4BEF8',
  },
  categoryPillText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    color: '#4B3FDC',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 120,
    borderWidth: 1,
    borderColor: '#E9EDF3',
  },
  locationText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    color: '#667085',
  },
  actionRow: {
    marginTop: 2,
  },
  focusBtnWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 8,
    elevation: 5,
  },
  focusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 14,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
  actionBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: '#FFF',
    letterSpacing: 0.2,
  },
});
