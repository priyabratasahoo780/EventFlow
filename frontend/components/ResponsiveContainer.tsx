import React from 'react';
import { View, ViewProps, ViewStyle } from 'react-native';
import { useResponsive } from '../constants/responsive';

interface ResponsiveContainerProps extends ViewProps {
  variant?: 'content' | 'auth' | 'wide';
  style?: ViewStyle | ViewStyle[];
}

/**
 * Centers content cleanly with an adaptive maxWidth on tablets, foldables, and desktop web
 * while staying full-width on mobile phones.
 */
export default function ResponsiveContainer({
  children,
  variant = 'content',
  style,
  ...rest
}: ResponsiveContainerProps) {
  const { authMaxWidth, contentMaxWidth, isDesktop, isTablet } = useResponsive();
  const maxWidth =
    variant === 'auth'
      ? authMaxWidth
      : variant === 'wide'
        ? (isDesktop ? 1040 : isTablet ? 780 : contentMaxWidth)
        : contentMaxWidth;

  return (
    <View
      style={[{ width: '100%', maxWidth, alignSelf: 'center' }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}
