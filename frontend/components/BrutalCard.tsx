import { useThemeStore } from '../store/useThemeStore';
import { ColorTheme } from '../constants/theme';
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface BrutalCardProps {
  children: React.ReactNode;
  color?: string;
  shadowOffset?: number;
  style?: ViewStyle | ViewStyle[];
}

export default function BrutalCard({
  children,
  color,
  shadowOffset = 3,
  style,
}: BrutalCardProps) {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: color || colors.card,
          shadowOffset: { width: 0, height: shadowOffset },
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: colors.secondary,
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
});
