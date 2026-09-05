export type ColorTheme = {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryLight: string;
  secondary: string;
  secondaryLight: string;
  border: string;
  error: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  dangerLight: string;
  icon: string;
  iconActive: string;
  inputBackground: string;
  tabBar: string;
  divider: string;
  surface: string;
};

export const lightTheme: ColorTheme = {
  background: '#FFF5EA',
  card: '#FFFFFF',
  text: '#182235',
  textSecondary: '#667085',
  primary: '#4B3FDC',
  primaryLight: '#EDEAFD',
  secondary: '#FF7A00',
  secondaryLight: '#FFF0E5',
  border: '#F0EBE4',
  error: '#EF4444',
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF9C3',
  dangerLight: '#FEE2E2',
  icon: '#667085',
  iconActive: '#182235',
  inputBackground: '#F5F7FA',
  tabBar: '#FFFFFF',
  divider: '#F5F0EB',
  surface: '#F5F7FA',
};

export const darkTheme: ColorTheme = {
  background: '#121212',
  card: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#A0AABF',
  primary: '#6B5FF2',
  primaryLight: '#2A245C',
  secondary: '#FF9433',
  secondaryLight: '#3A200B',
  border: '#2C2C2C',
  error: '#F87171',
  success: '#34D399',
  successLight: '#064E3B',
  warning: '#FBBF24',
  warningLight: '#78350F',
  dangerLight: '#7F1D1D',
  icon: '#9CA3AF',
  iconActive: '#FFFFFF',
  inputBackground: '#262626',
  tabBar: '#181818',
  divider: '#242424',
  surface: '#252525',
};

export const Theme = {
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16, // Inputs
    xl: 20, // Cards
    button: 18,
    full: 9999,
  },
  borders: {
    thick: 2, // Cards, Buttons, Inputs
    medium: 1.5, // Badges, Chips
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 48,
  },
  shadows: {
    // Modern Neo-Brutalist soft shadows
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 0,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 0,
      elevation: 5,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 0,
      elevation: 8,
    },
  },
};
