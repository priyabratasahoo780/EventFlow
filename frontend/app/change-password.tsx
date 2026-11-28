import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { ColorTheme } from '../constants/theme';
import { useResponsive } from '../constants/responsive';
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
import {
  AuthBackground,
  AuthHeader,
  AuthInput,
  AnimatedPrimaryButton,
} from '../components/AuthUI';
import AuthStatusModal, { AuthModalConfig } from '../components/AuthStatusModal';
import api, { extractApiError } from '../services/api';
import { useRouter } from 'expo-router';
import {
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { useOtpCooldown } from '../hooks/useOtpCooldown';

const currentPwdSchema = yup.object().shape({
  currentPassword: yup.string().required('Current password is required'),
});

const otpSchema = yup.object().shape({
  otp: yup
    .string()
    .trim()
    .matches(/^\d{6}$/, 'Enter the 6-digit 2FA code')
    .required('6-digit 2FA OTP is required'),
});

const newPwdSchema = yup.object().shape({
  newPassword: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password requires an uppercase letter (A-Z)')
    .matches(/[a-z]/, 'Password requires a lowercase letter (a-z)')
    .matches(/[0-9]/, 'Password requires a number (0-9)')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/, 'Password requires a special symbol')
    .required('New password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('newPassword')], 'Passwords do not match')
    .required('Please confirm your new password'),
});

const INITIAL_MODAL: AuthModalConfig = {
  visible: false,
  type: 'error',
  title: '',
  message: '',
};

export default function ChangePasswordScreen() {
  const { getColors, isDark } = useThemeStore();
  const { user } = useAuthStore();
  const colors = getColors();
  const dark = isDark();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { authMaxWidth, isSmall } = useResponsive();
  const router = useRouter();

  const [step, setStep] = useState<'verify_current' | 'verify_otp' | 'set_password'>('verify_current');
  const [verifiedEmail, setVerifiedEmail] = useState(user?.email || '');
  const [resetToken, setResetToken] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const {
    remainingSec: resendCooldown,
    formattedTime: resendFormatted,
    startCooldown,
  } = useOtpCooldown(120);
  const [bannerError, setBannerError] = useState('');
  const [modalConfig, setModalConfig] = useState<AuthModalConfig>(INITIAL_MODAL);

  const confirmPwdRef = useRef<ComponentRef<typeof TextInput>>(null);

  const closeModal = useCallback(() => {
    setModalConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    shakeX.value = withSequence(
      withTiming(-9, { duration: 55 }),
      withTiming(9, { duration: 55 }),
      withTiming(-6, { duration: 55 }),
      withTiming(6, { duration: 55 }),
      withTiming(-3, { duration: 45 }),
      withTiming(0, { duration: 45 })
    );
  }, [shakeX]);

  const currentFormik = useFormik({
    initialValues: { currentPassword: '' },
    validationSchema: currentPwdSchema,
    onSubmit: async (values) => {
      if (loading) return;
      setLoading(true);
      setBannerError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      try {
        const res = await api.post('/auth/change-password/send-otp', {
          currentPassword: values.currentPassword,
        });
        setVerifiedEmail(res.data?.email || user?.email || '');
        startCooldown(120);
        setStep('verify_otp');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (err: any) {
        const retrySec = Number(err?.response?.data?.retryAfterSeconds || 0);
        if (err?.response?.status === 429 && retrySec > 0) {
          setVerifiedEmail(user?.email || '');
          startCooldown(retrySec);
          setStep('verify_otp');
          return;
        }
        triggerShake();
        const parsed = extractApiError(err, 'Could not send 2FA verification code.');
        setBannerError(parsed.message);
        if (parsed.field === 'currentPassword') {
          currentFormik.setFieldError('currentPassword', parsed.message);
          currentFormik.setFieldTouched('currentPassword', true, false);
        }
        setModalConfig({
          visible: true,
          type: parsed.isNetworkError || parsed.isTimeout ? 'network' : 'error',
          title: parsed.title || 'Verification Failed',
          message: parsed.message,
        });
      } finally {
        setLoading(false);
      }
    },
  });

  const otpFormik = useFormik({
    initialValues: { otp: '' },
    validationSchema: otpSchema,
    onSubmit: async (values) => {
      if (loading) return;
      setLoading(true);
      setBannerError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      try {
        const res = await api.post('/auth/change-password/verify-otp', {
          otp: values.otp.trim(),
        });
        setResetToken(res.data?.resetToken || '');
        setStep('set_password');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (err: any) {
        triggerShake();
        const parsed = extractApiError(err, 'OTP is wrong. Please check your code and try again.');
        setBannerError(parsed.message);
        setModalConfig({
          visible: true,
          type: parsed.isNetworkError || parsed.isTimeout ? 'network' : 'error',
          title: 'Invalid OTP',
          message: parsed.message,
        });
      } finally {
        setLoading(false);
      }
    },
  });

  const newPwdFormik = useFormik({
    initialValues: { newPassword: '', confirmPassword: '' },
    validationSchema: newPwdSchema,
    onSubmit: async (values) => {
      if (loading) return;
      setLoading(true);
      setBannerError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      try {
        await api.post('/auth/change-password', {
          currentPassword: currentFormik.values.currentPassword,
          resetToken,
          newPassword: values.newPassword,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setModalConfig({
          visible: true,
          type: 'account_exists',
          title: 'Password Updated',
          highlightText: verifiedEmail,
          message: 'Your password has been changed securely with 2FA verification.',
          primaryAction: {
            label: 'Back to Settings',
            onPress: () => {
              closeModal();
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)/settings' as any);
            },
          },
        });
      } catch (err: any) {
        triggerShake();
        const parsed = extractApiError(err, 'Unable to update password. Please try again.');
        setBannerError(parsed.message);
        setModalConfig({
          visible: true,
          type: parsed.isNetworkError || parsed.isTimeout ? 'network' : 'error',
          title: parsed.title || 'Update Failed',
          message: parsed.message,
        });
      } finally {
        setLoading(false);
      }
    },
  });

  const handleSendOtp = async () => {
    Keyboard.dismiss();
    setBannerError('');
    const errors = await currentFormik.validateForm();
    if (errors.currentPassword) {
      currentFormik.setTouched({ currentPassword: true });
      setBannerError(String(errors.currentPassword));
      triggerShake();
      return;
    }
    currentFormik.handleSubmit();
  };

  const handleVerifyOtp = async () => {
    Keyboard.dismiss();
    setBannerError('');
    const errors = await otpFormik.validateForm();
    if (errors.otp) {
      otpFormik.setTouched({ otp: true });
      setBannerError(String(errors.otp));
      triggerShake();
      return;
    }
    otpFormik.handleSubmit();
  };

  const handleResendOtp = async () => {
    if (otpResending || resendCooldown > 0) return;
    setOtpResending(true);
    setBannerError('');
    try {
      await api.post('/auth/change-password/send-otp', {
        currentPassword: currentFormik.values.currentPassword,
      });
      startCooldown(120);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      const retrySec = Number(err?.response?.data?.retryAfterSeconds || 0);
      if (err?.response?.status === 429 && retrySec > 0) {
        startCooldown(retrySec);
      }
      triggerShake();
      const parsed = extractApiError(err, 'Could not resend 2FA code. Please try again.');
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

  const handleConfirmChange = async () => {
    Keyboard.dismiss();
    setBannerError('');
    const errors = await newPwdFormik.validateForm();
    const firstErr = errors.newPassword || errors.confirmPassword;
    if (firstErr) {
      newPwdFormik.setTouched({ newPassword: true, confirmPassword: true });
      setBannerError(String(firstErr));
      triggerShake();
      return;
    }
    newPwdFormik.handleSubmit();
  };

  const headerTitle =
    step === 'verify_current'
      ? 'Change Password'
      : step === 'verify_otp'
        ? '2FA Verification'
        : 'Set New Password';

  const headerSubtitle =
    step === 'verify_current'
      ? 'Verify your current password to receive a 2FA email code.'
      : step === 'verify_otp'
        ? 'Enter the 6-digit OTP sent to your email and tap Verify OTP.'
        : 'OTP verified! Now enter your new strong password.';

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
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[
            styles.container,
            {
              width: '100%',
              maxWidth: authMaxWidth,
              alignSelf: 'center',
              paddingHorizontal: isSmall ? 18 : 24,
              paddingTop: Math.max(insets.top + 16, 28),
              paddingBottom: Math.max(insets.bottom + 28, 40),
            },
          ]}
        >
          <AuthHeader
            title={headerTitle}
            subtitle={headerSubtitle}
            onBack={() => {
              if (step === 'set_password') {
                setStep('verify_otp');
                setBannerError('');
                newPwdFormik.resetForm();
              } else if (step === 'verify_otp') {
                setStep('verify_current');
                setBannerError('');
                otpFormik.resetForm();
              } else if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/settings' as any);
              }
            }}
          />

          {bannerError ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              exiting={FadeOutUp.duration(180)}
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

          {step === 'verify_current' && (
            <Animated.View entering={FadeInDown.duration(360)} style={shakeStyle}>
              <AuthInput
                colors={colors}
                isDark={dark}
                label="CURRENT PASSWORD"
                isFocused={focusedField === 'currentPassword'}
                error={currentFormik.errors.currentPassword}
                touched={currentFormik.touched.currentPassword}
                leftIcon={
                  <Lock
                    color={
                      focusedField === 'currentPassword'
                        ? colors.secondary
                        : colors.textSecondary
                    }
                    size={19}
                  />
                }
                rightElement={
                  <Pressable
                    onPress={() => setShowCurrentPwd((prev) => !prev)}
                    hitSlop={10}
                    style={styles.eyeBtn}
                  >
                    {showCurrentPwd ? (
                      <EyeOff color={colors.textSecondary} size={19} />
                    ) : (
                      <Eye color={colors.textSecondary} size={19} />
                    )}
                  </Pressable>
                }
                placeholder="Enter current password"
                value={currentFormik.values.currentPassword}
                onChangeText={(text) => {
                  currentFormik.handleChange('currentPassword')(text);
                  if (bannerError) setBannerError('');
                }}
                onFocus={() => setFocusedField('currentPassword')}
                onBlur={() => {
                  setFocusedField(null);
                  currentFormik.setFieldTouched('currentPassword', true);
                }}
                secureTextEntry={!showCurrentPwd}
                returnKeyType="done"
                onSubmitEditing={handleSendOtp}
              />

              <View style={{ marginTop: 10 }}>
                <AnimatedPrimaryButton
                  title="Send 2FA Code"
                  onPress={handleSendOtp}
                  loading={loading}
                  rightIcon={<ArrowRight color="#FFF" size={18} strokeWidth={2.5} />}
                />
              </View>
            </Animated.View>
          )}

          {step === 'verify_otp' && (
            <Animated.View entering={FadeInDown.duration(380)} style={shakeStyle}>
              <Animated.View
                entering={ZoomIn.duration(360)}
                style={[
                  styles.otpBadgeCard,
                  {
                    backgroundColor: dark
                      ? 'rgba(139, 92, 246, 0.14)'
                      : 'rgba(124, 58, 237, 0.08)',
                    borderColor: dark
                      ? 'rgba(139, 92, 246, 0.3)'
                      : 'rgba(124, 58, 237, 0.18)',
                  },
                ]}
              >
                <View
                  style={[styles.otpIconWrap, { backgroundColor: colors.secondaryLight }]}
                >
                  <ShieldCheck color={colors.secondary} size={28} strokeWidth={2.2} />
                </View>
                <Text style={[styles.otpSub, { color: colors.textSecondary }]}>
                  2FA code sent to{' '}
                  <Text style={[styles.otpEmail, { color: colors.text }]}>
                    {verifiedEmail}
                  </Text>
                </Text>
              </Animated.View>

              <AuthInput
                colors={colors}
                isDark={dark}
                label="2FA VERIFICATION CODE"
                isFocused={focusedField === 'otp'}
                error={otpFormik.errors.otp}
                touched={otpFormik.touched.otp}
                leftIcon={
                  <KeyRound
                    color={
                      focusedField === 'otp' ? colors.secondary : colors.textSecondary
                    }
                    size={19}
                  />
                }
                placeholder="123456"
                value={otpFormik.values.otp}
                onChangeText={(text) => {
                  otpFormik.setFieldValue('otp', text.replace(/[^0-9]/g, '').slice(0, 6));
                  if (bannerError) setBannerError('');
                }}
                onFocus={() => setFocusedField('otp')}
                onBlur={() => {
                  setFocusedField(null);
                  otpFormik.setFieldTouched('otp', true);
                }}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
                style={styles.otpInput}
              />

              <AnimatedPrimaryButton
                title="Verify OTP"
                onPress={handleVerifyOtp}
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
                    {resendCooldown > 0 ? `Resend 2FA code in ${resendFormatted}` : 'Resend 2FA Code'}
                  </Text>
                )}
              </Pressable>
            </Animated.View>
          )}

          {step === 'set_password' && (
            <Animated.View entering={FadeInDown.duration(380)} style={shakeStyle}>
              <Animated.View
                entering={ZoomIn.duration(340)}
                style={[
                  styles.otpBadgeCard,
                  {
                    backgroundColor: colors.successLight,
                    borderColor: colors.success,
                  },
                ]}
              >
                <View style={[styles.otpIconWrap, { backgroundColor: colors.card }]}>
                  <CheckCircle2 color={colors.success} size={28} strokeWidth={2.2} />
                </View>
                <Text style={[styles.otpSub, { color: colors.text }]}>
                  2FA OTP Verified! Set your new password below.
                </Text>
              </Animated.View>

              <AuthInput
                colors={colors}
                isDark={dark}
                label="NEW PASSWORD"
                isFocused={focusedField === 'newPassword'}
                error={newPwdFormik.errors.newPassword}
                touched={newPwdFormik.touched.newPassword}
                leftIcon={
                  <Lock
                    color={
                      focusedField === 'newPassword'
                        ? colors.secondary
                        : colors.textSecondary
                    }
                    size={19}
                  />
                }
                rightElement={
                  <Pressable
                    onPress={() => setShowNewPwd((prev) => !prev)}
                    hitSlop={10}
                    style={styles.eyeBtn}
                  >
                    {showNewPwd ? (
                      <EyeOff color={colors.textSecondary} size={19} />
                    ) : (
                      <Eye color={colors.textSecondary} size={19} />
                    )}
                  </Pressable>
                }
                placeholder="Min 8 chars, A-Z, 0-9, symbol"
                value={newPwdFormik.values.newPassword}
                onChangeText={(text) => {
                  newPwdFormik.handleChange('newPassword')(text);
                  if (bannerError) setBannerError('');
                }}
                onFocus={() => setFocusedField('newPassword')}
                onBlur={() => {
                  setFocusedField(null);
                  newPwdFormik.setFieldTouched('newPassword', true);
                }}
                secureTextEntry={!showNewPwd}
                returnKeyType="next"
                onSubmitEditing={() => confirmPwdRef.current?.focus()}
              />

              <AuthInput
                ref={confirmPwdRef}
                colors={colors}
                isDark={dark}
                label="CONFIRM NEW PASSWORD"
                isFocused={focusedField === 'confirmPassword'}
                error={newPwdFormik.errors.confirmPassword}
                touched={newPwdFormik.touched.confirmPassword}
                leftIcon={
                  <Lock
                    color={
                      focusedField === 'confirmPassword'
                        ? colors.secondary
                        : colors.textSecondary
                    }
                    size={19}
                  />
                }
                rightElement={
                  <Pressable
                    onPress={() => setShowConfirmPwd((prev) => !prev)}
                    hitSlop={10}
                    style={styles.eyeBtn}
                  >
                    {showConfirmPwd ? (
                      <EyeOff color={colors.textSecondary} size={19} />
                    ) : (
                      <Eye color={colors.textSecondary} size={19} />
                    )}
                  </Pressable>
                }
                placeholder="Re-enter new password"
                value={newPwdFormik.values.confirmPassword}
                onChangeText={(text) => {
                  newPwdFormik.handleChange('confirmPassword')(text);
                  if (bannerError) setBannerError('');
                }}
                onFocus={() => setFocusedField('confirmPassword')}
                onBlur={() => {
                  setFocusedField(null);
                  newPwdFormik.setFieldTouched('confirmPassword', true);
                }}
                secureTextEntry={!showConfirmPwd}
                returnKeyType="done"
                onSubmitEditing={handleConfirmChange}
              />

              <AnimatedPrimaryButton
                title="Update Password"
                onPress={handleConfirmChange}
                loading={loading}
                rightIcon={<ArrowRight color="#FFF" size={18} strokeWidth={2.5} />}
              />
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
