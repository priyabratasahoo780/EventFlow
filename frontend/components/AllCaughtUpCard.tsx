import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Plus, Sparkles } from 'lucide-react-native';
import { ColorTheme } from '../constants/theme';
import { useResponsive } from '../constants/responsive';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface AllCaughtUpCardProps {
  colors: ColorTheme;
  onPlanNewTask: () => void;
  festivalContent?: React.ReactNode;
}

/**
 * Empty-state hero card ("All Caught Up!") with multi-layer 60fps UI-thread
 * floating animations, a levitation ground shadow, orbiting sparkle accents,
 * and an animated flowing SVG dashed border.
 */
export default function AllCaughtUpCard({
  colors,
  onPlanNewTask,
  festivalContent,
}: AllCaughtUpCardProps) {
  const { rs, ms } = useResponsive();
  const [dim, setDim] = useState({ w: 0, h: 0 });

  // Multi-phase UI-thread shared values (sinusoidal oscillations for organic float)
  const cardFloat = useSharedValue(0);
  const outerPhase = useSharedValue(0);
  const midPhase = useSharedValue(0);
  const orbPhase = useSharedValue(0);
  const orbSway = useSharedValue(0);
  const iconPhase = useSharedValue(0);
  const particleAPhase = useSharedValue(0);
  const particleBPhase = useSharedValue(0);
  const particleCPhase = useSharedValue(0);
  const titlePhase = useSharedValue(0);
  const dashFlowOffset = useSharedValue(0);

  useEffect(() => {
    const sine = Easing.inOut(Easing.sin);

    cardFloat.value = withRepeat(
      withTiming(1, { duration: 2500, easing: sine }),
      -1,
      true
    );

    outerPhase.value = withRepeat(
      withTiming(1, { duration: 2100, easing: sine }),
      -1,
      true
    );

    midPhase.value = withDelay(
      220,
      withRepeat(withTiming(1, { duration: 1850, easing: sine }), -1, true)
    );

    orbPhase.value = withRepeat(
      withTiming(1, { duration: 1550, easing: sine }),
      -1,
      true
    );

    orbSway.value = withRepeat(
      withTiming(1, { duration: 2900, easing: sine }),
      -1,
      true
    );

    iconPhase.value = withDelay(
      140,
      withRepeat(withTiming(1, { duration: 1400, easing: sine }), -1, true)
    );

    particleAPhase.value = withRepeat(
      withTiming(1, { duration: 1950, easing: sine }),
      -1,
      true
    );

    particleBPhase.value = withDelay(
      320,
      withRepeat(withTiming(1, { duration: 2350, easing: sine }), -1, true)
    );

    particleCPhase.value = withDelay(
      560,
      withRepeat(withTiming(1, { duration: 2650, easing: sine }), -1, true)
    );

    titlePhase.value = withDelay(
      180,
      withRepeat(withTiming(1, { duration: 2400, easing: sine }), -1, true)
    );

    // Seamless loop matching dashArray="8 6" (period 14 -> -28 = -2 periods)
    dashFlowOffset.value = withRepeat(
      withTiming(-28, { duration: 2200, easing: Easing.linear }),
      -1,
      false
    );

    return () => {
      cancelAnimation(cardFloat);
      cancelAnimation(outerPhase);
      cancelAnimation(midPhase);
      cancelAnimation(orbPhase);
      cancelAnimation(orbSway);
      cancelAnimation(iconPhase);
      cancelAnimation(particleAPhase);
      cancelAnimation(particleBPhase);
      cancelAnimation(particleCPhase);
      cancelAnimation(titlePhase);
      cancelAnimation(dashFlowOffset);
    };
  }, [
    cardFloat,
    outerPhase,
    midPhase,
    orbPhase,
    orbSway,
    iconPhase,
    particleAPhase,
    particleBPhase,
    particleCPhase,
    titlePhase,
    dashFlowOffset,
  ]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const w = Math.round(width);
    const h = Math.round(height);
    if (Math.abs(w - dim.w) > 1 || Math.abs(h - dim.h) > 1) {
      setDim({ w, h });
    }
  };

  const cardFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(cardFloat.value, [0, 1], [2, -3]) }],
  }));

  const outerRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(outerPhase.value, [0, 1], [0.82, 1]),
    transform: [
      { translateY: interpolate(outerPhase.value, [0, 1], [2, -3]) },
      { scale: interpolate(outerPhase.value, [0, 1], [0.98, 1.05]) },
    ],
  }));

  const midRingStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(midPhase.value, [0, 1], [1, -3]) },
      { scale: interpolate(midPhase.value, [0, 1], [0.99, 1.03]) },
    ],
  }));

  const innerOrbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(orbPhase.value, [0, 1], [2, -6]) },
      { scale: interpolate(orbPhase.value, [0, 1], [0.99, 1.03]) },
      { rotate: `${interpolate(orbSway.value, [0, 1], [-2.5, 2.5])}deg` },
    ],
  }));

  const iconFloatStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(iconPhase.value, [0, 1], [0.96, 1.06]) },
      { rotate: `${interpolate(iconPhase.value, [0, 1], [-4, 4])}deg` },
    ],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(orbPhase.value, [0, 1], [0.22, 0.06]),
    transform: [{ scaleX: interpolate(orbPhase.value, [0, 1], [1.08, 0.72]) }],
  }));

  const particleAStyle = useAnimatedStyle(() => ({
    opacity: interpolate(particleAPhase.value, [0, 1], [0.45, 0.95]),
    transform: [
      { translateY: interpolate(particleAPhase.value, [0, 1], [5, -7]) },
      { translateX: interpolate(particleAPhase.value, [0, 1], [-2, 2]) },
      { rotate: `${interpolate(particleAPhase.value, [0, 1], [-12, 12])}deg` },
    ],
  }));

  const particleBStyle = useAnimatedStyle(() => ({
    opacity: interpolate(particleBPhase.value, [0, 1], [0.35, 0.78]),
    transform: [
      { translateY: interpolate(particleBPhase.value, [0, 1], [-6, 5]) },
      { scale: interpolate(particleBPhase.value, [0, 1], [0.85, 1.2]) },
    ],
  }));

  const particleCStyle = useAnimatedStyle(() => ({
    opacity: interpolate(particleCPhase.value, [0, 1], [0.3, 0.72]),
    transform: [
      { translateY: interpolate(particleCPhase.value, [0, 1], [4, -6]) },
      { scale: interpolate(particleCPhase.value, [0, 1], [0.88, 1.15]) },
    ],
  }));

  const titleFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(titlePhase.value, [0, 1], [1.5, -2.5]) }],
  }));

  const dashAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashFlowOffset.value,
  }));

  const cardRadius = rs(32);
  const strokeWidth = 1.5;
  const half = strokeWidth / 2;
  const hasSvgFrame = dim.w > 0 && dim.h > 0;

  return (
    <View style={{ paddingHorizontal: rs(16), marginBottom: rs(20), paddingTop: rs(10) }}>
      <Animated.View style={cardFloatStyle}>
        <View
          onLayout={onLayout}
          style={{
            borderRadius: cardRadius,
            position: 'relative',
            borderWidth: hasSvgFrame ? 0 : strokeWidth,
            borderColor: `${colors.secondary}40`,
            borderStyle: 'dashed',
          }}
        >
          {hasSvgFrame && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 2 }]}>
              <Svg width={dim.w} height={dim.h}>
                <AnimatedRect
                  x={half}
                  y={half}
                  width={Math.max(0, dim.w - strokeWidth)}
                  height={Math.max(0, dim.h - strokeWidth)}
                  rx={cardRadius}
                  ry={cardRadius}
                  stroke={`${colors.secondary}55`}
                  strokeWidth={strokeWidth}
                  strokeDasharray="8 6"
                  fill="none"
                  animatedProps={dashAnimatedProps}
                />
              </Svg>
            </View>
          )}

          <LinearGradient
            colors={[`${colors.secondary}15`, `${colors.secondary}05`, colors.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              alignItems: 'center',
              paddingVertical: festivalContent ? rs(24) : rs(40),
              borderRadius: cardRadius,
              paddingHorizontal: rs(20),
              overflow: 'hidden',
            }}
          >
            {festivalContent ? (
              festivalContent
            ) : (
              <>
                {/* Floating concentric orb stage with orbiting sparkle accents */}
                <View
                  style={{
                    width: rs(164),
                    height: rs(156),
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'visible',
                  }}
                >
                  {/* Floating mini sparkle (top-left) */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      {
                        position: 'absolute',
                        top: rs(10),
                        left: rs(8),
                        zIndex: 3,
                      },
                      particleAStyle,
                    ]}
                  >
                    <Sparkles color={colors.secondary} size={rs(14)} strokeWidth={2.2} />
                  </Animated.View>

                  {/* Floating warm dot (top-right) */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      {
                        position: 'absolute',
                        top: rs(16),
                        right: rs(10),
                        width: rs(8),
                        height: rs(8),
                        borderRadius: rs(4),
                        backgroundColor: colors.secondary,
                        zIndex: 3,
                      },
                      particleBStyle,
                    ]}
                  />

                  {/* Floating warm dot (bottom-left) */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      {
                        position: 'absolute',
                        bottom: rs(18),
                        left: rs(14),
                        width: rs(6),
                        height: rs(6),
                        borderRadius: rs(3),
                        backgroundColor: colors.secondary,
                        zIndex: 3,
                      },
                      particleCStyle,
                    ]}
                  />

                  {/* Outer orange glow ring */}
                  <Animated.View
                    style={[
                      {
                        width: rs(130),
                        height: rs(130),
                        borderRadius: rs(65),
                        backgroundColor: `${colors.secondary}22`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                      outerRingStyle,
                    ]}
                  >
                    {/* Mid orange ring */}
                    <Animated.View
                      style={[
                        {
                          width: rs(104),
                          height: rs(104),
                          borderRadius: rs(52),
                          backgroundColor: `${colors.secondary}18`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                        midRingStyle,
                      ]}
                    >
                      {/* Inner white circle with icon */}
                      <Animated.View
                        style={[
                          {
                            width: rs(76),
                            height: rs(76),
                            borderRadius: rs(38),
                            backgroundColor: colors.card,
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: colors.secondary,
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.22,
                            shadowRadius: 16,
                            elevation: 10,
                          },
                          innerOrbStyle,
                        ]}
                      >
                        <Animated.View style={iconFloatStyle}>
                          <Sparkles color={colors.secondary} size={rs(36)} strokeWidth={2} />
                        </Animated.View>
                      </Animated.View>
                    </Animated.View>
                  </Animated.View>
                </View>

                {/* Dynamic levitation ground shadow */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      width: rs(60),
                      height: rs(7),
                      borderRadius: rs(4),
                      backgroundColor: colors.secondary,
                      marginTop: rs(2),
                      marginBottom: rs(16),
                    },
                    shadowStyle,
                  ]}
                />

                <Animated.View style={titleFloatStyle}>
                  <Text
                    style={{
                      fontFamily: 'Poppins_700Bold',
                      fontSize: ms(24),
                      marginBottom: rs(8),
                      color: colors.secondary,
                      letterSpacing: -0.5,
                      textAlign: 'center',
                    }}
                  >
                    All Caught Up! 🎉
                  </Text>
                </Animated.View>

                <Text
                  style={{
                    fontFamily: 'Poppins_400Regular',
                    fontSize: ms(15),
                    textAlign: 'center',
                    paddingHorizontal: rs(20),
                    lineHeight: ms(22),
                    color: colors.textSecondary,
                  }}
                >
                  You&apos;ve conquered your list. Take a breather or plan your next move!
                </Text>
              </>
            )}

            <Pressable
              style={({ pressed }) => [
                {
                  marginTop: rs(24),
                  backgroundColor: colors.secondary,
                  paddingHorizontal: rs(28),
                  paddingVertical: rs(16),
                  borderRadius: rs(20),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: rs(10),
                  shadowColor: colors.secondary,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 8,
                },
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
              onPress={onPlanNewTask}
            >
              <Plus color="#FFF" size={rs(20)} strokeWidth={3} />
              <Text
                style={{
                  fontFamily: 'Poppins_800ExtraBold',
                  fontSize: ms(14),
                  color: '#FFF',
                  letterSpacing: 0.8,
                }}
              >
                PLAN NEW TASK
              </Text>
            </Pressable>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
}
