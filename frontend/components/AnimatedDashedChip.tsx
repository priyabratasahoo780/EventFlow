import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface AnimatedDashedChipProps {
  isActive: boolean;
  activeBorderColor: string;
  inactiveBorderColor: string;
  activeBackgroundColor: string;
  inactiveBackgroundColor: string;
  borderRadius?: number;
  onPress: () => void;
  children: React.ReactNode;
}

/**
 * Category pill with a razor-sharp SVG dashed border and continuous
 * marching-ants animation on the active pill.
 */
export default function AnimatedDashedChip({
  isActive,
  activeBorderColor,
  inactiveBorderColor,
  activeBackgroundColor,
  inactiveBackgroundColor,
  borderRadius = 14,
  onPress,
  children,
}: AnimatedDashedChipProps) {
  const [dim, setDim] = useState({ w: 0, h: 0 });
  const dashOffset = useSharedValue(0);

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(dashOffset);
      dashOffset.value = 0;
      return;
    }

    dashOffset.value = 0;
    // Period matches strokeDasharray="6 4" (10px -> -20 = -2 full periods) for a seamless loop
    dashOffset.value = withRepeat(
      withTiming(-20, { duration: 1300, easing: Easing.linear }),
      -1,
      false
    );

    return () => {
      cancelAnimation(dashOffset);
    };
  }, [isActive, dashOffset]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - dim.w) > 0.25 || Math.abs(height - dim.h) > 0.25) {
      setDim({ w: width, h: height });
    }
  };

  const animRectProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const strokeWidth = isActive ? 1.65 : 1.4;
  const inset = strokeWidth / 2 + 0.25;
  const svgRadius = Math.max(0, borderRadius - inset);
  const hasSvg = dim.w > 0 && dim.h > 0;
  const borderColor = isActive ? activeBorderColor : inactiveBorderColor;
  const backgroundColor = isActive ? activeBackgroundColor : inactiveBackgroundColor;
  const rectProps = {
    x: inset,
    y: inset,
    width: Math.max(0, dim.w - inset * 2),
    height: Math.max(0, dim.h - inset * 2),
    rx: svgRadius,
    ry: svgRadius,
    stroke: borderColor,
    strokeWidth,
    strokeDasharray: '6 4',
    fill: 'none',
  };

  return (
    <Pressable
      onLayout={onLayout}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          borderRadius,
          backgroundColor,
        },
        pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
      ]}
    >
      {hasSvg && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 2 }]}>
          <Svg width={dim.w} height={dim.h}>
            {isActive ? (
              <AnimatedRect {...rectProps} animatedProps={animRectProps} />
            ) : (
              <Rect {...rectProps} />
            )}
          </Svg>
        </View>
      )}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13.5,
    paddingVertical: 8.5,
    position: 'relative',
  },
});
