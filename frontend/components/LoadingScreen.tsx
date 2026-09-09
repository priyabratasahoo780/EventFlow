import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence, 
  Easing,
  interpolate
} from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';

interface Props {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingScreen({ message = 'Loading FocusFlow...', fullScreen = true }: Props) {
  const colors = useThemeStore(state => state.getColors());

  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }]
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.2], [1, 0.7])
  }));

  return (
    <View style={[styles.container, fullScreen && styles.fullScreen, { backgroundColor: colors.background }]}>
      <View style={styles.loaderCenter}>
        {/* Outer rotating dashed ring */}
        <Animated.View style={[
          styles.ring, 
          { borderColor: colors.primary, borderTopColor: 'transparent', borderRightColor: 'transparent' }, 
          spinStyle
        ]} />
        
        {/* Inner pulsing icon */}
        <Animated.View style={[styles.iconWrapper, { backgroundColor: colors.primary + '15' }, pulseStyle]}>
          <Sparkles color={colors.primary} size={28} strokeWidth={2.5} />
        </Animated.View>
      </View>
      
      <Text style={[styles.text, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loaderCenter: {
    position: 'relative',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ring: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
