import React from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Home, Calendar, PieChart, Settings, User, Plus } from 'lucide-react-native';
import { StyleSheet, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);

  const isHomePage = pathname === '/';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.secondary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: 66 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 10,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.07,
            shadowRadius: 12,
            elevation: 14,
          },
          tabBarLabelStyle: {
            fontFamily: 'Poppins_700Bold',
            fontSize: 10,
            marginTop: 2,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'HOME',
            tabBarIcon: ({ color, focused }) => (
              <Home color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'CALENDAR',
            tabBarIcon: ({ color, focused }) => (
              <Calendar color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'PROFILE',
            tabBarIcon: ({ color, focused }) => (
              <User color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />
        <Tabs.Screen
          name="statistics"
          options={{
            title: 'STATS',
            tabBarIcon: ({ color, focused }) => (
              <PieChart color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'SETTINGS',
            tabBarIcon: ({ color, focused }) => (
              <Settings color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />
      </Tabs>

      {/* Floating Action Button - Only visible on Home page */}
      {isHomePage && (
        <Pressable 
          style={[styles.fab, { bottom: 66 + insets.bottom + 20 }]} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/add-event');
          }}
        >
          <Plus color="#FFFFFF" size={28} strokeWidth={3} />
        </Pressable>
      )}
    </View>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  }
});
