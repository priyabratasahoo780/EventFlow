
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { useState, useEffect, useCallback, useRef, ComponentRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
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
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, ShieldCheck, ArrowRight, Fingerprint, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useGoogleAuth } from '../../services/clerkAuth';
import {
  getAdminVaultSession,
  authenticateWithBiometrics,
  saveAdminVaultSession,
} from '../../services/biometricAuth';
import { useFormik } from 'formik';
import * as yup from 'yup';

const validationSchema = yup.object().shape({
  email: yup.string().trim().required('Email or username is required'),
  password: yup.string().required('Password is required'),
});

export default function LoginScreen() {
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();
  const dark = isDark();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();

  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [emailFor2FA, setEmailFor2FA] = useState('');
  const [otp, setOtp] = useState('');
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [adminEmail, setAdminEmail] = useState('admin@eventflow.app');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const autoSentTokenRef = useRef<string | null>(null);
  const login = useAuthStore((state) => state.login);
  const setPostLoginRoute = useAuthStore((state) => state.setPostLoginRoute);
  const router = useRouter();
  const { signInWithGoogle } = useGoogleAuth();

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
    try {
      await api.post('/auth/2fa/send', { email, tempToken: token });
      setResendCooldown(30);
    } catch (err: any) {
      const status = err?.response?.status;
      const serverError = err?.response?.data?.error;

      if (status === 401) {
        setRequires2FA(false);
        setOtp('');
        setTempToken('');
        autoSentTokenRef.current = null;
        Alert.alert('Session Expired', serverError || 'Please sign in again to continue.');
      } else {
        Alert.alert(
          'Code Delivery Failed',
          serverError || 'Could not send the verification code. Please tap Resend Code.'
        );
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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await login(res.data.token, res.data.user);
          router.replace('/(tabs)');
        }
      } catch (err: any) {
        triggerShake();
        const isNotFound = err.response?.data?.accountNotFound || err.response?.status === 404;
        const serverError = err.response?.data?.error || err.response?.data?.message;

        if (isNotFound) {
          Alert.alert(
            'Account Not Found',
            'No account found with this email/username. Want to create one?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Create Account', onPress: () => router.push('/(auth)/register') },
            ]
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

  const handleSubmitForm = async () => {
    const errors = await formik.validateForm();
    if (Object.keys(errors).length > 0) {
      formik.setTouched({ email: true, password: true });
      triggerShake();
      return;
    }
    formik.handleSubmit();
  };

  const handleVerify2FA = async () => {
    if (!otp || otp.length !== 6) {
      triggerShake();
      Alert.alert('Invalid Code', 'Please enter the 6-digit code sent to your email.');
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await api.post('/auth/2fa/verify', { email: emailFor2FA, otp, tempToken });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await login(res.data.token, res.data.user);
      router.replace('/(tabs)');
    } catch (err: any) {
      triggerShake();
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
        sessionId: result.sessionId,
        email: result.user.email,
        name: result.user.name,
        profilePhoto: result.user.profilePhoto,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await login(res.data.token, res.data.user);
      router.replace('/(tabs)');
    } catch (err: any) {
      const isCancelled =
        err?.code === 'ERR_REQUEST_CANCELED' ||
        err?.message?.includes('cancel') ||
        err?.message?.includes('dismissed');
      if (!isCancelled) {
        Alert.alert(
          'Google Sign-In Failed',
          err?.response?.data?.error || 'Could not complete Google sign-in. Please try again.'
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAdminFingerprintEntry = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const vault = await getAdminVaultSession();

    if (vault?.token && vault?.user?.role === 'admin') {
      const bio = await authenticateWithBiometrics('Scan Fingerprint to open EventFlow Admin Portal');
      if (bio.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPostLoginRoute('/admin');
        await login(vault.token, vault.user);
        return;
      }
      if (!bio.unavailable) {
        if (bio.error && !bio.error.includes('cancelled')) {
          Alert.alert('Fingerprint Check', bio.error);
        }
        // Allow manual Admin login modal if biometric didn't match or user tapped Use Password
        setAdminModalVisible(true);
        return;
      }
    }

    setAdminModalVisible(true);
  };

  const handleAdminCredentialLogin = async () => {
    if (!adminEmail.trim() || !adminPassword) {
      Alert.alert('Admin Credentials Required', 'Enter Admin email and password.');
      return;
    }
    setAdminLoading(true);
    try {
      const res = await api.post('/auth/login', {
        email: adminEmail.trim().toLowerCase(),
        password: adminPassword,
      });

      if (res.data?.user?.role !== 'admin') {
        Alert.alert('Access Denied', 'This account does not have Administrator privileges.');
        return;
      }

      await saveAdminVaultSession(res.data.token, res.data.user);
      setAdminModalVisible(false);
      setAdminPassword('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPostLoginRoute('/admin');
      await login(res.data.token, res.data.user);
    } catch (err: any) {
      Alert.alert('Admin Login Failed', err?.response?.data?.error || 'Invalid admin credentials.');
    } finally {
      setAdminLoading(false);
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
          contentContainerStyle={[
            styles.container,
            {
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
                leftIcon={
                  <Lock
                    color={focusedField === 'otp' ? colors.secondary : colors.textSecondary}
                    size={18}
                    strokeWidth={2}
                  />
                }
                placeholder="123456"
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, ''))}
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
                  onChangeText={formik.handleChange('email')}
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
                  onChangeText={formik.handleChange('password')}
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
                    router.push('/(auth)/forgot-password');
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

              {/* Admin Biometric Portal Trigger */}
              <Animated.View entering={FadeInDown.delay(440).duration(400)} style={{ marginTop: 14, alignItems: 'center' }}>
                <Pressable
                  onPress={handleAdminFingerprintEntry}
                  style={({ pressed }) => [
                    styles.adminTriggerBtn,
                    { backgroundColor: colors.card, borderColor: dark ? colors.border : '#EAE2D8' },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Fingerprint color={colors.secondary} size={17} strokeWidth={2.2} />
                  <Text style={[styles.adminTriggerText, { color: colors.text }]}>
                    Admin Fingerprint Portal
                  </Text>
                </Pressable>
              </Animated.View>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* First-Time / Password Fallback Admin Login Modal */}
      <Modal
        visible={adminModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAdminModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={[styles.otpIconWrap, { width: 42, height: 42, backgroundColor: colors.secondaryLight }]}>
                <Shield color={colors.secondary} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Admin Portal Access</Text>
                <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                  Sign in once to link your Fingerprint unlock
                </Text>
              </View>
            </View>

            <TextInput
              value={adminEmail}
              onChangeText={setAdminEmail}
              placeholder="admin@eventflow.app"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />
            <TextInput
              value={adminPassword}
              onChangeText={setAdminPassword}
              placeholder="Admin Password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <Pressable
                onPress={() => setAdminModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
              >
                <Text style={{ fontFamily: 'Poppins_600SemiBold', color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAdminCredentialLogin}
                disabled={adminLoading}
                style={[styles.modalBtn, { backgroundColor: colors.secondary }]}
              >
                {adminLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ fontFamily: 'Poppins_700Bold', color: '#FFF' }}>Enter Admin</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    // 2FA panel styles
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
    adminTriggerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
    },
    adminTriggerText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      borderRadius: 22,
      padding: 20,
      borderWidth: 1,
      gap: 12,
    },
    modalTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 17,
    },
    modalSub: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 12,
    },
    modalInput: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontFamily: 'Poppins_500Medium',
      fontSize: 14,
    },
    modalBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
    },
  });
