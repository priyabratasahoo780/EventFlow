import { Tabs, useRouter, usePathname } from 'expo-router';
import { Home, Calendar, PieChart, Settings, User, Plus } from 'lucide-react-native';
import { StyleSheet, View, Pressable, Animated, ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Animated Tab Icon ────────────────────────────────────────────────────────
function AnimatedTabIcon({
  Icon,
  color,
  focused,
  activeColor,
  isDark,
  size = 22,
}: {
  Icon: any;
  color: ColorValue;
  focused: boolean;
  activeColor: string;
  isDark: boolean;
  size?: number;
}) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1.15 : 1)).current;
  const glowAnim  = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const bgAnim    = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.18 : 1,
        useNativeDriver: true,
        tension: 200,
        friction: 12,
      }),
      Animated.timing(glowAnim, {
        toValue: focused ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(bgAnim, {
        toValue: focused ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused]);

  // Pill opacity — more visible in dark mode
  const pillOpacity = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isDark ? 0.22 : 0.12],
  });

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 36,
      }}
    >
      {/* Glowing pill highlight behind active icon */}
      <Animated.View
        style={{
          position: 'absolute',
          width: 48,
          height: 32,
          borderRadius: 16,
          backgroundColor: activeColor,
          opacity: pillOpacity,
        }}
      />

      <Icon color={color} size={size} strokeWidth={focused ? 2.5 : 2} />

      {focused && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: -6,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: activeColor,
            opacity: glowAnim,
            // Coloured glow dot in dark mode
            shadowColor: activeColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: isDark ? 0.9 : 0,
            shadowRadius: 6,
          }}
        />
      )}
    </Animated.View>
  );
}

// ─── Animated FAB ─────────────────────────────────────────────────────────────
function AnimatedFAB({
  onPress,
  colors,
  isDark,
}: {
  onPress: () => void;
  colors: ColorTheme;
  isDark: boolean;
}) {
  const scaleAnim    = useRef(new Animated.Value(1)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.65, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0,                        duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: isDark ? 0.45 : 0.3,     duration: 1200, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isDark]);

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true, tension: 300, friction: 10 }).start();

  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();

  const gradientEnd = isDark ? '#C04A00' : '#E05500';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 64, height: 64 }}>
      {/* Pulse ring */}
      <Animated.View
        style={{
          position: 'absolute',
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.secondary,
          transform: [{ scale: pulseAnim }],
          opacity: pulseOpacity,
        }}
      />
      {/* FAB button */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            overflow: 'hidden',
            shadowColor: colors.secondary,
            shadowOffset: { width: 0, height: isDark ? 8 : 6 },
            shadowOpacity: isDark ? 0.75 : 0.5,
            shadowRadius: isDark ? 20 : 14,
            elevation: isDark ? 18 : 12,
          }}
        >
          <LinearGradient
            colors={[colors.secondary, gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus color="#FFFFFF" size={26} strokeWidth={3} />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Tab Layout ────────────────────────────────────────────────────────────────
export default function TabLayout() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const pathname = usePathname();
  const { getColors, isDark: getIsDark } = useThemeStore();
  const colors   = getColors();
  const isDark   = getIsDark();
  const styles   = getStyles(colors, isDark);

  const isHomePage = pathname === '/';

  const TAB_HEIGHT = 68;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Thin accent glow line above the tab bar in dark mode */}
      {isDark && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: TAB_HEIGHT + insets.bottom,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: colors.secondary,
            opacity: 0.25,
            zIndex: 50,
          }}
        />
      )}

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.secondary,
          tabBarInactiveTintColor: colors.icon,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopWidth: isDark ? 0 : 1,
            borderTopColor: colors.border + '80',
            height: TAB_HEIGHT + insets.bottom,
            paddingBottom: 6 + insets.bottom,
            paddingTop: 10,
            shadowColor: isDark ? colors.secondary : '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: isDark ? 0.18 : 0.08,
            shadowRadius: isDark ? 20 : 16,
            elevation: 16,
          },
          tabBarLabelStyle: {
            fontFamily: 'Poppins_700Bold',
            fontSize: 9,
            marginTop: 3,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          },
          tabBarItemStyle: {
            paddingTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon Icon={Home} color={color} focused={focused} activeColor={colors.secondary} isDark={isDark} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon Icon={Calendar} color={color} focused={focused} activeColor={colors.secondary} isDark={isDark} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon Icon={User} color={color} focused={focused} activeColor={colors.secondary} isDark={isDark} />
            ),
          }}
        />
        <Tabs.Screen
          name="statistics"
          options={{
            title: 'Stats',
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon Icon={PieChart} color={color} focused={focused} activeColor={colors.secondary} isDark={isDark} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon Icon={Settings} color={color} focused={focused} activeColor={colors.secondary} isDark={isDark} />
            ),
          }}
        />
      </Tabs>

      {/* Floating Action Button */}
      {isHomePage && (
        <View
          style={[
            styles.fabContainer,
            { bottom: TAB_HEIGHT + insets.bottom + 16 },
          ]}
        >
          <AnimatedFAB
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/add-event');
            }}
            colors={colors}
            isDark={isDark}
          />
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: ColorTheme, isDark: boolean) =>
  StyleSheet.create({
    fabContainer: {
      position: 'absolute',
      right: 20,
      zIndex: 100,
    },
  });
