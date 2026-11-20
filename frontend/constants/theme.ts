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
  background: '#0B0F19',
  card: '#151C28',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  primary: '#6B5FF2',
  primaryLight: 'rgba(107, 95, 242, 0.18)',
  secondary: '#FF9433',
  secondaryLight: 'rgba(255, 148, 51, 0.14)',
  border: '#222B3D',
  error: '#F87171',
  success: '#34D399',
  successLight: 'rgba(52, 211, 153, 0.14)',
  warning: '#FBBF24',
  warningLight: 'rgba(251, 191, 36, 0.14)',
  dangerLight: 'rgba(248, 113, 113, 0.14)',
  icon: '#94A3B8',
  iconActive: '#FFFFFF',
  inputBackground: '#1A2234',
  tabBar: '#0E1422',
  divider: '#1E273A',
  surface: '#1A2234',
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
