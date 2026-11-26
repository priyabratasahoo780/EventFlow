import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, CheckCircle2 } from 'lucide-react-native';
import { useCelebrationStore } from '../store/useCelebrationStore';
import { useThemeStore } from '../store/useThemeStore';
import { useResponsive } from '../constants/responsive';

const CONFETTI_COLORS = [
  '#FF7A00', 
  '#10B981', 
  '#F59E0B', 
  '#3B82F6', 
  '#8B5CF6', 
  '#EC4899', 
  '#06B6D4', 
  '#F43F5E',
  '#FBBF24', 
];

const PARTICLE_COUNT = 55;

interface ParticleConfig {
  id: number;
  startX: number;
  startY: number;
  velocityX: number;
  velocityY: number;
  gravity: number;
  flutterFreq: number;
  flutterAmp: number;
  color: string;
  width: number;
  height: number;
  borderRadius: number;
  spin: number;
}

const SingleParticle: React.FC<{
  config: ParticleConfig;
  progress: SharedValue<number>;
}> = React.memo(({ config, progress }) => {
  const animStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    if (p <= 0 || p >= 1) {
      return { opacity: 0 };
    }

   
    const x = config.startX + config.velocityX * p + Math.sin(p * config.flutterFreq) * config.flutterAmp;
    const y = config.startY + config.velocityY * p + 0.5 * config.gravity * p * p;
    const rot = config.spin * p;
    const scale = Math.max(0.2, 1 - p * 0.25);
    const opacity = p < 0.65 ? 1 : Math.max(0, 1 - (p - 0.65) / 0.35);

    return {
      opacity,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rot}deg` },
        { scale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: config.color,
          width: config.width,
          height: config.height,
          borderRadius: config.borderRadius,
        },
        animStyle,
      ]}
    />
  );
});

export default function ConfettiCelebration() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight, modalMaxWidth } = useResponsive();
  const { isActive, message, stopCelebration } = useCelebrationStore();
  const { isDark } = useThemeStore();
  const isDarkMode = isDark();

  const progress = useSharedValue(0);
  const bannerY = useSharedValue(-120);
  const bannerOpacity = useSharedValue(0);

  // Generate varied confetti particle specs once per viewport change
  const particles = useMemo<ParticleConfig[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
      // 3 emission origins: Left-center, Center, Right-center for a wide fireworks burst
      const lane = i % 3;
      const startX =
        lane === 0
          ? screenWidth * 0.2
          : lane === 1
          ? screenWidth * 0.5
          : screenWidth * 0.8;
      const startY = screenHeight * 0.45;

      const isRibbon = i % 3 === 0;
      const isCircle = i % 3 === 1;

      return {
        id: i,
        startX,
        startY,
        velocityX: (Math.random() - 0.5) * screenWidth * 1.3,
        velocityY: -(Math.random() * 420 + 260),
        gravity: 850 + Math.random() * 300,
        flutterFreq: 8 + Math.random() * 12,
        flutterAmp: 18 + Math.random() * 24,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        width: isRibbon ? 7 + Math.random() * 4 : isCircle ? 9 : 8,
        height: isRibbon ? 14 + Math.random() * 6 : isCircle ? 9 : 8,
        borderRadius: isCircle ? 5 : 2,
        spin: (Math.random() - 0.5) * 1200,
      };
    });
  }, [screenWidth, screenHeight]);

  useEffect(() => {
    if (isActive) {
      // 1. Reset values
      progress.value = 0;
      bannerY.value = -120;
      bannerOpacity.value = 0;

      // 2. Animate Confetti Particles
      progress.value = withTiming(
        1,
        { duration: 2500, easing: Easing.out(Easing.quad) },
        (finished) => {
          if (finished) {
            runOnJS(stopCelebration)();
          }
        }
      );

      // 3. Animate Milestone Toast Banner: Drop in -> Hold -> Slide out
      bannerY.value = withSequence(
        withSpring(insets.top + 14, { damping: 14, stiffness: 120 }),
        withDelay(1900, withTiming(-120, { duration: 320, easing: Easing.in(Easing.cubic) }))
      );
      bannerOpacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withDelay(1900, withTiming(0, { duration: 300 }))
      );
    }
  }, [isActive, insets.top, stopCelebration]);

  const bannerAnimStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacity.value,
    transform: [{ translateY: bannerY.value }],
  }));

  if (!isActive) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* ── 1. Confetti Particles Canvas ── */}
      {particles.map((p) => (
        <SingleParticle key={p.id} config={p} progress={progress} />
      ))}

      {/* ── 2. Floating Milestone Toast ── */}
      <Animated.View
        style={[
          styles.bannerWrapper,
          { maxWidth: modalMaxWidth },
          isDarkMode ? styles.bannerDark : styles.bannerLight,
          bannerAnimStyle,
        ]}
      >
        <View style={styles.bannerIconBox}>
          <CheckCircle2 color="#10B981" size={18} strokeWidth={2.8} />
        </View>

        <Text
          style={[
            styles.bannerText,
            { color: isDarkMode ? '#FFFFFF' : '#0F172A' },
          ]}
          numberOfLines={1}
        >
          {message}
        </Text>

        <Sparkles color="#FF7A00" size={16} strokeWidth={2.4} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
    elevation: 99,
    zIndex: 9999,
  },
  bannerWrapper: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 20,
    zIndex: 10000,
  },
  bannerLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
  },
  bannerDark: {
    backgroundColor: 'rgba(21, 28, 40, 0.96)',
    borderColor: '#2D3A52',
    shadowColor: '#000000',
  },
  bannerIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
