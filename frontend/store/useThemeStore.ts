import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorTheme, lightTheme, darkTheme } from '../constants/theme';
import { Appearance } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  getColors: () => ColorTheme;
  isDark: () => boolean;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      setMode: (mode: ThemeMode) => set({ mode }),
      isDark: () => {
        const { mode } = get();
        if (mode === 'system') {
          return Appearance.getColorScheme() === 'dark';
        }
        return mode === 'dark';
      },
      getColors: () => {
        return get().isDark() ? darkTheme : lightTheme;
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
