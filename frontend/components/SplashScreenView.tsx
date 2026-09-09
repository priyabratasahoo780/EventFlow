/**
 * SplashScreenView.tsx — EventFlow Premium Splash
 * ══════════════════════════════════════════════════════════
 *
 *  Fully theme-accurate animated splash for EventFlow.
 *  Matches the brand exactly:
 *    • Orange #FF7A00 / #FF5C00  — primary action / energy
 *    • Indigo #4B3FDC / #6B5FF2  — AI / secondary
 *    • Background #1a1a2e / #0d0d1f — deep brand dark
 *    • Font: Poppins (800 ExtraBold for brand, 500 Medium for tagline)
 *    • Actual app icon: assets/images/icon_squared.png
 *    • Tagline: "Plan • Focus • Achieve"
 *
 *  Animations (all via react-native-reanimated):
 *    ① Background gradient fade in
 *    ② Ambient orbs: orange top-right, indigo bottom-left
 *    ③ 14 floating star particles (orange + indigo + white)
 *    ④ 3 orbital rings:
 *         - Outer  : thin white/gray slow rotate
 *         - Middle : dashed indigo faster rotate
 *         - Inner  : solid orange neon glow, pulse
 *    ⑤ App icon: spring zoom-in + persistent glow pulse
 *    ⑥ Brand title "EventFlow": slide-up + fade
 *    ⑦ Tagline "Plan • Focus • Achieve": slide-up + fade (delayed)
 *    ⑧ Loading bar: fade-in then animated fill with shimmer tip
 *    ⑨ Full-screen smooth fade-out triggered by isReady=true
 *
 *  Props:
 *    isReady  — set true when fonts+auth are loaded → starts exit
 *    onFinish — called after exit animation → unmount / navigate
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// ─── Brand Design Tokens (exact from theme.ts / Colors.ts) ───────────────────
const C = {
  orange:     '#FF7A00',
  orangeDeep: '#FF5C00',
  orangeGlow: '#FF9500',
  indigo:     '#4B3FDC',
  indigoDeep: '#3F35C8',
  indigoBright:'#6B5FF2',
  bgDeep:     '#0D0D1F',
  bgMid:      '#1a1a2e',
  bgTop:      '#0F0E24',
  white:      '#FFFFFF',
  slate:      '#94A3B8',
  slateLight: '#CBD5E1',
};

// ─── Star particle data ───────────────────────────────────────────────────────
const STARS = [
  // Cross / sparkle stars — larger
  { x: 0.08, y: 0.10, size: 4,  type: 'cross', color: C.orange,      delay: 0   },
  { x: 0.88, y: 0.06, size: 3,  type: 'cross', color: C.indigoBright, delay: 250 },
  { x: 0.75, y: 0.20, size: 4,  type: 'cross', color: C.orange,      delay: 500 },
  { x: 0.14, y: 0.32, size: 3,  type: 'cross', color: C.white,       delay: 150 },
  { x: 0.92, y: 0.38, size: 4,  type: 'cross', color: C.indigoBright, delay: 700 },
  { x: 0.04, y: 0.58, size: 3,  type: 'cross', color: C.orange,      delay: 320 },
  { x: 0.84, y: 0.63, size: 4,  type: 'cross', color: C.white,       delay: 550 },
  // Dot stars — smaller
  { x: 0.22, y: 0.77, size: 5,  type: 'dot',   color: C.indigoBright, delay: 200 },
  { x: 0.62, y: 0.84, size: 6,  type: 'dot',   color: C.orange,      delay: 800 },
  { x: 0.43, y: 0.91, size: 4,  type: 'dot',   color: C.white,       delay: 100 },
  { x: 0.57, y: 0.15, size: 5,  type: 'dot',   color: C.indigoBright, delay: 380 },
  { x: 0.33, y: 0.48, size: 4,  type: 'dot',   color: C.orange,      delay: 460 },
  { x: 0.78, y: 0.45, size: 5,  type: 'dot',   color: C.white,       delay: 600 },
  { x: 0.49, y: 0.74, size: 4,  type: 'dot',   color: C.indigoBright, delay: 290 },
];

// ─── Star Particle Component ──────────────────────────────────────────────────
function StarParticle({ x, y, size, type, color, delay }: typeof STARS[0]) {
  const floatY  = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.6);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(type === 'cross' ? 0.85 : 0.65, { duration: 900 }));
    scale.value   = withDelay(delay, withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.5)) }));
    floatY.value  = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-8 - size, { duration: 2200 + delay * 0.4, easing: Easing.inOut(Easing.sin) }),
          withTiming( 8 + size, { duration: 2200 + delay * 0.4, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: floatY.value }, { scale: scale.value }],
  }));

  if (type === 'cross') {
    return (
      <Animated.View style={[{ position: 'absolute', left: x * width, top: y * height }, style]}>
        {/* Horizontal bar */}
        <View style={{ width: size * 4, height: size * 0.7, backgroundColor: color, borderRadius: 2, position: 'absolute', top: size * 1.65, left: 0 }} />
        {/* Vertical bar */}
        <View style={{ width: size * 0.7, height: size * 4, backgroundColor: color, borderRadius: 2, position: 'absolute', left: size * 1.65, top: 0 }} />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left:   x * width,
          top:    y * height,
          width:  size,
          height: size,
          borderRadius: size,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

// ─── Dashed Ring (rendered as short arc segments) ────────────────────────────
function DashedRing({ diameter, color, rotate }: { diameter: number; color: string; rotate: SharedValue<number> }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(400, withTiming(1, { duration: 900 }));
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  // Render 24 dash segments
  const dashes = Array.from({ length: 24 });
  const dashAngle = 360 / 24;

  return (
    <Animated.View style={[{ position: 'absolute', width: diameter, height: diameter, borderRadius: diameter / 2 }, containerStyle]}>
      {dashes.map((_, i) => {
        const angle = (i * dashAngle * Math.PI) / 180;
        const r = diameter / 2;
        const cx = r + r * Math.cos(angle);
        const cy = r + r * Math.sin(angle);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width:  10,
              height: 2,
              backgroundColor: color,
              borderRadius: 1,
              left: cx - 5,
              top:  cy - 1,
              transform: [{ rotate: `${i * dashAngle + 90}deg` }],
              opacity: i % 3 === 0 ? 0.9 : 0.35,
            }}
          />
        );
      })}
    </Animated.View>
  );
}

// ─── Solid Orbital Ring ───────────────────────────────────────────────────────
function SolidRing({
  diameter,
  borderColor,
  borderWidth,
  glowColor,
  pulseDelay,
  rotate,
}: {
  diameter: number;
  borderColor: string;
  borderWidth: number;
  glowColor: string;
  pulseDelay?: number;
  rotate?: SharedValue<number>;
}) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(300, withTiming(1, { duration: 800 }));
    scale.value = withDelay(
      pulseDelay ?? 0,
      withRepeat(
        withSequence(
          withTiming(1.035, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
          withTiming(1,     { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, true
      )
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      ...(rotate ? [{ rotate: `${rotate.value}deg` }] : []),
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position:     'absolute',
          width:        diameter,
          height:       diameter,
          borderRadius: diameter / 2,
          borderWidth,
          borderColor,
          shadowColor:  glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.7,
          shadowRadius: 12,
        },
        animStyle,
      ]}
    />
  );
}

// ─── Main Splash Component ────────────────────────────────────────────────────
interface Props {
  isReady?:  boolean;
  onFinish?: () => void;
}

export default function SplashScreenView({ isReady = false, onFinish }: Props) {
  // ── Shared values for rings rotation
  const rotateOuter  = useSharedValue(0);  // outer ring — slow CW
  const rotateDashed = useSharedValue(0);  // dashed indigo — medium CCW
  const rotateInner  = useSharedValue(0);  // inner orange — faster CW

  // ── Logo + text entrance
  const rootOpacity  = useSharedValue(1);
  const iconScale    = useSharedValue(0);
  const iconOpacity  = useSharedValue(0);
  const glowPulse    = useSharedValue(0.5);
  const titleY       = useSharedValue(50);
  const titleOp      = useSharedValue(0);
  const tagY         = useSharedValue(35);
  const tagOp        = useSharedValue(0);
  const barOp        = useSharedValue(0);
  const barProgress  = useSharedValue(0);

  useEffect(() => {
    // ── Ring rotations
    rotateOuter.value = withRepeat(withTiming( 360, { duration: 28000, easing: Easing.linear }), -1, false);
    rotateDashed.value= withRepeat(withTiming(-360, { duration: 18000, easing: Easing.linear }), -1, false);
    rotateInner.value = withRepeat(withTiming( 360, { duration: 12000, easing: Easing.linear }), -1, false);

    // ── Icon spring-zoom
    iconScale.value  = withDelay(250, withTiming(1,   { duration: 750, easing: Easing.out(Easing.back(1.6)) }));
    iconOpacity.value= withDelay(250, withTiming(1,   { duration: 500 }));

    // ── Glow breath
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, true
    );

    // ── Brand name slide-up
    titleY.value = withDelay(620, withTiming(0, { duration: 650, easing: Easing.out(Easing.cubic) }));
    titleOp.value= withDelay(620, withTiming(1, { duration: 650 }));

    // ── Tagline slide-up
    tagY.value  = withDelay(820, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
    tagOp.value = withDelay(820, withTiming(1, { duration: 600 }));

    // ── Progress bar
    barOp.value      = withDelay(950,  withTiming(1, { duration: 350 }));
    barProgress.value= withDelay(1050, withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.cubic) }));
  }, []);

  // ── Exit sequence when app is ready
  useEffect(() => {
    if (!isReady) return;
    barProgress.value = withTiming(1, { duration: 350 }, () => {
      rootOpacity.value = withDelay(200, withTiming(0, { duration: 550 }, () => {
        if (onFinish) runOnJS(onFinish)();
      }));
    });
  }, [isReady]);

  // ── Animated styles
  const rootStyle  = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));
  const iconStyle  = useAnimatedStyle(() => ({ opacity: iconOpacity.value, transform: [{ scale: iconScale.value }] }));
  const glowStyle  = useAnimatedStyle(() => ({ opacity: glowPulse.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOp.value, transform: [{ translateY: titleY.value }] }));
  const tagStyle   = useAnimatedStyle(() => ({ opacity: tagOp.value,   transform: [{ translateY: tagY.value   }] }));
  const barCont    = useAnimatedStyle(() => ({ opacity: barOp.value }));
  const barFill    = useAnimatedStyle(() => ({
    width: `${interpolate(barProgress.value, [0, 1], [0, 100])}%` as any,
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    right: 0,
    opacity: interpolate(barProgress.value, [0, 0.05, 0.95, 1], [0, 1, 1, 0]),
  }));

  const RING_BASE = width * 0.72;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── 1. Background gradient ─────────────────────────────── */}
      <LinearGradient
        colors={[C.bgTop, C.bgMid, C.bgDeep]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── 2. Ambient glow orbs ───────────────────────────────── */}
      <View style={styles.orbOrange} />
      <View style={styles.orbIndigo} />

      {/* ── 3. Floating star particles ─────────────────────────── */}
      {STARS.map((s, i) => <StarParticle key={i} {...s} />)}

      {/* ── 4. Central rings + icon ────────────────────────────── */}
      <View style={styles.centerStage}>

        {/* Ring arena */}
        <View style={[styles.ringArena, { width: RING_BASE, height: RING_BASE }]}>

          {/* Outer: thin white ghost ring */}
          <SolidRing
            diameter={RING_BASE * 0.98}
            borderColor="rgba(255,255,255,0.10)"
            borderWidth={1}
            glowColor="transparent"
            pulseDelay={0}
            rotate={rotateOuter}
          />

          {/* Middle: dashed indigo rotating ring */}
          <DashedRing
            diameter={RING_BASE * 0.76}
            color={C.indigoBright}
            rotate={rotateDashed}
          />

          {/* Inner: solid orange neon ring */}
          <SolidRing
            diameter={RING_BASE * 0.56}
            borderColor={C.orange}
            borderWidth={2}
            glowColor={C.orange}
            pulseDelay={300}
            rotate={rotateInner}
          />

          {/* Icon + glow */}
          <View style={styles.iconArea}>
            {/* Orange ambient glow behind icon */}
            <Animated.View style={[styles.iconGlowOuter, glowStyle]} />
            <Animated.View style={[styles.iconGlowInner, glowStyle]} />

            {/* Actual app icon in superellipse card */}
            <Animated.View style={[styles.iconCard, iconStyle]}>
              <Image
                source={require('../assets/images/icon_squared.png')}
                style={styles.iconImage}
                resizeMode="cover"
              />
            </Animated.View>
          </View>

        </View>

        {/* ── 5. Brand title ─────────────────────────────────────── */}
        <Animated.View style={[styles.brandRow, titleStyle]}>
          <Text style={styles.brandText}>
            <Text style={styles.brandWhite}>Event</Text>
            <Text style={styles.brandOrange}>Flow</Text>
          </Text>
        </Animated.View>

        {/* ── 6. Tagline + dots ──────────────────────────────────── */}
        <Animated.View style={[styles.tagBlock, tagStyle]}>
          <Text style={styles.tagline}>Plan  •  Focus  •  Achieve</Text>
          <View style={styles.dotRow}>
            <View style={[styles.dot, styles.dotOn]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </Animated.View>

      </View>

      {/* ── 7. Loading bar ─────────────────────────────────────────── */}
      <Animated.View style={[styles.barSection, barCont]}>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, barFill]}>
            {/* Gradient fill */}
            <LinearGradient
              colors={[C.orangeGlow, C.orange, C.orangeDeep]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            {/* Glowing tip shimmer */}
            <Animated.View style={[styles.barTip, shimmerStyle]}>
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.8)', 'transparent']}
                style={{ flex: 1 }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </Animated.View>
          </Animated.View>
        </View>
        <Text style={styles.versionLabel}>v1.0.0</Text>
      </Animated.View>

    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ICON_CARD_SIZE = width * 0.30;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgDeep,
  },

  // Ambient orbs
  orbOrange: {
    position:        'absolute',
    width:           width * 0.60,
    height:          width * 0.60,
    top:             -width * 0.18,
    right:           -width * 0.12,
    borderRadius:    width * 0.30,
    backgroundColor: C.orange,
    opacity:         0.07,
  },
  orbIndigo: {
    position:        'absolute',
    width:           width * 0.70,
    height:          width * 0.70,
    bottom:          -width * 0.22,
    left:            -width * 0.18,
    borderRadius:    width * 0.35,
    backgroundColor: C.indigo,
    opacity:         0.10,
  },

  // Central stage
  centerStage: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     height * 0.02,
    gap:            0,
  },

  // Ring arena
  ringArena: {
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   32,
  },

  // Icon
  iconArea: {
    position:       'absolute',
    alignItems:     'center',
    justifyContent: 'center',
  },
  iconGlowOuter: {
    position:        'absolute',
    width:           ICON_CARD_SIZE + 80,
    height:          ICON_CARD_SIZE + 80,
    borderRadius:    (ICON_CARD_SIZE + 80) / 2,
    backgroundColor: C.orange,
    opacity:         0.18,
  },
  iconGlowInner: {
    position:        'absolute',
    width:           ICON_CARD_SIZE + 30,
    height:          ICON_CARD_SIZE + 30,
    borderRadius:    (ICON_CARD_SIZE + 30) / 2,
    backgroundColor: C.orange,
    opacity:         0.28,
  },
  iconCard: {
    width:        ICON_CARD_SIZE,
    height:       ICON_CARD_SIZE,
    borderRadius: ICON_CARD_SIZE * 0.24,   // iOS superellipse-like radius
    overflow:     'hidden',
    // Orange drop shadow
    shadowColor:    C.orange,
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.75,
    shadowRadius:   24,
    elevation:      20,
  },
  iconImage: {
    width:  '100%',
    height: '100%',
  },

  // Brand name
  brandRow: {
    alignItems:   'center',
    marginBottom: 10,
  },
  brandText: {
    fontSize:       48,
    lineHeight:     56,
    letterSpacing:  -1.5,
    // Poppins 800 — text shadow for orange glow
    textShadowColor:  'rgba(255,122,0,0.45)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 14,
  },
  brandWhite: {
    fontFamily: 'Poppins_800ExtraBold',
    color:      C.white,
  },
  brandOrange: {
    fontFamily: 'Poppins_800ExtraBold',
    color:      C.orange,
  },

  // Tagline
  tagBlock: {
    alignItems:   'center',
    gap:          20,
    marginBottom: 0,
  },
  tagline: {
    fontFamily:    'Poppins_500Medium',
    fontSize:      13,
    color:         C.slate,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  dotRow: {
    flexDirection: 'row',
    gap:           8,
    alignItems:    'center',
  },
  dot: {
    width:           10,
    height:          4,
    borderRadius:    3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotOn: {
    width:           22,
    backgroundColor: C.orange,
    shadowColor:     C.orange,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.9,
    shadowRadius:    8,
    elevation:       5,
  },

  // Loading bar section
  barSection: {
    paddingHorizontal: 44,
    paddingBottom:     height * 0.08,
    gap:               12,
    alignItems:        'center',
  },
  barTrack: {
    width:           '100%',
    height:          3,
    borderRadius:    3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow:        'hidden',
  },
  barFill: {
    height:       '100%',
    borderRadius: 3,
    overflow:     'hidden',
  },
  barTip: {
    position:     'absolute',
    top:          -2,
    bottom:       -2,
    width:        24,
    borderRadius: 4,
  },
  versionLabel: {
    fontFamily:    'Poppins_400Regular',
    fontSize:      10,
    color:         'rgba(255,255,255,0.22)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
