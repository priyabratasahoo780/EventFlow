import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { useResponsive } from '../../constants/responsive';
import { useState, useEffect, useRef, useCallback, ComponentRef } from 'react';
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
import {
  AuthBackground,
  AuthHeader,
  AuthInput,
  AnimatedPrimaryButton,
} from '../../components/AuthUI';
import AuthStatusModal, { AuthModalConfig } from '../../components/AuthStatusModal';
import api, { extractApiError, warmUpBackend } from '../../services/api';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useFormik } from 'formik';
import * as yup from 'yup';

const emailSchema = yup.object().shape({
  email: yup.string().email('Invalid email address').required('Registered email is required'),
});

const resetSchema = yup.object().shape({
  otp: yup
    .string()
    .matches(/^\d{6}$/, 'Enter the 6-digit verification code')
    .required('6-digit OTP is required'),
  newPassword: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password requires an uppercase letter (A-Z)')
    .matches(/[a-z]/, 'Password requires a lowercase letter (a-z)')
    .matches(/[0-9]/, 'Password requires a number (0-9)')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password requires a special symbol')
    .required('New password is required'),
});

const INITIAL_MODAL: AuthModalConfig = {
  visible: false,
  type: 'error',
  title: '',
  message: '',
};

export default function ForgotPasswordScreen() {
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();
  const dark = isDark();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { authMaxWidth, isSmall } = useResponsive();
  const params = useLocalSearchParams<{ email?: string }>();
  const initialEmail = typeof params.email === 'string' ? params.email.trim() : '';

  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [targetEmail, setTargetEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [bannerError, setBannerError] = useState('');
  const [modalConfig, setModalConfig] = useState<AuthModalConfig>(INITIAL_MODAL);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const router = useRouter();

  const closeModal = useCallback(() => {
    setModalConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    warmUpBackend();
  }, []);

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

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const emailFormik = useFormik({
    initialValues: { email: initialEmail },
    enableReinitialize: true,
    validationSchema: emailSchema,
    onSubmit: async (values) => {
      if (loading) return;
      const cleanEmail = values.email.trim().toLowerCase();
      setLoading(true);
      setBannerError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        await api.post('/auth/forgot-password/send-otp', { email: cleanEmail });
        setTargetEmail(cleanEmail);
        setResendCooldown(30);
        setStep('verify');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err: any) {
        triggerShake();
        const parsed = extractApiError(
          err,
          'Could not send reset verification code. Please check your email.'
        );
        setBannerError(parsed.message);

        if (parsed.accountNotFound) {
          emailFormik.setFieldError('email', 'Email not registered');
          emailFormik.setFieldTouched('email', true, false);
          setModalConfig({
            visible: true,
            type: 'account_not_found',
            title: 'Account Not Found',
            highlightText: cleanEmail,
            message: 'No EventFlow account exists with this email address. Create a new account instead?',
            primaryAction: {
              label: 'Create Account',
              onPress: () => {
                closeModal();
                router.push({
                  pathname: '/(auth)/register',
                  params: { email: cleanEmail },
                } as any);
              },
            },
            secondaryAction: {
              label: 'Try Different Email',
              onPress: closeModal,
            },
          });
        } else {
          setModalConfig({
            visible: true,
            type: parsed.isNetworkError || parsed.isTimeout ? 'network' : 'error',
            title: parsed.title || 'Request Failed',
            message: parsed.message,
          });
        }
      } finally {
        setLoading(false);
      }
    },
  });

  const resetFormik = useFormik({
    initialValues: { otp: '', newPassword: '' },
    validationSchema: resetSchema,
    onSubmit: async (values) => {
      if (loading) return;
      setLoading(true);
      setBannerError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        await api.post('/auth/forgot-password', {
          email: targetEmail,
          otp: values.otp.trim(),
          newPassword: values.newPassword,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setModalConfig({
          visible: true,
          type: 'account_exists',
          title: 'Password Reset Successful',
          highlightText: targetEmail,
          message: 'Your password has been updated securely. You can now log in with your new password.',
          primaryAction: {
            label: 'Go to Login',
            onPress: () => {
              closeModal();
              router.replace({
                pathname: '/(auth)/login',
                params: { email: targetEmail },
              } as any);
            },
          },
        });
      } catch (err: any) {
        triggerShake();
        const parsed = extractApiError(err, 'Unable to verify OTP or update password.');
        setBannerError(parsed.message);
        setModalConfig({
          visible: true,
          type: parsed.isNetworkError || parsed.isTimeout ? 'network' : 'error',
          title: parsed.title || 'Reset Failed',
          message: parsed.message,
        });
      } finally {
        setLoading(false);
      }
    },
  });

  const handleRequestOtp = async () => {
    setBannerError('');
    const errors = await emailFormik.validateForm();
    if (Object.keys(errors).length > 0) {
      emailFormik.setTouched({ email: true });
      triggerShake();
      return;
    }
    emailFormik.handleSubmit();
  };

  const handleResendOtp = async () => {
    if (!targetEmail || otpResending || resendCooldown > 0) return;
    setOtpResending(true);
    setBannerError('');
    try {
      await api.post('/auth/forgot-password/send-otp', { email: targetEmail });
      setResendCooldown(30);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      triggerShake();
      const parsed = extractApiError(err, 'Could not resend verification code. Please try again.');
      setBannerError(parsed.message);
      setModalConfig({
        visible: true,
        type: parsed.isNetworkError || parsed.isTimeout ? 'network' : 'error',
        title: 'Resend Failed',
        message: parsed.message,
      });
    } finally {
      setOtpResending(false);
    }
  };

  const handleResetSubmit = async () => {
    setBannerError('');
    const errors = await resetFormik.validateForm();
    if (Object.keys(errors).length > 0) {
      resetFormik.setTouched({ otp: true, newPassword: true });
      triggerShake();
      return;
    }
    resetFormik.handleSubmit();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuthBackground />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
        >
          <AuthHeader
            title={step === 'verify' ? 'Verify & Reset' : 'Forgot Password?'}
            subtitle={
              step === 'verify'
                ? 'Enter the 6-digit code sent to your email and set a new password.'
                : 'Enter your registered email to receive a secure verification OTP.'
            }
            onBack={() => {
              setBannerError('');
              if (step === 'verify') {
                setStep('request');
                resetFormik.resetForm();
              } else {
                router.back();
              }
            }}
          />

          {bannerError ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={[
                styles.errorBanner,
                { backgroundColor: colors.dangerLight, borderColor: colors.error },
              ]}
            >
              <AlertCircle color={colors.error} size={17} strokeWidth={2.2} />
              <Text style={[styles.errorBannerText, { color: colors.error }]}>
                {bannerError}
              </Text>
            </Animated.View>
          ) : null}

          {step === 'request' ? (
            <Animated.View key="step-request" style={shakeStyle}>
              <Animated.View entering={FadeInDown.delay(110).duration(420).springify()}>
                <AuthInput
                  label="REGISTERED EMAIL"
                  colors={colors}
                  isDark={dark}
                  isFocused={focusedField === 'email'}
                  error={emailFormik.errors.email}
                  touched={emailFormik.touched.email}
                  isValid={emailFormik.values.email.trim().length > 0 && !emailFormik.errors.email}
                  leftIcon={
                    <Mail
                      color={focusedField === 'email' ? colors.secondary : colors.textSecondary}
                      size={18}
                      strokeWidth={2}
                    />
                  }
                  placeholder="your.email@example.com"
                  value={emailFormik.values.email}
                  onChangeText={(text) => {
                    if (bannerError) setBannerError('');
                    emailFormik.handleChange('email')(text);
                  }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => {
                    setFocusedField(null);
                    emailFormik.setFieldTouched('email', true);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="done"
                  onSubmitEditing={handleRequestOtp}
                />
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(190).duration(420).springify()}
                style={{ marginTop: 8 }}
              >
                <AnimatedPrimaryButton
                  title="Send Verification Code"
                  onPress={handleRequestOtp}
                  loading={loading}
                  rightIcon={<ArrowRight color="#FFF" size={18} strokeWidth={2.5} />}
                />
              </Animated.View>
            </Animated.View>
          ) : (
            <Animated.View
              key="step-verify"
              entering={FadeInDown.duration(350).springify()}
              exiting={FadeOutUp.duration(200)}
              style={shakeStyle}
            >
              <Animated.View
                entering={ZoomIn.delay(80).duration(350).springify()}
                style={[
                  styles.otpBadgeCard,
                  { backgroundColor: colors.card, borderColor: dark ? colors.border : '#EAE2D8' },
                ]}
              >
                <View style={[styles.otpIconWrap, { backgroundColor: colors.secondaryLight }]}>
                  <ShieldCheck color={colors.secondary} size={28} strokeWidth={2} />
                </View>
                <Text style={[styles.otpSub, { color: colors.textSecondary }]}>
                  6-digit verification code sent to{'\n'}
                  <Text style={[styles.otpEmail, { color: colors.text }]}>{targetEmail}</Text>
                </Text>
              </Animated.View>

              <AuthInput
                label="6-DIGIT OTP CODE"
                colors={colors}
                isDark={dark}
                isFocused={focusedField === 'otp'}
                error={resetFormik.errors.otp}
                touched={resetFormik.touched.otp}
                isValid={/^\d{6}$/.test(resetFormik.values.otp)}
                leftIcon={
                  <KeyRound
                    color={focusedField === 'otp' ? colors.secondary : colors.textSecondary}
                    size={18}
                    strokeWidth={2}
                  />
                }
                placeholder="123456"
                value={resetFormik.values.otp}
                onChangeText={(t) => {
                  if (bannerError) setBannerError('');
                  resetFormik.setFieldValue('otp', t.replace(/[^0-9]/g, ''));
                }}
                onFocus={() => setFocusedField('otp')}
                onBlur={() => {
                  setFocusedField(null);
                  resetFormik.setFieldTouched('otp', true);
                }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
                style={styles.otpInput}
              />

              <AuthInput
                ref={passwordRef}
                label="NEW PASSWORD"
                colors={colors}
                isDark={dark}
                isFocused={focusedField === 'newPassword'}
                error={resetFormik.errors.newPassword}
                touched={resetFormik.touched.newPassword}
                leftIcon={
                  <Lock
                    color={focusedField === 'newPassword' ? colors.secondary : colors.textSecondary}
                    size={18}
                    strokeWidth={2}
                  />
                }
                rightElement={
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setShowPassword((prev) => !prev);
                    }}
                    hitSlop={10}
                  >
                    {showPassword ? (
                      <EyeOff color={colors.textSecondary} size={18} />
                    ) : (
                      <Eye color={colors.textSecondary} size={18} />
                    )}
                  </Pressable>
                }
                placeholder="Min 8 chars, A-Z, a-z, 0-9, !@#"
                value={resetFormik.values.newPassword}
                onChangeText={resetFormik.handleChange('newPassword')}
                onFocus={() => setFocusedField('newPassword')}
                onBlur={() => {
                  setFocusedField(null);
                  resetFormik.setFieldTouched('newPassword', true);
                }}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleResetSubmit}
              />

              <AnimatedPrimaryButton
                title="Reset Password"
                onPress={handleResetSubmit}
                loading={loading}
                rightIcon={<ArrowRight color="#FFF" size={18} strokeWidth={2.5} />}
              />

              <Pressable
                onPress={handleResendOtp}
                disabled={otpResending || resendCooldown > 0}
                style={styles.resendRow}
              >
                {otpResending ? (
                  <ActivityIndicator size="small" color={colors.secondary} />
                ) : (
                  <Text
                    style={[
                      styles.resendText,
                      { color: resendCooldown > 0 ? colors.textSecondary : colors.secondary },
                    ]}
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                  </Text>
                )}
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthStatusModal config={modalConfig} onClose={closeModal} />
    </View>
  );
}

const getStyles = (_colors: ColorTheme) =>
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
    resendText: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 14,
    },
  });
