import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, Image,
  Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView,
  Platform, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GoogleButton from '../../components/GoogleButton';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useGoogleAuth } from '../../services/clerkAuth';
import { useFormik } from 'formik';
import * as yup from 'yup';

const validationSchema = yup.object().shape({
  email: yup.string().required('Email/Username is required'),
  password: yup.string().required('Password is required'),
});

// Lightweight fade+slide hook using the built-in Animated API
function useEntryAnimation(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 480,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 480,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return { opacity, translateY };
}

export default function LoginScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);

  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [emailFor2FA, setEmailFor2FA] = useState('');
  const [otp, setOtp] = useState('');

  const login = useAuthStore(state => state.login);
  const router = useRouter();
  const { signInWithGoogle } = useGoogleAuth();

  // --- Entry animations (staggered) ---
  const brand = useEntryAnimation(0);
  const heading = useEntryAnimation(80);
  const field1 = useEntryAnimation(160);
  const field2 = useEntryAnimation(220);
  const forgotAnim = useEntryAnimation(280);
  const btnAnim = useEntryAnimation(340);
  const divAnim = useEntryAnimation(400);
  const googleAnim = useEntryAnimation(460);
  const linkAnim = useEntryAnimation(520);

  // Button press scale
  const btnScale = useRef(new Animated.Value(1)).current;
  const animatePressIn = () =>
    Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start();
  const animatePressOut = () =>
    Animated.spring(btnScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  // 2FA panel slide-in
  const otpPanel = useRef(new Animated.Value(60)).current;
  const otpOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (requires2FA) {
      Animated.parallel([
        Animated.timing(otpPanel, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(otpOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    } else {
      otpPanel.setValue(60);
      otpOpacity.setValue(0);
    }
  }, [requires2FA, otpPanel, otpOpacity]);

  const send2FACode = useCallback(async (email: string) => {
    setOtpSending(true);
    try {
      await api.post('/auth/2fa/send', { email });
    } catch {
      Alert.alert('Code Delivery Failed', 'Could not send the verification code. Please use Resend Code.');
    } finally {
      setOtpSending(false);
    }
  }, []);

  useEffect(() => {
    if (requires2FA && emailFor2FA) {
      send2FACode(emailFor2FA);
    }
  }, [requires2FA, emailFor2FA, send2FACode]);

  const formik = useFormik({
    initialValues: { email: '', password: '' },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const cleanEmail = values.email.trim().toLowerCase();

      try {
        const res = await api.post('/auth/login', { email: cleanEmail, password: values.password });

        if (res.data.requires2FA) {
          setRequires2FA(true);
          setTempToken(res.data.tempToken);
          setEmailFor2FA(res.data.email);
        } else {
          await login(res.data.token, res.data.user);
          router.replace('/(tabs)');
        }
      } catch (err: any) {
        const isNotFound = err.response?.data?.accountNotFound || err.response?.status === 404;
        const serverError = err.response?.data?.error || err.response?.data?.message;

        if (isNotFound) {
          Alert.alert(
            'Account Not Found',
            'No account found with this email/username.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Create Account', onPress: () => router.push('/(auth)/register') },
            ],
          );
        } else if (serverError) {
          Alert.alert('Login Failed', serverError);
        } else {
          Alert.alert('Connection Error', 'Unable to reach the server. Please check your internet connection.');
        }
      } finally {
        setLoading(false);
      }
    },
  });

  const handleVerify2FA = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code sent to your email.');
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await api.post('/auth/2fa/verify', { email: emailFor2FA, otp, tempToken });
      await login(res.data.token, res.data.user);
      router.replace('/(tabs)');
    } catch (err: any) {
      const serverError = err.response?.data?.error || err.response?.data?.message;
      Alert.alert('Verification Failed', serverError || 'Invalid 2FA code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await signInWithGoogle();
      if (!result || !result.user?.email) return;

      const res = await api.post('/auth/google', {
        email: result.user.email,
        name: result.user.name,
        profilePhoto: result.user.profilePhoto,
      });
      await login(res.data.token, res.data.user);
      router.replace('/(tabs)');
    } catch (err: any) {
      const isCancelled =
        err?.code === 'ERR_REQUEST_CANCELED' ||
        err?.message?.includes('cancel') ||
        err?.message?.includes('dismissed');
      if (!isCancelled) {
        Alert.alert('Google Sign-In Failed', err?.response?.data?.error || 'Could not complete Google sign-in. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <Animated.View style={[styles.brandRow, { opacity: brand.opacity, transform: [{ translateY: brand.translateY }] }]}>
            <View style={styles.brandIcon}>
              <Image
                source={require('../../assets/images/icon_squared.png')}
                style={styles.brandIconImage}
                resizeMode="cover"
              />
            </View>
            <View>
              <Text style={styles.appName}>EVENTFLOW</Text>
              <Text style={styles.tagline}>Focus on the right task at the right time.</Text>
            </View>
          </Animated.View>

          {/* Heading */}
          <Animated.View style={{ opacity: heading.opacity, transform: [{ translateY: heading.translateY }] }}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue where you left off</Text>
          </Animated.View>

          {requires2FA ? (
            /* ── 2FA Panel ── */
            <Animated.View style={{ opacity: otpOpacity, transform: [{ translateY: otpPanel }] }}>
              <View style={styles.otpHeader}>
                <ShieldCheck color={colors.secondary} size={36} strokeWidth={1.5} />
                <Text style={styles.otpTitle}>Two-Step Verification</Text>
                <Text style={styles.otpSub}>
                  A 6-digit code was sent to{'\n'}
                  <Text style={styles.otpEmail}>{emailFor2FA}</Text>
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>VERIFICATION CODE</Text>
                <View style={styles.inputWrapper}>
                  <Lock color={colors.textSecondary} size={18} strokeWidth={2} />
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="· · · · · ·"
                    placeholderTextColor={colors.textSecondary}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </View>
              </View>

              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <Pressable
                  onPress={handleVerify2FA}
                  onPressIn={animatePressIn}
                  onPressOut={animatePressOut}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#FF8C42', '#FF6B1A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginBtn}
                  >
                    {loading
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Text style={styles.loginBtnText}>Verify & Sign In</Text>
                    }
                  </LinearGradient>
                </Pressable>
              </Animated.View>

              <Pressable
                onPress={() => send2FACode(emailFor2FA)}
                disabled={otpSending}
                style={styles.signupRow}
              >
                {otpSending
                  ? <ActivityIndicator size="small" color={colors.secondary} />
                  : <Text style={styles.signupLink}>Resend Code</Text>
                }
              </Pressable>

              <Pressable onPress={() => { setRequires2FA(false); setOtp(''); }} style={styles.signupRow}>
                <Text style={styles.signupText}>← Back to Login</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <>
              {/* Email */}
              <Animated.View style={[styles.inputGroup, { opacity: field1.opacity, transform: [{ translateY: field1.translateY }] }]}>
                <Text style={styles.label}>EMAIL OR USERNAME</Text>
                <View style={[
                  styles.inputWrapper,
                  focusedField === 'email' && styles.inputWrapperFocused,
                  formik.touched.email && formik.errors.email && { borderColor: colors.error },
                ]}>
                  <Mail color={focusedField === 'email' ? colors.secondary : colors.textSecondary} size={18} strokeWidth={2} />
                  <TextInput
                    style={styles.input}
                    placeholder="your.email@example.com"
                    placeholderTextColor={colors.textSecondary}
                    value={formik.values.email}
                    onChangeText={formik.handleChange('email')}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => { setFocusedField(null); formik.handleBlur('email')('email'); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="username"
                  />
                </View>
                {formik.touched.email && formik.errors.email && (
                  <Text style={styles.errorText}>{formik.errors.email}</Text>
                )}
              </Animated.View>

              {/* Password */}
              <Animated.View style={[styles.inputGroup, { opacity: field2.opacity, transform: [{ translateY: field2.translateY }] }]}>
                <Text style={styles.label}>PASSWORD</Text>
                <View style={[
                  styles.inputWrapper,
                  focusedField === 'password' && styles.inputWrapperFocused,
                  formik.touched.password && formik.errors.password && { borderColor: colors.error },
                ]}>
                  <Lock color={focusedField === 'password' ? colors.secondary : colors.textSecondary} size={18} strokeWidth={2} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textSecondary}
                    value={formik.values.password}
                    onChangeText={formik.handleChange('password')}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => { setFocusedField(null); formik.handleBlur('password')('password'); }}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={10}>
                    {showPassword
                      ? <EyeOff color={colors.textSecondary} size={18} />
                      : <Eye color={colors.textSecondary} size={18} />
                    }
                  </Pressable>
                </View>
                {formik.touched.password && formik.errors.password && (
                  <Text style={styles.errorText}>{formik.errors.password}</Text>
                )}
              </Animated.View>

              {/* Forgot */}
              <Animated.View style={{ opacity: forgotAnim.opacity, transform: [{ translateY: forgotAnim.translateY }] }}>
                <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotBtn}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
              </Animated.View>

              {/* Login Button */}
              <Animated.View style={[{ opacity: btnAnim.opacity, transform: [{ translateY: btnAnim.translateY }, { scale: btnScale }] }]}>
                <Pressable
                  onPress={() => formik.handleSubmit()}
                  onPressIn={animatePressIn}
                  onPressOut={animatePressOut}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={loading ? ['#FFB86A', '#FF9840'] : ['#FF8C42', '#FF6B1A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginBtn}
                  >
                    {loading
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Text style={styles.loginBtnText}>Continue</Text>
                    }
                  </LinearGradient>
                </Pressable>
              </Animated.View>

              {/* Divider */}
              <Animated.View style={[styles.dividerRow, { opacity: divAnim.opacity }]}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </Animated.View>

              {/* Google */}
              <Animated.View style={{ opacity: googleAnim.opacity, transform: [{ translateY: googleAnim.translateY }] }}>
                <GoogleButton onPress={handleGoogleLogin} loading={googleLoading} />
              </Animated.View>

              {/* Sign Up Link */}
              <Animated.View style={[styles.signupRow, { opacity: linkAnim.opacity, transform: [{ translateY: linkAnim.translateY }] }]}>
                <Pressable onPress={() => router.push('/(auth)/register')} style={styles.signupRow}>
                  <Text style={styles.signupText}>Don't have an account? </Text>
                  <Text style={styles.signupLink}>Sign up</Text>
                </Pressable>
              </Animated.View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 16,
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 36,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  brandIconImage: {
    width: '100%',
    height: '100%',
  },
  appName: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 14,
    color: colors.secondary,
    letterSpacing: 2.5,
  },
  tagline: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 30,
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 28,
    lineHeight: 20,
  },
  // 2FA styles
  otpHeader: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 10,
  },
  otpTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
  },
  otpSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  otpEmail: {
    fontFamily: 'Poppins_600SemiBold',
    color: colors.secondary,
  },
  otpInput: {
    letterSpacing: 8,
    fontSize: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 7,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  inputWrapperFocused: {
    borderColor: colors.secondary,
    shadowColor: colors.secondary,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: colors.text,
  },
  eyeBtn: {
    padding: 4,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: 2,
  },
  forgotText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: colors.primary,
  },
  loginBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 7,
    marginBottom: 8,
  },
  loginBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: '#FFF',
    letterSpacing: 0.4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signupText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  signupLink: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: colors.secondary,
  },
  errorText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.error,
    marginTop: 5,
    marginLeft: 4,
  },
});
