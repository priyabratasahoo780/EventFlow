import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base design is on a 390px wide screen (iPhone 14 / Pixel 7)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

const widthScale = SCREEN_WIDTH / BASE_WIDTH;
const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;

/** Scale proportionally to screen width. Use for horizontal sizes, fonts, icons, padding. */
export function rs(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * widthScale));
}

/** Scale proportionally to screen height. Use for vertical dimensions like banner heights. */
export function hs(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * heightScale));
}

/** Moderately scale — less aggressive than full proportional scaling. */
export function ms(size: number, factor = 0.5): number {
  return Math.round(PixelRatio.roundToNearestPixel(size + (size * widthScale - size) * factor));
}

export const SCREEN = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmall: SCREEN_WIDTH < 360,
  isMedium: SCREEN_WIDTH >= 360 && SCREEN_WIDTH < 414,
  isLarge: SCREEN_WIDTH >= 414,
};
