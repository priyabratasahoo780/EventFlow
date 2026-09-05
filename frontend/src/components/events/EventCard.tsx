import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Event } from '../../types/event.types';
import {
  Clock, Calendar, CheckCircle, MapPin, Zap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface EventCardProps {
  event: Event;
  index: number;
  onPress: () => void;
  onComplete: () => void;
  onDelete: () => void;
}
const getPriorityConfig = (colors: ColorTheme): Record<string, { strip: string; bg: string; text: string; label: string }> => ({
  critical: { strip: colors.error, bg: colors.dangerLight, text: colors.error, label: 'CRITICAL' },
  high:     { strip: colors.secondary, bg: colors.secondaryLight, text: colors.secondary, label: 'HIGH' },
  medium:   { strip: colors.warning, bg: colors.warningLight, text: colors.warning, label: 'MEDIUM' },
  low:      { strip: colors.success, bg: colors.successLight, text: colors.success, label: 'LOW' },
});

export default function EventCard({ event, onPress, onComplete }: EventCardProps) {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const isCompleted = event.completed || event.status === 'completed';
  const isInProgress = event.status === 'in_progress';
  const PRIORITY_CONFIG = getPriorityConfig(colors);
  const prio = PRIORITY_CONFIG[event.priority?.toLowerCase()] || PRIORITY_CONFIG.medium;

  const dateFormatted = event.date ? event.date.split('T')[0] : '';
  const estDuration = event.estimatedDuration || 30;

  const handleToggleComplete = () => {
    Haptics.notificationAsync(
      isCompleted
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success
    );
    onComplete();
  };

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={styles.container}
    >
      <View style={[
        styles.card,
        isCompleted && styles.cardCompleted,
        isInProgress && styles.cardInProgress,
      ]}>
        {/* Left Priority Strip */}
        {isInProgress ? (
          <LinearGradient
            colors={[colors.primary, '#3F35C8']}
            style={styles.priorityStrip}
          />
        ) : isCompleted ? (
          <View style={[styles.priorityStrip, { backgroundColor: colors.success }]} />
        ) : (
          <View style={[styles.priorityStrip, { backgroundColor: prio.strip }]} />
        )}

        <View style={styles.cardContent}>
          {/* Top Row: Badges + Checkbox */}
          <View style={styles.topRow}>
            <View style={styles.badgesRow}>
              {event.category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{event.category.toUpperCase()}</Text>
                </View>
              )}

              <View style={[styles.priorityBadge, { backgroundColor: prio.bg }]}>
                <Text style={[styles.priorityBadgeText, { color: prio.text }]}>{prio.label}</Text>
              </View>

              {isInProgress && (
                <View style={styles.inProgressBadge}>
                  <Zap color={colors.primary} size={10} strokeWidth={3} />
                  <Text style={styles.inProgressText}>FOCUSING</Text>
                </View>
              )}
            </View>

            {/* Checkbox */}
            <Pressable onPress={handleToggleComplete} hitSlop={10} style={styles.checkbox}>
              {isCompleted ? (
                <CheckCircle color={colors.success} size={22} strokeWidth={2.5} fill={colors.successLight} />
              ) : (
                <View style={styles.unchecked} />
              )}
            </Pressable>
          </View>

          {/* Title */}
          <Text
            style={[styles.title, isCompleted && styles.titleCompleted]}
            numberOfLines={2}
          >
            {event.title}
          </Text>

          {/* Description */}
          {event.description ? (
            <Text
              style={[styles.description, isCompleted && styles.descriptionCompleted]}
              numberOfLines={2}
            >
              {event.description}
            </Text>
          ) : null}

          {/* Footer Meta */}
          <View style={styles.footerRow}>
            <View style={styles.metaGroup}>
              {dateFormatted ? (
                <View style={styles.metaTag}>
                  <Calendar color={colors.textSecondary} size={12} strokeWidth={2} />
                  <Text style={styles.metaTagText}>{dateFormatted}</Text>
                </View>
              ) : null}

              {event.time ? (
                <View style={styles.metaTag}>
                  <Clock color={colors.textSecondary} size={12} strokeWidth={2} />
                  <Text style={styles.metaTagText}>{event.time}</Text>
                </View>
              ) : null}

              <View style={styles.durationTag}>
                <Text style={styles.durationText}>~{estDuration}m</Text>
              </View>
            </View>

            {event.location ? (
              <View style={styles.locationTag}>
                <MapPin color={colors.textSecondary} size={11} />
                <Text style={styles.locationText} numberOfLines={1}>{event.location}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
  },
  cardCompleted: {
    backgroundColor: '#FAFAFA',
    borderColor: colors.border,
    shadowOpacity: 0.03,
  },
  cardInProgress: {
    borderColor: colors.primaryLight,
    backgroundColor: '#FDFCFF',
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
  },
  priorityStrip: {
    width: 5,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryBadgeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 9,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  priorityBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityBadgeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 9,
    letterSpacing: 0.4,
  },
  inProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  inProgressText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 9,
    color: colors.primary,
    letterSpacing: 0.4,
  },
  checkbox: {
    padding: 2,
  },
  unchecked: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#D1D9E6',
    backgroundColor: '#FAFAFA',
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  description: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  descriptionCompleted: {
    color: '#B0B9C6',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  metaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaTagText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
  },
  durationTag: {
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#FFD5B0',
  },
  durationText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    color: colors.secondary,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: 110,
  },
  locationText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
  },
});
