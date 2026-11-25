import React, { ComponentRef, forwardRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ColorTheme } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Ambient breathing background glow orbs matching the Welcome screen aesthetic.
 */
export function AuthBackground() {
  const { getColors } = useThemeStore();
  const colors = getColors();

  const orb1 = useSharedValue(1);
  const orb2 = useSharedValue(1);

  useEffect(() => {
    orb1.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    orb2.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [orb1, orb2]);

  const orb1Style = useAnimatedStyle(() => ({
    transform: [{ scale: orb1.value }],
  }));

  const orb2Style = useAnimatedStyle(() => ({
    transform: [{ scale: orb2.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        entering={FadeIn.duration(700)}
        style={[
          bgStyles.glowTop,
          { backgroundColor: colors.secondaryLight },
          orb1Style,
        ]}
      />
      <Animated.View
        entering={FadeIn.duration(700)}
        style={[
          bgStyles.glowBottom,
          { backgroundColor: colors.primaryLight },
          orb2Style,
        ]}
      />
    </View>
  );
}

const bgStyles = StyleSheet.create({
  glowTop: {
    position: 'absolute',
    top: -80,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.75,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -90,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.45,
  },
});

interface AuthHeaderProps {
  onBack?: () => void;
  title: string;
  subtitle: string;
  compact?: boolean;
}

/**
 * Shared animated brand + screen heading block for auth screens.
 */
export function AuthHeader({ onBack, title, subtitle, compact = false }: AuthHeaderProps) {
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();
  const dark = isDark();

  return (
    <View style={compact ? headerStyles.wrapCompact : headerStyles.wrap}>
      <Animated.View
        entering={FadeInDown.duration(400).springify()}
        style={headerStyles.topBar}
      >
        <View style={headerStyles.brandRow}>
          <View
            style={[
              headerStyles.brandIcon,
              {
                shadowColor: colors.secondary,
                backgroundColor: colors.card,
                borderColor: dark ? colors.border : '#F5E4D3',
              },
            ]}
          >
            <Image
              source={require('../assets/images/icon_squared.png')}
              style={headerStyles.brandIconImage}
              resizeMode="cover"
            />
          </View>
          <View>
            <Text style={headerStyles.appName}>
              <Text style={{ color: colors.text }}>EVENT</Text>
              <Text style={{ color: colors.secondary }}>FLOW</Text>
            </Text>
            <Text style={[headerStyles.tagline, { color: colors.textSecondary }]}>
              Plan smart. Focus deep.
            </Text>
          </View>
        </View>

        {onBack && (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onBack();
            }}
            hitSlop={10}
            style={({ pressed }) => [
              headerStyles.backPill,
              {
                backgroundColor: colors.card,
                borderColor: dark ? colors.border : '#EAE2D8',
              },
              pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
            ]}
          >
            <ArrowLeft color={colors.text} size={18} strokeWidth={2.2} />
          </Pressable>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(70).duration(450).springify()}>
        <Text style={[compact ? headerStyles.titleCompact : headerStyles.title, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[compact ? headerStyles.subtitleCompact : headerStyles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      </Animated.View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: {
    marginBottom: 24,
  },
  wrapCompact: {
    marginBottom: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  brandIconImage: {
    width: '100%',
    height: '100%',
  },
  appName: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 14,
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
  },
  backPill: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 6,
  },
  titleCompact: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    lineHeight: 32,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  subtitleCompact: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13.5,
    lineHeight: 19,
  },
});

export interface AuthInputProps extends TextInputProps {
  label: string;
  isFocused: boolean;
  error?: string;
  touched?: boolean;
  isValid?: boolean;
  leftIcon: React.ReactNode;
  rightElement?: React.ReactNode;
  compact?: boolean;
  containerStyle?: any;
  colors: ColorTheme;
  isDark: boolean;
}


  // Top-level stable input component (never unmounts on keystroke) with
  // Reanimated focus border interpolation, subtle icon pop, and valid badge.
 
export const AuthInput = forwardRef<ComponentRef<typeof TextInput>, AuthInputProps>(
  (
    {
      label,
      isFocused,
      error,
      touched,
      isValid,
      leftIcon,
      rightElement,
      compact = false,
      containerStyle,
      colors,
      isDark,
      style,
      ...inputProps
    },
    ref
  ) => {
    const hasError = Boolean(touched && error);
    const focusAnim = useSharedValue(isFocused ? 1 : 0);
    const iconScale = useSharedValue(isFocused ? 1.12 : 1);

    useEffect(() => {
      focusAnim.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
      iconScale.value = withSpring(isFocused ? 1.1 : 1, { damping: 14, stiffness: 220 });
    }, [isFocused, focusAnim, iconScale]);

    const defaultBorder = isDark ? colors.border : '#E8DFD5';

    const animatedBoxStyle = useAnimatedStyle(() => {
      const borderColor = hasError
        ? colors.error
        : interpolateColor(focusAnim.value, [0, 1], [defaultBorder, colors.secondary]);

      return {
        borderColor,
        transform: [{ scale: withTiming(isFocused ? 1.008 : 1, { duration: 180 }) }],
      };
    }, [hasError, defaultBorder, colors.error, colors.secondary, isFocused]);

    const animatedIconStyle = useAnimatedStyle(() => ({
      transform: [{ scale: iconScale.value }],
    }));

    return (
      <View style={[compact ? inputStyles.groupCompact : inputStyles.group, containerStyle]}>
        <Text style={[inputStyles.label, { color: isFocused ? colors.secondary : colors.textSecondary }]}>
          {label}
        </Text>

        <Animated.View
          style={[
            compact ? inputStyles.wrapperCompact : inputStyles.wrapper,
            {
              backgroundColor: colors.card,
              shadowColor: isFocused ? colors.secondary : '#182235',
              shadowOpacity: isFocused ? 0.18 : 0.05,
              shadowRadius: isFocused ? 10 : 5,
              elevation: isFocused ? 4 : 2,
            },
            animatedBoxStyle,
          ]}
        >
          <Animated.View style={animatedIconStyle}>{leftIcon}</Animated.View>

          <TextInput
            ref={ref}
            style={[
              compact ? inputStyles.inputCompact : inputStyles.input,
              { color: colors.text },
              style,
            ]}
            placeholderTextColor={isDark ? '#64748B' : '#98A2B3'}
            selectionColor={colors.secondary}
            {...inputProps}
          />

          {rightElement ? (
            rightElement
          ) : isValid && !hasError ? (
            <Animated.View entering={ZoomIn.duration(220).springify()}>
              <CheckCircle2 color={colors.success} size={17} strokeWidth={2.4} />
            </Animated.View>
          ) : null}
        </Animated.View>

        {hasError ? (
          <Animated.Text
            entering={FadeInDown.duration(180)}
            style={[inputStyles.errorText, { color: colors.error }]}
          >
            {error}
          </Animated.Text>
        ) : null}
      </View>
    );
  }
);

AuthInput.displayName = 'AuthInput';

const inputStyles = StyleSheet.create({
  group: {
    marginBottom: 15,
  },
  groupCompact: {
    marginBottom: 12,
  },
  label: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.9,
    marginBottom: 6,
    marginLeft: 2,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    gap: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  wrapperCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 13,
    gap: 9,
    shadowOffset: { width: 0, height: 2 },
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
  },
  inputCompact: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14.5,
  },
  errorText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11.5,
    marginTop: 4,
    marginLeft: 4,
  },
});

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  rightIcon?: React.ReactNode;
}

/**
 * Spring-animated gradient CTA button.
 */
export function AnimatedPrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  rightIcon,
}: PrimaryButtonProps) {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={loading || disabled}
      onPressIn={() => {
        scale.value = withSpring(0.965, { damping: 15, stiffness: 300 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 250 });
      }}
      style={[animatedStyle, btnStyles.shadowWrap, { shadowColor: colors.secondary }]}
    >
      <LinearGradient
        colors={loading ? ['#FFB86A', '#FF9840'] : ['#FF8E3C', '#FF6814']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={btnStyles.gradient}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <View style={btnStyles.row}>
            <Text style={btnStyles.text}>{title}</Text>
            {rightIcon}
          </View>
        )}
      </LinearGradient>
    </AnimatedPressable>
  );
}

const btnStyles = StyleSheet.create({
  shadowWrap: {
    borderRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 7,
  },
  gradient: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export function AuthDivider({ label = 'or' }: { label?: string }) {
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();
  const lineColor = isDark() ? 'rgba(255,255,255,0.12)' : 'rgba(24,34,53,0.12)';

  return (
    <View style={divStyles.row}>
      <View style={[divStyles.line, { backgroundColor: lineColor }]} />
      <Text style={[divStyles.text, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[divStyles.line, { backgroundColor: lineColor }]} />
    </View>
  );
}

const divStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  line: {
    flex: 1,
    height: 1,
  },
  text: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12.5,
    textTransform: 'lowercase',
  },
});
