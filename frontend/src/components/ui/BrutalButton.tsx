import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import React from 'react';
import { Pressable, Text, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

interface BrutalButtonProps {
  title?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  children?: React.ReactNode;
  color?: string;
  style?: StyleProp<ViewStyle>;
  shadowOffset?: number;
}

export default function BrutalButton({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  children,
  color,
  style,
}: BrutalButtonProps) {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const bgColor = color || (
    variant === 'danger'
      ? colors.error
      : variant === 'secondary'
      ? colors.primary
      : colors.secondary
  );

  return (
    <Pressable
      onPress={() => {
        if (!disabled) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bgColor },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style, // <--- Add the passed style here
      ]}
    >
      <View style={styles.inner}>
        {children}
        <Text style={styles.text}>{title}</Text>
      </View>
    </Pressable>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  btn: {
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 4,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: colors.card,
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
});
