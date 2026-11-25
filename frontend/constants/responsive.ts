import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');


const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

const widthScale = SCREEN_WIDTH / BASE_WIDTH;
const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;


export function rs(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * widthScale));
}
export function hs(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * heightScale));
}

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
