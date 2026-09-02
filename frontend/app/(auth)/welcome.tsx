import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CalendarCheck, Target, TrendingUp, ArrowRight, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn, ZoomIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withSequence, withDelay } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const router = useRouter();
  
  const pulseOuter = useSharedValue(1);
  const pulseMiddle = useSharedValue(1);

  useEffect(() => {
    pulseOuter.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    pulseMiddle.value = withRepeat(
      withSequence(
        withDelay(500, withTiming(1.05, { duration: 1200, easing: Easing.inOut(Easing.ease) })),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const outerStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseOuter.value }] }));
  const middleStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseMiddle.value }] }));

  return (
    <View style={styles.root}>
      {/* Background Glows */}
      <Animated.View entering={FadeIn.duration(1000)} style={styles.bgGlowTop} />
      <Animated.View entering={FadeIn.duration(1000)} style={styles.bgGlowBottom} />

      {/* Scattered Sparkles */}
      <Animated.View entering={ZoomIn.delay(800).duration(800)} style={[styles.sparkle, { top: '15%', left: '20%' }]}>
        <Sparkles color="#FFB86A" size={16} />
      </Animated.View>
      <Animated.View entering={ZoomIn.delay(1000).duration(800)} style={[styles.sparkle, { top: '25%', right: '15%' }]}>
        <Sparkles color={colors.secondary} size={12} />
      </Animated.View>
      <Animated.View entering={ZoomIn.delay(1200).duration(800)} style={[styles.sparkle, { top: '45%', left: '10%' }]}>
        <Sparkles color={colors.primary} size={14} opacity={0.5} />
      </Animated.View>
      <Animated.View entering={ZoomIn.delay(1400).duration(800)} style={[styles.sparkle, { top: '38%', right: '10%' }]}>
        <Sparkles color={colors.primary} size={16} opacity={0.4} />
      </Animated.View>

      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Logo Area */}
          <Animated.View entering={ZoomIn.duration(800).springify()} style={styles.logoContainer}>
            <Animated.View style={[styles.circle, styles.circleOuter, outerStyle]}>
              <Animated.View style={[styles.circle, styles.circleMiddle, middleStyle]}>
                <View style={[styles.circle, styles.circleInner]}>
                  <Image 
                    source={require('../../assets/images/focusflow_logo.png')}
                    style={styles.logoImage}
                    resizeMode="cover"
                  />
                </View>
              </Animated.View>
            </Animated.View>
          </Animated.View>

          {/* Brand Text */}
          <Animated.View entering={FadeInDown.delay(300).duration(800).springify()} style={styles.brandContainer}>
            <Text style={styles.brandTitle}>
              <Text style={{ color: colors.text }}>Focus</Text>
              <Text style={{ color: colors.secondary }}>Flow</Text>
            </Text>
            <Text style={styles.tagline}>Plan Better. Focus More. Achieve All.</Text>
            
            <View style={styles.pagination}>
              <View style={styles.dotActive} />
              <View style={styles.dotInactive} />
              <View style={styles.dotInactive} />
            </View>
          </Animated.View>

          {/* Features Card */}
          <Animated.View entering={FadeInDown.delay(500).duration(800).springify()} style={styles.featuresCard}>
            <View style={styles.featureItem}>
              <View style={[styles.featureIconWrap, { backgroundColor: colors.secondaryLight }]}>
                <CalendarCheck color={colors.secondary} size={20} strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.featureTitle}>Plan</Text>
                <Text style={styles.featureSub}>Smartly</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureIconWrap, { backgroundColor: colors.secondaryLight }]}>
                <Target color={colors.secondary} size={20} strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.featureTitle}>Focus</Text>
                <Text style={styles.featureSub}>Deeply</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureIconWrap, { backgroundColor: colors.secondaryLight }]}>
                <TrendingUp color={colors.secondary} size={20} strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.featureTitle}>Achieve</Text>
                <Text style={styles.featureSub}>Consistently</Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Action Buttons */}
        <Animated.View entering={FadeInDown.delay(700).duration(800).springify()} style={styles.footer}>
          <Pressable 
            style={({ pressed }) => [styles.btnWrapper, pressed && { opacity: 0.9 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(auth)/login');
            }}
          >
            <LinearGradient
              colors={[colors.secondary, colors.secondary]}
              style={styles.primaryBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.primaryBtnText}>Get Started</Text>
              <ArrowRight color={colors.card} size={20} strokeWidth={2.5} />
            </LinearGradient>
          </Pressable>

          <Pressable 
            style={({ pressed }) => [styles.secondaryBtn, pressed && { backgroundColor: colors.secondaryLight }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(auth)/register');
            }}
          >
            <Text style={styles.secondaryBtnText}>Create Account</Text>
            <ArrowRight color={colors.secondary} size={20} strokeWidth={2.5} />
          </Pressable>

          <Animated.View entering={FadeIn.delay(1000).duration(800)} style={styles.termsContainer}>
            <Text style={styles.termsText}>By continuing, you agree to our</Text>
            <View style={styles.termsLinks}>
              <Text style={styles.termsLink}>Terms of Service</Text>
              <Text style={styles.termsText}> & </Text>
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </View>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bgGlowTop: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 250,
    height: 250,
    backgroundColor: colors.secondaryLight,
    borderRadius: 125,
    opacity: 0.8,
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 300,
    height: 300,
    backgroundColor: colors.secondaryLight,
    borderRadius: 150,
    opacity: 0.6,
  },
  sparkle: {
    position: 'absolute',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOuter: {
    width: width * 0.65,
    height: width * 0.65,
    borderRadius: width * 0.325,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.1)',
  },
  circleMiddle: {
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: width * 0.25,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.2)',
    backgroundColor: 'rgba(255, 122, 0, 0.03)',
  },
  circleInner: {
    width: width * 0.3,
    height: width * 0.3,
    borderRadius: width * 0.15,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
    backgroundColor: colors.card, // Fallback
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: width * 0.15,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 42,
    marginBottom: 8,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  pagination: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dotActive: {
    width: 24,
    height: 4,
    backgroundColor: colors.secondary,
    borderRadius: 2,
  },
  dotInactive: {
    width: 16,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  featuresCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    width: '100%',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  featureItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 12,
    color: colors.text,
  },
  featureSub: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    color: colors.textSecondary,
  },
  footer: {
    paddingBottom: 24,
    gap: 16,
  },
  btnWrapper: {
    width: '100%',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    gap: 12,
  },
  primaryBtnText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 16,
    color: colors.card,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    gap: 12,
  },
  secondaryBtnText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 16,
    color: colors.secondary,
  },
  termsContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  termsText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#98A2B3',
  },
  termsLinks: {
    flexDirection: 'row',
    marginTop: 2,
  },
  termsLink: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: colors.secondary,
  },
});
