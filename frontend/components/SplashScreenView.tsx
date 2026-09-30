/**
 * SplashScreenView.tsx — EventFlow Next-Gen Cinematic Splash Screen
 * ═════════════════════════════════════════════════════════════════
 *
 * Fully animated, theme-accurate splash screen powered by Lottie & React Native Reanimated.
 *
 * Visual Features:
 *   ① Ambient Celestial Nebula: Deep obsidian background with orange & indigo glow orbs
 *   ② Fullscreen Lottie Starfield: Drifting cosmic particles, constellation sparks, and flares
 *   ③ Hero Lottie Energy Portal: Concentric gyroscopic rings, pulsing shockwaves, & orbital beacons
 *   ④ App Icon Spring-reveal: Frosted glassmorphism card with neon amber/orange aura
 *   ⑤ Dynamic Branding: Duo-tone "EventFlow" title with text glow & category badge
 *   ⑥ High-tech Cyber Loader: Laser beam scanner Lottie with rotating status indicators
 *   ⑦ Cinema Exit Transition: Coordinated fade & subtle zoom scale hand-off to the app
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
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

// ─── Brand Theme Tokens ──────────────────────────────────────────────────────
const C = {
  orange:       '#FF7A00',
  orangeDeep:   '#FF5C00',
  orangeGlow:   '#FF9500',
  amber:        '#FFBF0D',
  indigo:       '#4B3FDC',
  indigoBright: '#6B5FF2',
  cyan:         '#26D9FF',
  bgDeep:       '#070714',
  bgMid:        '#0E0D24',
  bgTop:        '#141238',
  white:        '#FFFFFF',
  slate:        '#94A3B8',
  slateLight:   '#E2E8F0',
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

interface Props {
  isReady?: boolean;
  onFinish?: () => void;
}

export default function SplashScreenView({ isReady = false, onFinish }: Props) {
  // ── Lottie Refs ─────────────────────────────────────────────────────────────
  const portalLottieRef = useRef<LottieView>(null);
  const particlesLottieRef = useRef<LottieView>(null);
  const loaderLottieRef = useRef<LottieView>(null);

  // ── State for dynamic status text ───────────────────────────────────────────
  const [statusIndex, setStatusIndex] = useState(0);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // ── Reanimated Shared Values ────────────────────────────────────────────────
  const rootOpacity   = useSharedValue(1);
  const rootScale     = useSharedValue(1);

  // Background glow orbs
  const orbScale      = useSharedValue(0.8);
  const orbOpacity    = useSharedValue(0);

  // Hero section entrance
  const badgeOpacity  = useSharedValue(0);
  const badgeTranslateY = useSharedValue(-15);

  const portalScale   = useSharedValue(0.4);
  const portalOpacity = useSharedValue(0);

  const iconScale     = useSharedValue(0);
  const iconGlowPulse = useSharedValue(0.4);

  // Typography entrance
  const titleOpacity  = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);

  const tagOpacity    = useSharedValue(0);
  const tagTranslateY = useSharedValue(20);

  // Loader entrance & progress
  const loaderOpacity = useSharedValue(0);
  const progressBar   = useSharedValue(0);

  // ── Entrance Choreography ───────────────────────────────────────────────────
  useEffect(() => {
    // 1. Subtle tactile feedback on start
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (_) {}

    // 2. Ambient orbs breathe
    orbOpacity.value = withTiming(1, { duration: 1000 });
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.9, { duration: 3200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // 3. Category badge reveal
    badgeOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    badgeTranslateY.value = withDelay(
      200,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) })
    );

    // 4. Lottie Portal entrance
    portalOpacity.value = withDelay(150, withTiming(1, { duration: 700 }));
    portalScale.value = withDelay(
      150,
      withSpring(1, { damping: 14, stiffness: 85 })
    );

    // 5. Central Icon Card spring pop
    iconScale.value = withDelay(
      350,
      withSpring(1, { damping: 11, stiffness: 100 })
    );

    // 6. Icon neon glow breathing
    iconGlowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.4, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // 7. Typography entrance: Title & Tagline
    titleOpacity.value = withDelay(650, withTiming(1, { duration: 600 }));
    titleTranslateY.value = withDelay(
      650,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.back(1.2)) })
    );

    tagOpacity.value = withDelay(850, withTiming(1, { duration: 500 }));
    tagTranslateY.value = withDelay(
      850,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );

    // 8. Cyber Loader section reveal
    loaderOpacity.value = withDelay(1000, withTiming(1, { duration: 400 }));
    progressBar.value = withDelay(
      1100,
      withTiming(0.92, { duration: 2200, easing: Easing.out(Easing.cubic) })
    );

    // 9. Cycle status text for high-tech feeling
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev < STATUS_STEPS.length - 1 ? prev + 1 : prev));
    }, 650);

    // 10. Guarantee a minimum display duration of 2.2 seconds so user enjoys the visuals
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 2200);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, []);

  // ── Coordinated Exit Sequence ───────────────────────────────────────────────
  useEffect(() => {
    // Only proceed to exit when both app resources (fonts/auth) are ready AND min showcase time has elapsed
    if (isReady && minTimeElapsed) {
      progressBar.value = withTiming(1, { duration: 250 }, () => {
        // Subtle exit haptic
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        } catch (_) {}

        // Cinematic zoom-out and fade
        rootScale.value = withTiming(1.04, { duration: 450, easing: Easing.in(Easing.cubic) });
        rootOpacity.value = withTiming(0, { duration: 450, easing: Easing.in(Easing.cubic) }, () => {
          if (onFinish) {
            runOnJS(onFinish)();
          }
        });
      });
    }
  }, [isReady, minTimeElapsed]);

  // ── Animated Style Bindings ────────────────────────────────────────────────
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
    transform: [{ scale: interpolate(iconGlowPulse.value, [0.4, 1], [0.95, 1.1]) }],
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
    width: `${interpolate(progressBar.value, [0, 1], [0, 100])}%` as any,
  }));

  const PORTAL_SIZE = Math.min(width * 0.95, 380);
  const ICON_SIZE = width * 0.28;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootAnimatedStyle]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── 1. Cosmic Aurora Gradient Background ─────────────────────── */}
      <LinearGradient
        colors={[C.bgDeep, C.bgMid, C.bgTop, C.bgDeep]}
        locations={[0, 0.35, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── 2. Ambient Glowing Orbs ─────────────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, orbAnimatedStyle]} pointerEvents="none">
        {/* Top-Right Electric Amber Orb */}
        <View style={styles.ambientOrbTop} />
        {/* Bottom-Left Hyper Indigo Orb */}
        <View style={styles.ambientOrbBottom} />
        {/* Central Core Ambient Glow */}
        <View style={styles.ambientOrbCenter} />
      </Animated.View>

      {/* ── 3. Fullscreen Lottie Starfield & Cosmic Particles ────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LottieView
          ref={particlesLottieRef}
          source={require('../assets/lottie/eventflow-particles.json')}
          autoPlay
          loop
          speed={0.9}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </View>

      {/* ── 4. Main Stage (Pill, Lottie Portal, Logo, Title, Tagline) ── */}
      <View style={styles.stage}>

        {/* ── Modern Category Pill ──────────────────────────────────── */}
        <Animated.View style={[styles.badgeContainer, badgeAnimatedStyle]}>
          <LinearGradient
            colors={['rgba(255,122,0,0.22)', 'rgba(107,95,242,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.badgeGradient}
          >
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>SMART EVENT PLATFORM</Text>
          </LinearGradient>
        </Animated.View>

        {/* ── Hero Center: Lottie Energy Portal + App Icon Card ──────── */}
        <View style={[styles.heroCenter, { width: PORTAL_SIZE, height: PORTAL_SIZE }]}>
          {/* Lottie Concentric Energy Gyro Portal */}
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

          {/* Central App Icon with Multi-layer Glow */}
          <View style={styles.iconCenterWrapper}>
            {/* Outer Soft Ambient Glow */}
            <Animated.View
              style={[
                styles.iconNeonAuraOuter,
                { width: ICON_SIZE + 50, height: ICON_SIZE + 50, borderRadius: (ICON_SIZE + 50) / 2 },
                iconGlowAnimatedStyle,
              ]}
            />
            {/* Inner Intense Orange Flare */}
            <Animated.View
              style={[
                styles.iconNeonAuraInner,
                { width: ICON_SIZE + 24, height: ICON_SIZE + 24, borderRadius: (ICON_SIZE + 24) / 2 },
                iconGlowAnimatedStyle,
              ]}
            />

            {/* Premium Icon Card with Rounded Glass Effect */}
            <Animated.View style={[styles.iconCard, { width: ICON_SIZE, height: ICON_SIZE }, iconAnimatedStyle]}>
              <LinearGradient
                colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.05)']}
                style={styles.iconCardBorder}
              >
                <View style={styles.iconInnerFrame}>
                  <Image
                    source={require('../assets/images/icon_squared.png')}
                    style={styles.iconImage}
                    resizeMode="cover"
                  />
                </View>
              </LinearGradient>
            </Animated.View>
          </View>
        </View>

        {/* ── Brand Typography: Title ───────────────────────────────── */}
        <Animated.View style={[styles.brandTitleWrapper, titleAnimatedStyle]}>
          <Text style={styles.brandTitleText}>
            <Text style={styles.brandTitleWhite}>Event</Text>
            <Text style={styles.brandTitleOrange}>Flow</Text>
          </Text>
          <View style={styles.sparkleIcon}>
            <Text style={styles.sparkleText}>✦</Text>
          </View>
        </Animated.View>

        {/* ── Tagline & Status Dots ─────────────────────────────────── */}
        <Animated.View style={[styles.taglineWrapper, tagAnimatedStyle]}>
          <Text style={styles.taglineText}>Plan  •  Focus  •  Achieve</Text>
          <View style={styles.stepDotsRow}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={[styles.stepDot, statusIndex >= 1 && styles.stepDotActive]} />
            <View style={[styles.stepDot, statusIndex >= 2 && styles.stepDotActive]} />
          </View>
        </Animated.View>

      </View>

      {/* ── 5. Cyber Loader Section (Lottie Beam + Bar + Status) ─────── */}
      <Animated.View style={[styles.loaderSection, loaderSectionAnimatedStyle]}>
        {/* Lottie Cyber Beam Scanner */}
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

        {/* Progress Track with Gradient Fill */}
        <View style={styles.progressBarTrack}>
          <Animated.View style={[styles.progressBarFill, progressFillAnimatedStyle]}>
            <LinearGradient
              colors={[C.indigoBright, C.orangeGlow, C.orange]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        {/* Dynamic Status Text & Version */}
        <View style={styles.statusFooterRow}>
          <Text style={styles.statusStepText}>{STATUS_STEPS[statusIndex]}</Text>
          <Text style={styles.versionText}>v1.0.0 • PRO</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Stylesheet ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgDeep,
  },

  // Ambient Glowing Orbs
  ambientOrbTop: {
    position: 'absolute',
    top: -width * 0.25,
    right: -width * 0.15,
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: (width * 0.85) / 2,
    backgroundColor: C.orange,
    opacity: 0.14,
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: -width * 0.3,
    left: -width * 0.2,
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: (width * 0.9) / 2,
    backgroundColor: C.indigoBright,
    opacity: 0.12,
  },
  ambientOrbCenter: {
    position: 'absolute',
    top: height * 0.32,
    left: width * 0.2,
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: (width * 0.6) / 2,
    backgroundColor: C.orangeGlow,
    opacity: 0.08,
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
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
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
    color: C.orangeGlow,
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
    backgroundColor: C.orangeDeep,
    opacity: 0.2,
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 28,
    elevation: 24,
  },
  iconCardBorder: {
    flex: 1,
    padding: 1.5,
    borderRadius: 28,
  },
  iconInnerFrame: {
    flex: 1,
    borderRadius: 26.5,
    overflow: 'hidden',
    backgroundColor: '#0D0D1F',
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
    marginBottom: 8,
  },
  brandTitleText: {
    fontSize: 46,
    lineHeight: 54,
    letterSpacing: -1,
    textShadowColor: 'rgba(255, 122, 0, 0.55)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
  },
  brandTitleWhite: {
    fontFamily: 'Poppins_800ExtraBold',
    color: C.white,
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
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Tagline & Step Dots
  taglineWrapper: {
    alignItems: 'center',
    gap: 16,
  },
  taglineText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: C.slate,
    letterSpacing: 3,
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
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  stepDotActive: {
    width: 20,
    backgroundColor: C.orange,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 3,
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
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
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
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    color: C.slate,
    letterSpacing: 1.5,
  },
  versionText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.28)',
    letterSpacing: 1.5,
  },
});
