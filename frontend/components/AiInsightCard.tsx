import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CheckCircle2,
  Sparkles,
  Clock,
  TrendingUp,
  AlertCircle,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  Flame,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ColorTheme } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  insight: string;
  index: number;
  isDarkMode: boolean;
  colors: ColorTheme;
  onPress?: () => void;
}

interface ParsedInsight {
  type: 'habit' | 'peak' | 'warning' | 'trend' | 'info';
  badgeTag: string;
  title: string;
  description: string;
  accentColor: string;
  lightBg: [string, string];
  darkBg: [string, string];
  actionLabel: string;
}

function parseInsightText(text: string): ParsedInsight {
  const lower = text.toLowerCase();

  // 1. On-time Habit / 100% completion
  if (lower.includes('great habit') || lower.includes('100%') || text.includes('✅')) {
    const cleanText = text.replace(/^[^\w]+/, '').trim();
    return {
      type: 'habit',
      badgeTag: 'HABIT MASTERY',
      title: 'Punctuality Champion',
      description: cleanText,
      accentColor: '#10B981',
      lightBg: ['#F0FDF4', '#DCFCE7'],
      darkBg: ['rgba(16, 185, 129, 0.14)', 'rgba(5, 150, 105, 0.08)'],
      actionLabel: 'Keep Momentum',
    };
  }

  // 2. Peak Productive Window
  if (lower.includes('productive around') || lower.includes('schedule your hardest') || text.includes('✨')) {
    const cleanText = text.replace(/^[^\w]+/, '').trim();
    // Extract time if possible
    return {
      type: 'peak',
      badgeTag: 'PEAK FOCUS WINDOW',
      title: 'Prime Performance Zone',
      description: cleanText,
      accentColor: '#FF7A00',
      lightBg: ['#FFFBEB', '#FEF3C7'],
      darkBg: ['rgba(255, 122, 0, 0.16)', 'rgba(217, 119, 6, 0.08)'],
      actionLabel: 'Schedule Focus Block',
    };
  }

  // 3. Late / Overdue Warning
  if (lower.includes('late') || lower.includes('buffer') || text.includes('🚨')) {
    const cleanText = text.replace(/^[^\w]+/, '').trim();
    return {
      type: 'warning',
      badgeTag: 'TIME TUNING',
      title: 'Buffer Recommendation',
      description: cleanText,
      accentColor: '#EF4444',
      lightBg: ['#FEF2F2', '#FEE2E2'],
      darkBg: ['rgba(239, 68, 68, 0.14)', 'rgba(185, 28, 28, 0.08)'],
      actionLabel: 'Add Extra Buffer',
    };
  }

  // 4. Trend / Velocity
  if (lower.includes('more tasks') || lower.includes('fewer tasks') || text.includes('📈') || text.includes('📉')) {
    const cleanText = text.replace(/^[^\w]+/, '').trim();
    return {
      type: 'trend',
      badgeTag: 'VELOCITY TREND',
      title: 'Weekly Output Surge',
      description: cleanText,
      accentColor: '#6366F1',
      lightBg: ['#EEF2FF', '#E0E7FF'],
      darkBg: ['rgba(99, 102, 241, 0.14)', 'rgba(67, 56, 202, 0.08)'],
      actionLabel: 'Analyze Output',
    };
  }

  // 5. Default / Smart Pattern
  const cleanText = text.replace(/^[^\w]+/, '').trim();
  return {
    type: 'info',
    badgeTag: 'SMART PATTERN',
    title: 'Productivity Insight',
    description: cleanText,
    accentColor: '#3B82F6',
    lightBg: ['#EFF6FF', '#DBEAFE'],
    darkBg: ['rgba(59, 130, 246, 0.14)', 'rgba(29, 78, 216, 0.08)'],
    actionLabel: 'Explore Details',
  };
}

export default function AiInsightCard({
  insight,
  index,
  isDarkMode,
  colors,
  onPress,
}: Props) {
  const parsed = parseInsightText(insight);

  // ── Animated Shared Values ──────────────────────────────────────────────────
  const scale = useSharedValue(1);
  const cardTranslateY = useSharedValue(24);
  const cardOpacity = useSharedValue(0);
  const iconFloat = useSharedValue(0);
  const glowPulse = useSharedValue(0.4);
  const shimmerTranslate = useSharedValue(-SCREEN_WIDTH);

  useEffect(() => {
    // Staggered entrance animation
    cardOpacity.value = withDelay(index * 120, withTiming(1, { duration: 500 }));
    cardTranslateY.value = withDelay(
      index * 120,
      withSpring(0, { damping: 14, stiffness: 100 })
    );

    // Subtle floating micro-motion on icon
    iconFloat.value = withDelay(
      index * 200,
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(3, { duration: 1800, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );

    // Subtle breathing glow along borders
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 2200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Periodical light sweep across card glass surface
    shimmerTranslate.value = withDelay(
      800 + index * 400,
      withRepeat(
        withTiming(SCREEN_WIDTH * 1.4, { duration: 2000, easing: Easing.inOut(Easing.cubic) }),
        -1,
        false
      )
    );
  }, []);

  const handlePressIn = () => {
    scale.value = withSpring(0.975, { damping: 15, stiffness: 240 });
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (_) {}
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 180 });
  };

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateY: cardTranslateY.value },
      { scale: scale.value },
    ],
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: iconFloat.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowPulse.value,
  }));

  const shimmerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslate.value }],
  }));

  // Render appropriate vector icon
  const renderIcon = () => {
    const iconSize = 22;
    switch (parsed.type) {
      case 'habit':
        return <CheckCircle2 color="#FFFFFF" size={iconSize} strokeWidth={2.6} />;
      case 'peak':
        return <Sparkles color="#FFFFFF" size={iconSize} strokeWidth={2.4} />;
      case 'warning':
        return <AlertCircle color="#FFFFFF" size={iconSize} strokeWidth={2.4} />;
      case 'trend':
        return <TrendingUp color="#FFFFFF" size={iconSize} strokeWidth={2.6} />;
      default:
        return <Zap color="#FFFFFF" size={iconSize} strokeWidth={2.4} />;
    }
  };

  const bgColors = isDarkMode ? parsed.darkBg : parsed.lightBg;
  const borderColor = isDarkMode
    ? `${parsed.accentColor}33`
    : `${parsed.accentColor}25`;

  return (
    <Animated.View style={[styles.cardWrapper, cardAnimatedStyle]}>
      {/* Ambient background blur glow */}
      <Animated.View
        style={[
          styles.ambientGlow,
          {
            backgroundColor: parsed.accentColor,
            shadowColor: parsed.accentColor,
          },
          glowAnimatedStyle,
        ]}
      />

      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.cardContainer,
          {
            borderColor,
            backgroundColor: isDarkMode ? 'rgba(18, 18, 32, 0.85)' : '#FFFFFF',
          },
        ]}
      >
        {/* Subtle Mesh Gradient Fill */}
        <LinearGradient
          colors={bgColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Diagonal Shimmer Light Sweep */}
        <Animated.View
          style={[styles.shimmerContainer, shimmerAnimatedStyle]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[
              'transparent',
              isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.45)',
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shimmerGradient}
          />
        </Animated.View>

        {/* Left Vertical Accent Ribbon */}
        <View style={[styles.accentRibbon, { backgroundColor: parsed.accentColor }]} />

        {/* Content Body */}
        <View style={styles.cardContent}>
          {/* Top Pill Row */}
          <View style={styles.cardTopRow}>
            <View
              style={[
                styles.categoryBadge,
                {
                  backgroundColor: `${parsed.accentColor}18`,
                  borderColor: `${parsed.accentColor}40`,
                },
              ]}
            >
              <View
                style={[
                  styles.categoryDot,
                  { backgroundColor: parsed.accentColor },
                ]}
              />
              <Text style={[styles.categoryBadgeText, { color: parsed.accentColor }]}>
                {parsed.badgeTag}
              </Text>
            </View>

            <View style={styles.aiTag}>
              <Text style={[styles.aiTagText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                AI VERIFIED ✦
              </Text>
            </View>
          </View>

          {/* Main Content: Hero Icon + Text */}
          <View style={styles.mainRow}>
            {/* Animated 3D Squircle Icon */}
            <Animated.View style={[styles.iconFrame, iconAnimatedStyle]}>
              <LinearGradient
                colors={[parsed.accentColor, `${parsed.accentColor}CC`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.iconGradient,
                  {
                    shadowColor: parsed.accentColor,
                  },
                ]}
              >
                {renderIcon()}
              </LinearGradient>
            </Animated.View>

            {/* Insight Text & Title */}
            <View style={styles.textColumn}>
              <Text
                style={[
                  styles.insightTitle,
                  { color: isDarkMode ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                {parsed.title}
              </Text>
              <Text
                style={[
                  styles.insightBody,
                  { color: isDarkMode ? '#CBD5E1' : '#334155' },
                ]}
              >
                {parsed.description}
              </Text>
            </View>
          </View>

          {/* Bottom Action Footer */}
          <View style={styles.cardFooter}>
            <View
              style={[
                styles.actionChip,
                {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)',
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            >
              <Text
                style={[
                  styles.actionChipText,
                  { color: parsed.accentColor },
                ]}
              >
                {parsed.actionLabel}
              </Text>
              <ArrowUpRight
                size={13}
                color={parsed.accentColor}
                strokeWidth={2.6}
              />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 14,
    borderRadius: 22,
    position: 'relative',
  },
  ambientGlow: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    bottom: 0,
    borderRadius: 22,
    opacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 6,
  },
  cardContainer: {
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
  },
  shimmerGradient: {
    flex: 1,
    transform: [{ skewX: '-25deg' }],
  },
  accentRibbon: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4.5,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
  },
  cardContent: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    paddingLeft: 20,
    gap: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryBadgeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  aiTag: {
    paddingHorizontal: 6,
  },
  aiTagText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.5,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  iconFrame: {
    marginTop: 2,
  },
  iconGradient: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  textColumn: {
    flex: 1,
    gap: 3,
  },
  insightTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.3,
  },
  insightBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionChipText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
