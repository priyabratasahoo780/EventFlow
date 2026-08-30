import { useColorScheme } from '../components/useColorScheme';
import { Colors } from '../constants/Colors';

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  return {
    colorScheme,
    isDark,
    colors,
  };
}
