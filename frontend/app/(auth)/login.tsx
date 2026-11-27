import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { useResponsive } from '../../constants/responsive';
import { useState, useEffect, useCallback, useRef, ComponentRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeOutUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import GoogleButton from '../../components/GoogleButton';
import {
  AuthBackground,
  AuthHeader,
  AuthInput,
  AnimatedPrimaryButton,
  AuthDivider,
} from '../../components/AuthUI';
import AuthStatusModal, { AuthModalConfig } from '../../components/AuthStatusModal';
import api, { extractApiError, warmUpBackend } from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useGoogleAuth } from '../../services/clerkAuth';
import { useFormik } from 'formik';
import * as yup from 'yup';

const validationSchema = yup.object().shape({
  email: yup.string().trim().min(3, 'Enter a valid email or username').required('Email or username is required'),
  password: yup.string().required('Password is required'),
});

const INITIAL_MODAL: AuthModalConfig = {
  visible: false,
  type: 'error',
  title: '',
  message: '',
};

export default function LoginScreen() {
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();
  const dark = isDark();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { authMaxWidth, isSmall } = useResponsive();
  const params = useLocalSearchParams<{ email?: string; twoFactorToken?: string; twoFactorEmail?: string }>();
  const initialEmail = typeof params.email === 'string' ? params.email.trim() : '';
  const initial2FAToken = typeof params.twoFactorToken === 'string' ? params.twoFactorToken : '';
  const initial2FAEmail = typeof params.twoFactorEmail === 'string' ? params.twoFactorEmail : '';

  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [requires2FA, setRequires2FA] = useState(Boolean(initial2FAToken && initial2FAEmail));
  const [tempToken, setTempToken] = useState(initial2FAToken);
  const [emailFor2FA, setEmailFor2FA] = useState(initial2FAEmail);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [formBannerError, setFormBannerError] = useState('');
  const [modalConfig, setModalConfig] = useState<AuthModalConfig>(INITIAL_MODAL);

  const scrollViewRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const autoSentTokenRef = useRef<string | null>(null);
  const login = useAuthStore((state) => state.login);
  const setPostLoginRoute = useAuthStore((state) => state.setPostLoginRoute);
  const router = useRouter();
  const { signInWithGoogle } = useGoogleAuth();

  const closeModal = useCallback(() => {
    setModalConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  // Wake up Render backend silently as soon as login screen opens
  useEffect(() => {
    warmUpBackend();
  }, []);

  // Horizontal shake animation on invalid submit / error
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeX.value = withSequence(
      withTiming(-9, { duration: 55 }),
      withTiming(9, { duration: 55 }),
      withTiming(-6, { duration: 55 }),
      withTiming(6, { duration: 55 }),
      withTiming(-3, { duration: 45 }),
      withTiming(0, { duration: 45 })
    );
  }, [shakeX]);

  // 2FA Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const send2FACode = useCallback(async (email: string, token: string) => {
    if (!email || !token) return;
    setOtpSending(true);
    setOtpError('');
    try {
      await api.post('/auth/2fa/send', { email, tempToken: token });
      setResendCooldown(30);
    } catch (err: any) {
      const parsed = extractApiError(err, 'Could not send the verification code. Please tap Resend Code.');

      if (parsed.status === 401) {
        setRequires2FA(false);
        setOtp('');
        setTempToken('');
        autoSentTokenRef.current = null;
        setModalConfig({
          visible: true,
          type: 'error',
          title: 'Session Expired',
          message: parsed.message || 'Your sign-in session expired. Please log in again.',
        });
      } else {
        setOtpError(parsed.message);
        setModalConfig({
          visible: true,
          type: parsed.isNetworkError || parsed.isTimeout ? 'network' : 'error',
          title: 'Code Delivery Failed',
          message: parsed.message,
        });
      }
    } finally {
      setOtpSending(false);
    }
  }, []);

  useEffect(() => {
    if (requires2FA && emailFor2FA && tempToken && autoSentTokenRef.current !== tempToken) {
      autoSentTokenRef.current = tempToken;
      send2FACode(emailFor2FA, tempToken);
    }
  }, [requires2FA, emailFor2FA, tempToken, send2FACode]);

  const formik = useFormik({
    initialValues: { email: initialEmail, password: '' },
    validationSchema,
    onSubmit: async (values) => {
      if (loading || googleLoading) return;
      setLoading(true);
      setFormBannerError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const cleanEmail = values.email.trim().toLowerCase();

      try {
        const res = await api.post('/auth/login', { email: cleanEmail, password: values.password });

        if (res.data?.requires2FA) {
          setRequires2FA(true);
          setTempToken(res.data.tempToken);
          setEmailFor2FA(res.data.email);
        } else {
          if (!res.data?.token || !res.data?.user) {
            throw new Error('Server returned an incomplete login response. Please try again.');
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (res.data.user?.role === 'admin') {
            setPostLoginRoute('/admin');
          }
          await login(res.data.token, res.data.user);
        }
      } catch (err: any) {
        triggerShake();
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        const parsed = extractApiError(err, 'Login failed. Please check your credentials and try again.');

        if (parsed.accountNotFound) {
          setFormBannerError('No account found with this email or username.');
          formik.setFieldError('email', 'Account not found');
          formik.setFieldTouched('email', true, false);
          const prefill = cleanEmail.includes('@') ? cleanEmail : '';
          setModalConfig({
            visible: true,
            type: 'account_not_found',
            title: 'Account Not Found',
            highlightText: cleanEmail,
            message: 'No EventFlow account exists with this email or username. Want to create a new account?',
            primaryAction: {
              label: 'Create Account',
              onPress: () => {
                closeModal();
                router.push({
                  pathname: '/(auth)/register',
                  params: prefill ? { email: prefill } : {},
                } as any);
              },
            },
            secondaryAction: {
              label: 'Try Different Email',
              onPress: closeModal,
            },
          });
        } else if (parsed.accountBanned) {
          setFormBannerError(parsed.message);
          setModalConfig({
            visible: true,
            type: 'suspended',
            title: 'Account Suspended',
            highlightText: cleanEmail,
            message: parsed.message,
          });
        } else if (parsed.code === 'INVALID_PASSWORD') {
          setFormBannerError(parsed.message);
          formik.setFieldError('password', 'Incorrect password');
          formik.setFieldTouched('password', true, false);
          const prefill = cleanEmail.includes('@') ? cleanEmail : '';
          setModalConfig({
            visible: true,
            type: 'error',
            title: 'Incorrect Password',
            message: 'The password you entered is incorrect. Double-check it or reset your password via email OTP.',
            primaryAction: {
              label: 'Forgot Password?',
              onPress: () => {
                closeModal();
                router.push({
                  pathname: '/(auth)/forgot-password',
                  params: prefill ? { email: prefill } : {},
                } as any);
              },
            },
            secondaryAction: {
              label: 'Try Again',
              onPress: () => {
                closeModal();
                passwordRef.current?.focus();
              },
            },
          });
        } else if (parsed.code === 'USE_GOOGLE_OR_RESET') {
          setFormBannerError(parsed.message);
          setModalConfig({
            visible: true,
            type: 'warning',
            title: 'Use Google Sign-In',
            message: parsed.message,
            primaryAction: {
              label: 'Reset Password Instead',
              onPress: () => {
                closeModal();
                router.push({
                  pathname: '/(auth)/forgot-password',
                  params: cleanEmail.includes('@') ? { email: cleanEmail } : {},
                } as any);
              },
            },
            secondaryAction: {
              label: 'Cancel',
              onPress: closeModal,
            },
          });
        } else {
          setFormBannerError(parsed.message);
          setModalConfig({
            visible: true,
            type: parsed.isNetworkError || parsed.isTimeout ? 'network' : 'error',
            title: parsed.title || 'Login Failed',
            message: parsed.message,
          });
        }
      } finally {
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    if (initialEmail && !formik.values.email) {
      formik.setFieldValue('email', initialEmail, false);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (initial2FAToken && initial2FAEmail) {
      setTempToken(initial2FAToken);
      setEmailFor2FA(initial2FAEmail);
      setRequires2FA(true);
    }
  }, [initial2FAToken, initial2FAEmail]);

  const handleSubmitForm = async () => {
    Keyboard.dismiss();
    setFormBannerError('');
    const errors = await formik.validateForm();
    const firstError = errors.email || errors.password;
    if (firstError) {
      formik.setTouched({ email: true, password: true });
      setFormBannerError(String(firstError));
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      triggerShake();
      return;
    }
    formik.handleSubmit();
  };

  const handleVerify2FA = async () => {
    Keyboard.dismiss();
    if (!otp || otp.length !== 6) {
      triggerShake();
      setOtpError('Please enter all 6 digits from your verification email.');
      setModalConfig({
        visible: true,
        type: 'warning',
        title: 'Invalid Code',
        message: 'Please enter the 6-digit verification code sent to your email.',
      });
      return;
    }
    setLoading(true);
    setOtpError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await api.post('/auth/2fa/verify', { email: emailFor2FA, otp, tempToken });
      if (!res.data?.token || !res.data?.user) {
        throw new Error('Server returned an incomplete verification response. Please try again.');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (res.data.user?.role === 'admin') {
        setPostLoginRoute('/admin');
      }
      await login(res.data.token, res.data.user);
    } catch (err: any) {
      triggerShake();
      const parsed = extractApiError(err, 'Invalid 2FA code. Please try again.');
      setOtpError(parsed.message);
      setModalConfig({
        visible: true,
        type: parsed.isNetworkError || parsed.isTimeout ? 'network' : 'error',
        title: parsed.status === 401 ? 'Session Expired' : 'Verification Failed',
        message: parsed.message,
      });
      if (parsed.status === 401) {
        setRequires2FA(false);
        setOtp('');
        setTempToken('');
        autoSentTokenRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading || googleLoading) return;
    Keyboard.dismiss();
    setGoogleLoading(true);
    setFormBannerError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Safety net: if signInWithGoogle never resolves (deep-link failure, browser stuck),
    // auto-reset the loading state after 65s so the button is usable again.
    const safetyTimer = setTimeout(() => {
      setGoogleLoading(false);
      setFormBannerError('Google Sign-In timed out. Please tap the button again.');
    }, 65000);

    try {
      const result = await signInWithGoogle();
      clearTimeout(safetyTimer);
      if (!result || result.cancelled) {
        if (useAuthStore.getState().inSsoCallback && router.canGoBack()) {
          router.back();
        }
        return;
      }

      if (!result.sessionId) {
        throw new Error('Google did not return an active session. Please try again.');
      }

      const res = await api.post('/auth/google', {
        sessionId: result.sessionId,
        email: result.user?.email || '',
        name: result.user?.name || '',
        profilePhoto: result.user?.profilePhoto || '',
      });

      if (res.data?.requires2FA) {
        setRequires2FA(true);
        setTempToken(res.data.tempToken);
        setEmailFor2FA(res.data.email);
        return;
      }

      if (!res.data?.token || !res.data?.user) {
        throw new Error('Server returned an incomplete Google sign-in response. Please try again.');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (res.data.user?.role === 'admin') {
        setPostLoginRoute('/admin');
      }
      await login(res.data.token, res.data.user);
    } catch (err: any) {
      clearTimeout(safetyTimer);
      if (useAuthStore.getState().inSsoCallback && router.canGoBack()) {
        router.back();
      }
      triggerShake();
      const parsed = extractApiError(err, 'Could not complete Google sign-in. Please try again.');
      setFormBannerError(parsed.message);
      setModalConfig({
        visible: true,
        type: parsed.accountBanned
          ? 'suspended'
          : parsed.isNetworkError || parsed.isTimeout
            ? 'network'
            : 'error',
        title: parsed.accountBanned ? 'Account Suspended' : 'Google Sign-In Failed',
        message: parsed.message,
      });
    } finally {
      clearTimeout(safetyTimer);
      setGoogleLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuthBackground />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.container,
            {
              width: '100%',
              maxWidth: authMaxWidth,
              alignSelf: 'center',
              paddingHorizontal: isSmall ? 18 : 24,
              paddingTop: Math.max(insets.top + 14, 28),
              paddingBottom: Math.max(insets.bottom + 24, 34),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthHeader
            title={requires2FA ? 'Verify Identity' : 'Welcome Back'}
            subtitle={
              requires2FA
                ? 'Two-factor protection is enabled on your account'
                : 'Sign in to continue where you left off'
            }
            onBack={() => {
              if (requires2FA) {
                setRequires2FA(false);
                setOtp('');
                setOtpError('');
                setTempToken('');
                autoSentTokenRef.current = null;
              } else if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(auth)/welcome');
              }
            }}
          />

          {requires2FA ? (
            <Animated.View
              key="2fa-panel"
              entering={FadeInDown.duration(350).springify()}
              exiting={FadeOutUp.duration(200)}
              style={shakeStyle}
            >
              <Animated.View
                entering={ZoomIn.delay(80).duration(350).springify()}
                style={[styles.otpBadgeCard, { backgroundColor: colors.card, borderColor: dark ? colors.border : '#EAE2D8' }]}
              >
                <View style={[styles.otpIconWrap, { backgroundColor: colors.secondaryLight }]}>
                  <ShieldCheck color={colors.secondary} size={28} strokeWidth={2} />
                </View>
                <Text style={[styles.otpSub, { color: colors.textSecondary }]}>
                  Enter the 6-digit code sent to{'\n'}
                  <Text style={[styles.otpEmail, { color: colors.text }]}>{emailFor2FA}</Text>
                </Text>
              </Animated.View>

              <AuthInput
                label="6-DIGIT CODE"
                colors={colors}
                isDark={dark}
                isFocused={focusedField === 'otp'}
                error={otpError}
                touched={Boolean(otpError)}
                leftIcon={
                  <Lock
                    color={focusedField === 'otp' ? colors.secondary : colors.textSecondary}
                    size={18}
                    strokeWidth={2}
                  />
                }
                placeholder="123456"
                value={otp}
                onChangeText={(t) => {
                  setOtp(t.replace(/[^0-9]/g, ''));
                  if (otpError) setOtpError('');
                }}
                onFocus={() => setFocusedField('otp')}
                onBlur={() => setFocusedField(null)}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleVerify2FA}
                style={styles.otpInput}
              />

              <AnimatedPrimaryButton
                title="Verify & Sign In"
                onPress={handleVerify2FA}
                loading={loading}
                rightIcon={<ArrowRight color="#FFF" size={18} strokeWidth={2.5} />}
              />

              <Pressable
                onPress={() => send2FACode(emailFor2FA, tempToken)}
                disabled={otpSending || resendCooldown > 0}
                style={styles.resendRow}
              >
                {otpSending ? (
                  <ActivityIndicator size="small" color={colors.secondary} />
                ) : (
                  <Text
                    style={[
                      styles.signupLink,
                      { color: resendCooldown > 0 ? colors.textSecondary : colors.secondary },
                    ]}
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                  </Text>
                )}
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View style={shakeStyle}>
              {formBannerError ? (
                <Animated.View
                  entering={FadeInDown.duration(220)}
                  style={[
                    styles.errorBanner,
                    { backgroundColor: colors.dangerLight, borderColor: colors.error },
                  ]}
                >
                  <AlertCircle color={colors.error} size={17} strokeWidth={2.2} />
                  <Text style={[styles.errorBannerText, { color: colors.error }]}>
                    {formBannerError}
                  </Text>
                </Animated.View>
              ) : null}

              {/* Email */}
              <Animated.View entering={FadeInDown.delay(110).duration(420).springify()}>
                <AuthInput
                  label="EMAIL OR USERNAME"
                  colors={colors}
                  isDark={dark}
                  isFocused={focusedField === 'email'}
                  error={formik.errors.email}
                  touched={formik.touched.email}
                  isValid={formik.values.email.trim().length >= 3 && !formik.errors.email}
                  leftIcon={
                    <Mail
                      color={focusedField === 'email' ? colors.secondary : colors.textSecondary}
                      size={18}
                      strokeWidth={2}
                    />
                  }
                  placeholder="your.email@example.com"
                  value={formik.values.email}
                  onChangeText={(text) => {
                    if (formBannerError) setFormBannerError('');
                    formik.handleChange('email')(text);
                  }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => {
                    setFocusedField(null);
                    formik.setFieldTouched('email', true);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </Animated.View>

              {/* Password */}
              <Animated.View entering={FadeInDown.delay(170).duration(420).springify()}>
                <AuthInput
                  ref={passwordRef}
                  label="PASSWORD"
                  colors={colors}
                  isDark={dark}
                  isFocused={focusedField === 'password'}
                  error={formik.errors.password}
                  touched={formik.touched.password}
                  leftIcon={
                    <Lock
                      color={focusedField === 'password' ? colors.secondary : colors.textSecondary}
                      size={18}
                      strokeWidth={2}
                    />
                  }
                  rightElement={
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        setShowPassword((prev) => !prev);
                      }}
                      style={styles.eyeBtn}
                      hitSlop={10}
                    >
                      {showPassword ? (
                        <EyeOff color={colors.textSecondary} size={18} />
                      ) : (
                        <Eye color={colors.textSecondary} size={18} />
                      )}
                    </Pressable>
                  }
                  placeholder="••••••••"
                  value={formik.values.password}
                  onChangeText={(text) => {
                    if (formBannerError) setFormBannerError('');
                    formik.handleChange('password')(text);
                  }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => {
                    setFocusedField(null);
                    formik.setFieldTouched('password', true);
                  }}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmitForm}
                />
              </Animated.View>

              {/* Forgot Password */}
              <Animated.View entering={FadeInDown.delay(220).duration(400)}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    const clean = formik.values.email.trim().toLowerCase();
                    router.push({
                      pathname: '/(auth)/forgot-password',
                      params: clean.includes('@') ? { email: clean } : {},
                    } as any);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [styles.forgotBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
                </Pressable>
              </Animated.View>

              {/* Login Button */}
              <Animated.View entering={FadeInDown.delay(260).duration(420).springify()}>
                <AnimatedPrimaryButton
                  title="Continue"
                  onPress={handleSubmitForm}
                  loading={loading}
                  disabled={googleLoading}
                  rightIcon={<ArrowRight color="#FFF" size={18} strokeWidth={2.5} />}
                />
              </Animated.View>

              {/* Divider */}
              <Animated.View entering={FadeInDown.delay(310).duration(400)}>
                <AuthDivider />
              </Animated.View>

              {/* Google */}
              <Animated.View entering={FadeInDown.delay(350).duration(420).springify()}>
                <GoogleButton onPress={handleGoogleLogin} loading={googleLoading} />
              </Animated.View>

              {/* Sign Up Link */}
              <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.signupRow}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/(auth)/register');
                  }}
                  hitSlop={10}
                  style={({ pressed }) => [styles.signupInner, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.signupText, { color: colors.textSecondary }]}>
                    Don't have an account?{' '}
                  </Text>
                  <Text style={[styles.signupLink, { color: colors.secondary }]}>Sign up</Text>
                </Pressable>
              </Animated.View>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthStatusModal config={modalConfig} onClose={closeModal} />
      <View nativeID="clerk-captcha" />
    </View>
  );
}

const getStyles = (colors: ColorTheme) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: 24,
      justifyContent: 'center',
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 14,
    },
    errorBannerText: {
      flex: 1,
      fontFamily: 'Poppins_500Medium',
      fontSize: 12.5,
      lineHeight: 18,
    },
    eyeBtn: {
      padding: 4,
    },
    forgotBtn: {
      alignSelf: 'flex-end',
      marginBottom: 20,
      marginTop: -2,
    },
    forgotText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
    },
    signupRow: {
      marginTop: 22,
      alignItems: 'center',
    },
    signupInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    signupText: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 14,
    },
    signupLink: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 14,
    },
    otpBadgeCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 18,
      alignItems: 'center',
      marginBottom: 20,
      gap: 10,
    },
    otpIconWrap: {
      width: 54,
      height: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    otpSub: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 13.5,
      textAlign: 'center',
      lineHeight: 21,
    },
    otpEmail: {
      fontFamily: 'Poppins_600SemiBold',
    },
    otpInput: {
      letterSpacing: 8,
      fontSize: 20,
      fontFamily: 'Poppins_600SemiBold',
      textAlign: 'center',
    },
    resendRow: {
      alignItems: 'center',
      marginTop: 18,
      paddingVertical: 6,
    },
  });
