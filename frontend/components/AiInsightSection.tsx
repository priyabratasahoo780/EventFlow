
import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, BrainCircuit } from 'lucide-react-native';
import { ColorTheme } from '../constants/theme';
import AiInsightCard from './AiInsightCard';

interface Props {
  insights: string[];
  isDarkMode: boolean;
  colors: ColorTheme;
  onActionPress?: (insight: string) => void;
}

export default function AiInsightSection({
  insights,
  isDarkMode,
  colors,
  onActionPress,
}: Props) {
  //  Pulse for Header AI Badge 
  const badgeGlow = useSharedValue(0.4);
  const badgeScale = useSharedValue(1);

  useEffect(() => {
    badgeGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    badgeScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: badgeGlow.value,
    transform: [{ scale: badgeScale.value }],
  }));

  if (insights.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* ── Section Header ── */}
      <View style={styles.headerRow}>
        <View style={styles.leftCol}>
          <LinearGradient
            colors={['#FF7A00', '#FF5C00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.accentBar}
          />
          <View>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: isDarkMode ? '#FFFFFF' : '#182235' }]}>
                AI Insight
              </Text>
              <Sparkles size={16} color="#FF7A00" />
            </View>
            <Text style={[styles.subtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              What your data says about you
            </Text>
          </View>
        </View>

        {/* Live Synthesis Pill */}
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: isDarkMode ? 'rgba(255, 122, 0, 0.12)' : 'rgba(255, 122, 0, 0.08)',
              borderColor: 'rgba(255, 122, 0, 0.25)',
            },
          ]}
        >
          <Animated.View style={[styles.statusDot, badgeAnimatedStyle]} />
          <Text style={styles.statusText}>SYNTHESIZED</Text>
        </View>
      </View>

      {/* ── Cards List ── */}
      <View style={styles.cardsList}>
        {insights.map((insight, idx) => (
          <AiInsightCard
            key={idx}
            insight={insight}
            index={idx}
            isDarkMode={isDarkMode}
            colors={colors}
            onPress={() => onActionPress?.(insight)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accentBar: {
    width: 4.5,
    height: 38,
    borderRadius: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 18,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF7A00',
  },
  statusText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 9,
    color: '#FF7A00',
    letterSpacing: 1.2,
  },
  cardsList: {
    gap: 2,
  },
});
