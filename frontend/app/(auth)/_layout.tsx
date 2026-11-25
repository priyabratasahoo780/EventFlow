import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useThemeStore } from '../../store/useThemeStore';

export default function AuthLayout() {
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();

  return (
    <>
      <StatusBar style={isDark() ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}
