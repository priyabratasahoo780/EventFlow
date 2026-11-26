import { useMemo } from 'react';
import { Dimensions, PixelRatio, useWindowDimensions, ViewStyle } from 'react-native';

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function computeResponsiveMetrics(width: number, height: number) {
  const safeWidth = Math.max(width, 320);
  const safeHeight = Math.max(height, 480);
  const shortestSide = Math.min(safeWidth, safeHeight);
  const isLandscape = safeWidth > safeHeight;
  const isTablet = shortestSide >= 600 || safeWidth >= 768;
  const isDesktop = safeWidth >= 1024;
  const isSmall = safeWidth < 360;
  const isMedium = safeWidth >= 360 && safeWidth < 430;
  const isLarge = safeWidth >= 430;

  // Clamp scale so ultra-small phones stay readable and tablets/desktop don't bloat UI
  const widthScale = clamp(safeWidth / BASE_WIDTH, 0.85, isTablet ? 1.18 : 1.12);
  const heightScale = clamp(safeHeight / BASE_HEIGHT, 0.85, 1.15);

  const rs = (size: number): number =>
    Math.round(PixelRatio.roundToNearestPixel(size * widthScale));

  const hs = (size: number): number =>
    Math.round(PixelRatio.roundToNearestPixel(size * heightScale));

  const ms = (size: number, factor = 0.45): number =>
    Math.round(PixelRatio.roundToNearestPixel(size + (size * widthScale - size) * factor));

  const contentMaxWidth = isDesktop ? 880 : isTablet ? 720 : safeWidth;
  const authMaxWidth = isTablet ? 480 : safeWidth;
  const modalMaxWidth = clamp(safeWidth - 32, 280, isTablet ? 520 : 440);
  const horizontalPadding = isTablet ? 24 : isSmall ? 12 : 16;
  const gridColumns = isTablet ? (isLandscape ? 4 : 3) : 2;

  const containerStyle: ViewStyle = {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
  };

  return {
    width: safeWidth,
    height: safeHeight,
    shortestSide,
    isSmall,
    isMedium,
    isLarge,
    isTablet,
    isDesktop,
    isLandscape,
    widthScale,
    heightScale,
    contentMaxWidth,
    authMaxWidth,
    modalMaxWidth,
    horizontalPadding,
    gridColumns,
    containerStyle,
    rs,
    hs,
    ms,
  };
}

// Initial static helpers (clamped safely for StyleSheet initialization & backwards compatibility)
const initialWin = Dimensions.get('window');
const initialMetrics = computeResponsiveMetrics(initialWin.width, initialWin.height);

export const rs = initialMetrics.rs;
export const hs = initialMetrics.hs;
export const ms = initialMetrics.ms;

export const SCREEN = {
  width: initialMetrics.width,
  height: initialMetrics.height,
  isSmall: initialMetrics.isSmall,
  isMedium: initialMetrics.isMedium,
  isLarge: initialMetrics.isLarge,
  isTablet: initialMetrics.isTablet,
};

/**
 * Live reactive responsive hook updating automatically on rotation,
 * foldable unfold, split-screen, and window resizing.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => computeResponsiveMetrics(width, height), [width, height]);
}
