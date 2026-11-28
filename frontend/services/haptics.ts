import * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

/** Triggers impact haptic feedback without rejecting when the native Haptic module is unavailable. */
export async function impactAsync(
  style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Medium
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await ExpoHaptics.impactAsync(style);
  } catch {
    // Ignore UnavailabilityError when native ExpoHaptics is not linked or supported
  }
}

/** Triggers notification haptic feedback without rejecting when the native Haptic module is unavailable. */
export async function notificationAsync(
  type: ExpoHaptics.NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType.Success
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await ExpoHaptics.notificationAsync(type);
  } catch {
    // Ignore UnavailabilityError when native ExpoHaptics is not linked or supported
  }
}

/** Triggers selection haptic feedback without rejecting when the native Haptic module is unavailable. */
export async function selectionAsync(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await ExpoHaptics.selectionAsync();
  } catch {
    // Ignore UnavailabilityError when native ExpoHaptics is not linked or supported
  }
}
