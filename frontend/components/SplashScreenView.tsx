/**
 * SplashScreenView.tsx
 * Animated splash screen powered by React Native Reanimated.
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
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
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

// ─── Brand Theme Tokens (Radiant, Warm & Luxury) ──────────────────────────────
const C = {
  orange:       '#FF7A00',
  orangeDeep:   '#FF5C00',
  orangeGlow:   '#FF9500',
  amber:        '#FFB800',
  indigo:       '#4B3FDC',
  indigoBright: '#6366F1',
  bgTop:        '#FFFDF9',
  bgMid:        '#FFF3E6',
  bgWarm:       '#FFEADB',
  bgBottom:     '#FFF5EA',
  white:        '#FFFFFF',
  textDark:     '#111827',
  textMuted:    '#64748B',
  badgeBorder:  'rgba(255, 122, 0, 0.35)',
  badgeBg:      'rgba(255, 122, 0, 0.08)',
};

// ─── Loading Status Messages ──────────────────────────────────────────────────
const STATUS_STEPS = [
  'INITIALIZING WORKSPACE...',
  'SYNCING SMART SCHEDULES...',
  'PREPARING EVENT ENGINE...',
  'READY TO LAUNCH',
];

const PORTAL_SIZE = Math.min(width * 0.95, 380);
const ICON_SIZE = width * 0.28;

const GRADIENT_COLORS = [C.bgTop, C.bgMid, C.bgWarm, C.bgBottom] as const;
const GRADIENT_LOCATIONS = [0, 0.35, 0.72, 1] as const;
const BADGE_COLORS = ['rgba(255, 122, 0, 0.14)', 'rgba(99, 102, 241, 0.08)'] as const;
const PROGRESS_COLORS = [C.indigoBright, C.orangeGlow, C.orange] as const;
const CARD_BORDER_COLORS = ['rgba(255, 255, 255, 0.95)', 'rgba(255, 245, 235, 0.85)'] as const;

// ─── Isolated Status Tracker (Prevents Re-rendering the Heavy Parent Tree) ────
const StatusDots = React.memo(function StatusDots({ step }: { step: number }) {
  return (
    <View style={styles.stepDotsRow}>
      <View style={[styles.stepDot, styles.stepDotActive]} />
      <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
      <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
    </View>
  );
});

const StatusFooter = React.memo(function StatusFooter({ step }: { step: number }) {
  return (
    <View style={styles.statusFooterRow}>
      <Text style={styles.statusStepText}>{STATUS_STEPS[step]}</Text>
      <Text style={styles.versionText}>v1.0.0 • PRO</Text>
    </View>
  );
});

interface Props {
  isReady?: boolean;
  onFinish?: () => void;
}

function SplashScreenView({ isReady = false, onFinish }: Props) {
  // ── Lottie Refs ─────────────────────────────────────────────────────────────
  const portalLottieRef = useRef<LottieView>(null);
  const particlesLottieRef = useRef<LottieView>(null);
  const loaderLottieRef = useRef<LottieView>(null);

  // ── Local state for status text ─────────────────────────────────────────────
  const [statusIndex, setStatusIndex] = useState(0);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // ── Reanimated Shared Values ────────────────────────────────────────────────
  const rootOpacity   = useSharedValue(1);
  const rootScale     = useSharedValue(1);

  // Background glow orbs
  const orbScale      = useSharedValue(0.85);
  const orbOpacity    = useSharedValue(0);

  // Hero section entrance
  const badgeOpacity  = useSharedValue(0);
  const badgeTranslateY = useSharedValue(-15);

  const portalScale   = useSharedValue(0.4);
  const portalOpacity = useSharedValue(0);

  const iconScale     = useSharedValue(0);
  const iconGlowPulse = useSharedValue(0.5);

  // Typography entrance
  const titleOpacity  = useSharedValue(0);
  const titleTranslateY = useSharedValue(25);

  const tagOpacity    = useSharedValue(0);
  const tagTranslateY = useSharedValue(18);

  // Loader entrance & progress
  const loaderOpacity = useSharedValue(0);
  const progressBar   = useSharedValue(0);

  // ── Entrance Choreography ───────────────────────────────────────────────────
  useEffect(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (_) {}

    // Ambient orbs breathe smoothly on UI thread
    orbOpacity.value = withTiming(1, { duration: 800 });
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.9, { duration: 3200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Category badge reveal
    badgeOpacity.value = withDelay(150, withTiming(1, { duration: 500 }));
    badgeTranslateY.value = withDelay(
      150,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );

    // Energy Portal entrance
    portalOpacity.value = withDelay(180, withTiming(1, { duration: 600 }));
    portalScale.value = withDelay(
      180,
      withSpring(1, { damping: 14, stiffness: 85 })
    );

    // Central 3D Icon Card spring pop
    iconScale.value = withDelay(
      300,
      withSpring(1, { damping: 11, stiffness: 100 })
    );

    // Warm neon aura pulse
    iconGlowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.45, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Typography entrance
    titleOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));
    titleTranslateY.value = withDelay(
      500,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.back(1.2)) })
    );

    tagOpacity.value = withDelay(700, withTiming(1, { duration: 500 }));
    tagTranslateY.value = withDelay(
      700,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );

    // Cyber Loader section reveal & GPU progress fill
    loaderOpacity.value = withDelay(850, withTiming(1, { duration: 400 }));
    progressBar.value = withDelay(
      950,
      withTiming(0.94, { duration: 1800, easing: Easing.out(Easing.cubic) })
    );

    // Step cycle
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev < STATUS_STEPS.length - 1 ? prev + 1 : prev));
    }, 550);

    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, []);

  // ── Coordinated Exit Sequence ───────────────────────────────────────────────
  useEffect(() => {
    if (isReady && minTimeElapsed) {
      progressBar.value = withTiming(1, { duration: 200 }, () => {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        } catch (_) {}

        // Cinematic exit zoom-out and fade
        rootScale.value = withTiming(1.03, { duration: 400, easing: Easing.in(Easing.cubic) });
        rootOpacity.value = withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) }, () => {
          if (onFinish) {
            runOnJS(onFinish)();
          }
        });
      });
    }
  }, [isReady, minTimeElapsed, onFinish]);

  // ── UI Thread Animated Styles ──────────────────────────────────────────────
  const rootAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
    transform: [{ scale: rootScale.value }],
  }));

  const orbAnimatedStyle = useAnimatedStyle(() => ({
    opacity: orbOpacity.value,
    transform: [{ scale: orbScale.value }],
  }));

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ translateY: badgeTranslateY.value }],
  }));

  const portalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: portalOpacity.value,
    transform: [{ scale: portalScale.value }],
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const iconGlowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: iconGlowPulse.value,
    transform: [{ scale: interpolate(iconGlowPulse.value, [0.45, 1], [0.96, 1.12]) }],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const tagAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tagOpacity.value,
    transform: [{ translateY: tagTranslateY.value }],
  }));

  const loaderSectionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: loaderOpacity.value,
  }));

  const progressFillAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progressBar.value }],
  }));



  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootAnimatedStyle]}>
      <StatusBar style="dark" />

      {/* ── 1. Radiant Warm Aurora Gradient ─────────────────────────── */}
      <LinearGradient
        colors={GRADIENT_COLORS}
        locations={GRADIENT_LOCATIONS}
        style={StyleSheet.absoluteFill}
      />

      {/* ── 2. Ambient Radiant Glow Orbs ────────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, orbAnimatedStyle]} pointerEvents="none">
        <View style={styles.ambientOrbTop} />
        <View style={styles.ambientOrbBottom} />
        <View style={styles.ambientOrbCenter} />
      </Animated.View>

      {/* ── 3. Fullscreen Particles / Constellation Sparks ──────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LottieView
          ref={particlesLottieRef}
          source={require('../assets/lottie/eventflow-particles.json')}
          autoPlay
          loop
          speed={0.8}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </View>

      {/* ── 4. Main Stage (Pill, Portal, 3D Icon Card, Title, Tagline) ── */}
      <View style={styles.stage}>

        {/* ── Modern Category Pill ──────────────────────────────────── */}
        <Animated.View style={[styles.badgeContainer, badgeAnimatedStyle]}>
          <LinearGradient
            colors={BADGE_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.badgeGradient}
          >
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>SMART EVENT PLATFORM</Text>
          </LinearGradient>
        </Animated.View>

        {/* ── Hero Center: Concentric Portal + 3D Logo Card ─────────── */}
        <View style={[styles.heroCenter, { width: PORTAL_SIZE, height: PORTAL_SIZE }]}>
          <Animated.View style={[styles.lottiePortalWrapper, portalAnimatedStyle]}>
            <LottieView
              ref={portalLottieRef}
              source={require('../assets/lottie/eventflow-portal.json')}
              autoPlay
              loop
              speed={1.0}
              style={{ width: PORTAL_SIZE, height: PORTAL_SIZE }}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Central Logo with Multi-layer Warm Aura */}
          <View style={styles.iconCenterWrapper}>
            <Animated.View
              style={[
                styles.iconNeonAuraOuter,
                { width: ICON_SIZE + 50, height: ICON_SIZE + 50, borderRadius: (ICON_SIZE + 50) / 2 },
                iconGlowAnimatedStyle,
              ]}
            />
            <Animated.View
              style={[
                styles.iconNeonAuraInner,
                { width: ICON_SIZE + 24, height: ICON_SIZE + 24, borderRadius: (ICON_SIZE + 24) / 2 },
                iconGlowAnimatedStyle,
              ]}
            />

            {/* Premium 3D Floating Icon Card */}
            <Animated.View style={[styles.iconCard, { width: ICON_SIZE, height: ICON_SIZE }, iconAnimatedStyle]}>
              <LinearGradient
                colors={CARD_BORDER_COLORS}
                style={styles.iconCardBorder}
              >
                <View style={styles.iconInnerFrame}>
                  <Image
                    source={require('../assets/images/icon.png')}
                    style={styles.iconImage}
                    resizeMode="contain"
                  />
                </View>
              </LinearGradient>
            </Animated.View>
          </View>
        </View>

        {/* ── Brand Typography: Title ───────────────────────────────── */}
        <Animated.View style={[styles.brandTitleWrapper, titleAnimatedStyle]}>
          <Text style={styles.brandTitleText}>
            <Text style={styles.brandTitleDark}>Event</Text>
            <Text style={styles.brandTitleOrange}>Flow</Text>
          </Text>
          <View style={styles.sparkleIcon}>
            <Text style={styles.sparkleText}>✦</Text>
          </View>
        </Animated.View>

        {/* ── Tagline & Status Dots ─────────────────────────────────── */}
        <Animated.View style={[styles.taglineWrapper, tagAnimatedStyle]}>
          <Text style={styles.taglineText}>Plan  •  Focus  •  Achieve</Text>
          <StatusDots step={statusIndex} />
        </Animated.View>

      </View>

      {/* ── 5. Cyber Loader Section (Lottie Beam + Bar + Status) ─────── */}
      <Animated.View style={[styles.loaderSection, loaderSectionAnimatedStyle]}>
        <View style={styles.lottieLoaderContainer}>
          <LottieView
            ref={loaderLottieRef}
            source={require('../assets/lottie/eventflow-loader.json')}
            autoPlay
            loop
            speed={1.2}
            style={styles.lottieLoader}
            resizeMode="contain"
          />
        </View>

        {/* Progress Track with GPU Scale Fill */}
        <View style={styles.progressBarTrack}>
          <Animated.View style={[styles.progressBarFill, progressFillAnimatedStyle]}>
            <LinearGradient
              colors={PROGRESS_COLORS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        {/* Isolated Memoized Status Footer */}
        <StatusFooter step={statusIndex} />
      </Animated.View>
    </Animated.View>
  );
}

export default React.memo(SplashScreenView);

// ─── Stylesheet ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgBottom,
  },

  // Ambient Glowing Orbs
  ambientOrbTop: {
    position: 'absolute',
    top: -width * 0.2,
    right: -width * 0.15,
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: (width * 0.9) / 2,
    backgroundColor: C.orange,
    opacity: 0.18,
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: -width * 0.25,
    left: -width * 0.2,
    width: width * 0.95,
    height: width * 0.95,
    borderRadius: (width * 0.95) / 2,
    backgroundColor: C.indigoBright,
    opacity: 0.12,
  },
  ambientOrbCenter: {
    position: 'absolute',
    top: height * 0.3,
    left: width * 0.15,
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: (width * 0.7) / 2,
    backgroundColor: C.amber,
    opacity: 0.15,
  },

  // Main Stage
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: height * 0.03,
  },

  // Category Pill Badge
  badgeContainer: {
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.badgeBorder,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    gap: 8,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.orange,
  },
  badgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#EA580C',
    letterSpacing: 2,
  },

  // Hero Center (Portal + App Icon)
  heroCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  lottiePortalWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCenterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconNeonAuraOuter: {
    position: 'absolute',
    backgroundColor: C.amber,
    opacity: 0.25,
  },
  iconNeonAuraInner: {
    position: 'absolute',
    backgroundColor: C.orange,
    opacity: 0.35,
  },
  iconCard: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  iconCardBorder: {
    flex: 1,
    padding: 2,
    borderRadius: 28,
  },
  iconInnerFrame: {
    flex: 1,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  iconImage: {
    width: '100%',
    height: '100%',
  },

  // Brand Title
  brandTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  brandTitleText: {
    fontSize: 46,
    lineHeight: 54,
    letterSpacing: -1,
  },
  brandTitleDark: {
    fontFamily: 'Poppins_800ExtraBold',
    color: C.textDark,
  },
  brandTitleOrange: {
    fontFamily: 'Poppins_800ExtraBold',
    color: C.orange,
  },
  sparkleIcon: {
    marginLeft: 6,
    marginBottom: 18,
  },
  sparkleText: {
    color: C.amber,
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Tagline & Step Dots
  taglineWrapper: {
    alignItems: 'center',
    gap: 14,
  },
  taglineText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: C.textMuted,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  stepDotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  stepDot: {
    width: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 122, 0, 0.2)',
  },
  stepDotActive: {
    width: 22,
    backgroundColor: C.orange,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 2,
  },

  // Cyber Loader Section
  loaderSection: {
    paddingHorizontal: 36,
    paddingBottom: Platform.OS === 'ios' ? height * 0.07 : height * 0.05,
    alignItems: 'center',
    gap: 8,
  },
  lottieLoaderContainer: {
    width: '100%',
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottieLoader: {
    width: width * 0.82,
    height: 28,
  },
  progressBarTrack: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 122, 0, 0.15)',
    overflow: 'hidden',
  },
  progressBarFill: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    transformOrigin: 'left',
  },
  statusFooterRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginTop: 4,
  },
  statusStepText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    color: '#EA580C',
    letterSpacing: 1.5,
  },
  versionText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 1.5,
  },
});
