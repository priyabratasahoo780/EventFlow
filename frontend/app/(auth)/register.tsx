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
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeOutUp,
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
import {
  Eye,
  EyeOff,
  Check,
  X,
  ShieldCheck,
  User,
  AtSign,
  Mail,
  MapPin,
  Lock,
  ArrowRight,
  AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { useGoogleAuth } from '../../services/clerkAuth';

const validationSchema = yup.object().shape({
  name: yup.string().trim().min(2, 'Name must be at least 2 characters').required('Full Name is required'),
  username: yup
    .string()
    .trim()
    .test('min-if-provided', 'Username must be at least 3 characters', (val) => !val || val.length >= 3)
    .max(40, 'Max 40 chars')
    .matches(/^[a-zA-Z0-9_.-]*$/, 'Letters, numbers, _, ., - only'),
  email: yup.string().trim().email('Invalid email address').required('Email is required'),
  city: yup.string().trim().max(80, 'City name is too long'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password requires an uppercase letter')
    .matches(/[a-z]/, 'Password requires a lowercase letter')
    .matches(/[0-9]/, 'Password requires a number')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/, 'Password requires a symbol')
    .required('Password is required'),
});

const INITIAL_MODAL: AuthModalConfig = {
  visible: false,
  type: 'error',
  title: '',
  message: '',
};

export default function RegisterScreen() {
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();
  const dark = isDark();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { authMaxWidth, isSmall } = useResponsive();
  const params = useLocalSearchParams<{ email?: string }>();
  const initialEmail = typeof params.email === 'string' ? params.email.trim() : '';

  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formBannerError, setFormBannerError] = useState('');
  const [modalConfig, setModalConfig] = useState<AuthModalConfig>(INITIAL_MODAL);

  const scrollViewRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const usernameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const cityRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const login = useAuthStore((state) => state.login);
  const router = useRouter();
  const { signInWithGoogle } = useGoogleAuth();

  const closeModal = useCallback(() => {
    setModalConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  // Wake up Render backend silently while user fills registration details
  useEffect(() => {
    warmUpBackend();
  }, []);

  // Horizontal shake animation on validation/server error
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

  const formik = useFormik({
    initialValues: { name: '', username: '', email: initialEmail, city: '', password: '' },
    validationSchema,
    onSubmit: async (values) => {
      if (loading || googleLoading) return;
      setLoading(true);
      setFormBannerError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const cleanEmail = values.email.trim().toLowerCase();
      const cleanUsername = values.username.trim().toLowerCase();
      const cleanName = values.name.trim();

      try {
        const res = await api.post('/auth/register', {
          name: cleanName,
          ...(cleanUsername ? { username: cleanUsername } : {}),
          email: cleanEmail,
          city: values.city.trim(),
          password: values.password,
        });
        if (!res.data?.token || !res.data?.user) {
          throw new Error('Server returned an incomplete registration response. Please try again.');
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await login(res.data.token, res.data.user);
      } catch (err: any) {
        triggerShake();
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        const parsed = extractApiError(err, 'Registration failed. Please check your details and try again.');

        if (parsed.accountExists) {
          setFormBannerError('An account with this email already exists. Please log in instead.');
          formik.setFieldError('email', 'Email already registered');
          formik.setFieldTouched('email', true, false);
          setModalConfig({
            visible: true,
            type: 'account_exists',
            title: 'Account Already Exists',
            highlightText: cleanEmail,
            message: 'You already have an EventFlow account with this email address! Sign in instead to continue.',
            primaryAction: {
              label: 'Go to Login',
              onPress: () => {
                closeModal();
                router.push({
                  pathname: '/(auth)/login',
                  params: { email: cleanEmail },
                } as any);
              },
            },
            secondaryAction: {
              label: 'Use Different Email',
              onPress: () => {
                closeModal();
                emailRef.current?.focus();
              },
            },
          });
        } else if (parsed.usernameTaken) {
          setFormBannerError(parsed.message);
          formik.setFieldError('username', 'Username already taken');
          formik.setFieldTouched('username', true, false);
          setModalConfig({
            visible: true,
            type: 'username_taken',
            title: 'Username Not Available',
            highlightText: `@${cleanUsername}`,
            message: 'This username is already taken by another user. Please pick a different username.',
            primaryAction: {
              label: 'Change Username',
              onPress: () => {
                closeModal();
                usernameRef.current?.focus();
              },
            },
            secondaryAction: {
              label: 'Close',
              onPress: closeModal,
            },
          });
        } else {
          if (parsed.field && ['name', 'username', 'email', 'city', 'password'].includes(parsed.field)) {
            formik.setFieldError(parsed.field, parsed.message);
            formik.setFieldTouched(parsed.field, true, false);
          }
          setFormBannerError(parsed.message);
          setModalConfig({
            visible: true,
            type: parsed.isNetworkError || parsed.isTimeout ? 'network' : 'error',
            title: parsed.title || 'Registration Failed',
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

  const handleSubmitForm = async () => {
    Keyboard.dismiss();
    setFormBannerError('');
    const errors = await formik.validateForm();
    const errorOrder: Array<keyof typeof formik.values> = ['name', 'username', 'city', 'email', 'password'];
    const firstKey = errorOrder.find((key) => Boolean(errors[key]));
    if (firstKey) {
      formik.setTouched({
        name: true,
        username: true,
        email: true,
        city: true,
        password: true,
      });
      setFormBannerError(String(errors[firstKey]));
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      triggerShake();
      return;
    }
    formik.handleSubmit();
  };

  // Password criteria
  const password = formik.values.password;
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
  const passedCount = [hasMinLength, hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
  const isPasswordStrong = passedCount === 5;
  const strengthColor = isPasswordStrong ? '#10B981' : passedCount >= 3 ? '#F59E0B' : '#EF4444';

  // Smooth Reanimated strength bar progress
  const strengthProgress = useSharedValue(0);
  useEffect(() => {
    strengthProgress.value = withTiming((passedCount / 5) * 100, { duration: 280 });
  }, [passedCount, strengthProgress]);

  const strengthBarStyle = useAnimatedStyle(() => ({
    width: `${strengthProgress.value}%`,
    backgroundColor: strengthColor,
  }));

  const handleGoogleSignUp = async () => {
    if (loading || googleLoading) return;
    Keyboard.dismiss();
    setGoogleLoading(true);
    setFormBannerError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Safety net: if signInWithGoogle never resolves (deep-link failure, browser stuck),
    // auto-reset the loading state after 65s so the button is usable again.
    const safetyTimer = setTimeout(() => {
      setGoogleLoading(false);
      setFormBannerError('Google Sign-Up timed out. Please tap the button again.');
    }, 65000);

    try {
      const result = await signInWithGoogle();
      clearTimeout(safetyTimer);
      if (!result || result.cancelled) return;

      if (!result.sessionId) {
        throw new Error('Google did not return an active session. Please try again.');
      }

      const res = await api.post('/auth/google', {
        sessionId: result.sessionId,
        email: result.user?.email || '',
        name: result.user?.name || formik.values.name.trim() || 'Google User',
        profilePhoto: result.user?.profilePhoto || '',
      });

      if (res.data?.requires2FA) {
        router.replace({
          pathname: '/(auth)/login',
          params: {
            twoFactorToken: res.data.tempToken,
            twoFactorEmail: res.data.email,
          },
        } as any);
        return;
      }

      if (!res.data?.token || !res.data?.user) {
        throw new Error('Server returned an incomplete Google sign-up response. Please try again.');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await login(res.data.token, res.data.user);
    } catch (err: any) {
      clearTimeout(safetyTimer);
      triggerShake();
      const parsed = extractApiError(err, 'Could not complete Google sign-up. Please try again.');
      setFormBannerError(parsed.message);
      setModalConfig({
        visible: true,
        type: parsed.accountBanned
          ? 'suspended'
          : parsed.isNetworkError || parsed.isTimeout
            ? 'network'
            : 'error',
        title: parsed.accountBanned ? 'Account Suspended' : 'Google Sign-Up Failed',
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
              paddingTop: Math.max(insets.top + 12, 24),
              paddingBottom: Math.max(insets.bottom + 28, 40),
            },
          ]}
        >
          <AuthHeader
            compact
            title="Create Account"
            subtitle="Sign up to organize and supercharge your focus"
            onBack={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(auth)/welcome');
            }}
          />

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

            {/* Full Name */}
            <Animated.View entering={FadeInDown.delay(90).duration(380).springify()}>
              <AuthInput
                compact
                label="FULL NAME"
                colors={colors}
                isDark={dark}
                isFocused={focusedField === 'name'}
                error={formik.errors.name}
                touched={formik.touched.name}
                isValid={formik.values.name.trim().length >= 2 && !formik.errors.name}
                leftIcon={
                  <User
                    color={focusedField === 'name' ? colors.secondary : colors.textSecondary}
                    size={17}
                    strokeWidth={2}
                  />
                }
                placeholder="John Doe"
                value={formik.values.name}
                onChangeText={(text) => {
                  if (formBannerError) setFormBannerError('');
                  formik.handleChange('name')(text);
                }}
                onFocus={() => setFocusedField('name')}
                onBlur={() => {
                  setFocusedField(null);
                  formik.setFieldTouched('name', true);
                }}
                autoCapitalize="words"
                textContentType="name"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => usernameRef.current?.focus()}
              />
            </Animated.View>

            {/* Username + City side-by-side */}
            <Animated.View
              entering={FadeInDown.delay(140).duration(380).springify()}
              style={styles.rowFields}
            >
              <AuthInput
                ref={usernameRef}
                compact
                containerStyle={styles.halfCol}
                label="USERNAME (OPT.)"
                colors={colors}
                isDark={dark}
                isFocused={focusedField === 'username'}
                error={formik.errors.username}
                touched={formik.touched.username}
                isValid={formik.values.username.trim().length >= 3 && !formik.errors.username}
                leftIcon={
                  <AtSign
                    color={focusedField === 'username' ? colors.secondary : colors.textSecondary}
                    size={16}
                    strokeWidth={2}
                  />
                }
                placeholder="johndoe"
                value={formik.values.username}
                onChangeText={(val) => {
                  if (formBannerError) setFormBannerError('');
                  formik.setFieldValue('username', val.toLowerCase().replace(/[^a-z0-9_.-]/g, ''));
                }}
                onFocus={() => setFocusedField('username')}
                onBlur={() => {
                  setFocusedField(null);
                  formik.setFieldTouched('username', true);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => cityRef.current?.focus()}
              />

              <AuthInput
                ref={cityRef}
                compact
                containerStyle={styles.halfCol}
                label="CITY (OPTIONAL)"
                colors={colors}
                isDark={dark}
                isFocused={focusedField === 'city'}
                error={formik.errors.city}
                touched={formik.touched.city}
                isValid={formik.values.city.trim().length >= 2 && !formik.errors.city}
                leftIcon={
                  <MapPin
                    color={focusedField === 'city' ? colors.secondary : colors.textSecondary}
                    size={16}
                    strokeWidth={2}
                  />
                }
                placeholder="New York"
                value={formik.values.city}
                onChangeText={(text) => {
                  if (formBannerError) setFormBannerError('');
                  formik.handleChange('city')(text);
                }}
                onFocus={() => setFocusedField('city')}
                onBlur={() => {
                  setFocusedField(null);
                  formik.setFieldTouched('city', true);
                }}
                autoCapitalize="words"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </Animated.View>

            {/* Email */}
            <Animated.View entering={FadeInDown.delay(190).duration(380).springify()}>
              <AuthInput
                ref={emailRef}
                compact
                label="EMAIL"
                colors={colors}
                isDark={dark}
                isFocused={focusedField === 'email'}
                error={formik.errors.email}
                touched={formik.touched.email}
                isValid={formik.values.email.trim().length > 0 && !formik.errors.email}
                leftIcon={
                  <Mail
                    color={focusedField === 'email' ? colors.secondary : colors.textSecondary}
                    size={17}
                    strokeWidth={2}
                  />
                }
                placeholder="john@example.com"
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
                textContentType="emailAddress"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </Animated.View>

            {/* Password */}
            <Animated.View entering={FadeInDown.delay(240).duration(380).springify()}>
              <AuthInput
                ref={passwordRef}
                compact
                label="PASSWORD"
                colors={colors}
                isDark={dark}
                isFocused={focusedField === 'password'}
                error={formik.errors.password}
                touched={formik.touched.password}
                leftIcon={
                  <Lock
                    color={focusedField === 'password' ? colors.secondary : colors.textSecondary}
                    size={17}
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
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleSubmitForm}
              />

              {/* Live Animated Password Strength Card */}
              {password.length > 0 && (
                <Animated.View
                  entering={FadeInDown.duration(240).springify()}
                  exiting={FadeOutUp.duration(180)}
                  style={[
                    styles.strengthBox,
                    {
                      backgroundColor: colors.card,
                      borderColor: dark ? colors.border : '#EAE2D8',
                    },
                  ]}
                >
                  <View style={styles.strengthHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ShieldCheck color={strengthColor} size={15} />
                      <Text style={[styles.strengthTitle, { color: strengthColor }]}>
                        {isPasswordStrong ? 'STRONG' : passedCount >= 3 ? 'MEDIUM' : 'WEAK'} PASSWORD
                      </Text>
                    </View>
                    <Text style={[styles.strengthCount, { color: colors.textSecondary }]}>
                      {passedCount}/5
                    </Text>
                  </View>

                  <View style={[styles.strengthBarBg, { backgroundColor: colors.border }]}>
                    <Animated.View style={[styles.strengthBarFill, strengthBarStyle]} />
                  </View>

                  <View style={styles.rulesGrid}>
                    {[
                      { met: hasMinLength, label: '8+ chars' },
                      { met: hasUpper && hasLower, label: 'Upper & lower' },
                      { met: hasNumber, label: '1 number' },
                      { met: hasSymbol, label: '1 symbol (!@#)' },
                    ].map(({ met, label }) => (
                      <View key={label} style={styles.ruleItem}>
                        {met ? (
                          <Check color="#10B981" size={13} strokeWidth={3} />
                        ) : (
                          <X color={colors.textSecondary} size={13} strokeWidth={2} />
                        )}
                        <Text
                          style={[
                            styles.ruleText,
                            { color: met ? '#10B981' : colors.textSecondary },
                          ]}
                        >
                          {label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Animated.View>
              )}
            </Animated.View>

            {/* Submit Button */}
            <Animated.View
              entering={FadeInDown.delay(290).duration(380).springify()}
              style={{ marginTop: 6 }}
            >
              <AnimatedPrimaryButton
                title="Create Account"
                onPress={handleSubmitForm}
                loading={loading}
                disabled={googleLoading}
                rightIcon={<ArrowRight color="#FFF" size={18} strokeWidth={2.5} />}
              />
            </Animated.View>

            {/* Divider */}
            <Animated.View entering={FadeInDown.delay(330).duration(360)}>
              <AuthDivider />
            </Animated.View>

            {/* Google Sign Up */}
            <Animated.View entering={FadeInDown.delay(370).duration(380).springify()}>
              <GoogleButton
                onPress={handleGoogleSignUp}
                loading={googleLoading}
                title="CONTINUE WITH GOOGLE"
              />
            </Animated.View>

            {/* Login Link */}
            <Animated.View entering={FadeInDown.delay(410).duration(360)} style={styles.loginRow}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/(auth)/login');
                }}
                hitSlop={10}
                style={({ pressed }) => [styles.loginInner, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.loginText, { color: colors.textSecondary }]}>
                  Already have an account?{' '}
                </Text>
                <Text style={[styles.loginLink, { color: colors.secondary }]}>Log in</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
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
    rowFields: {
      flexDirection: 'row',
      gap: 12,
    },
    halfCol: {
      flex: 1,
    },
    eyeBtn: {
      padding: 4,
    },
    strengthBox: {
      marginTop: -2,
      marginBottom: 14,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      gap: 8,
    },
    strengthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    strengthTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 11,
      letterSpacing: 0.8,
    },
    strengthCount: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 11.5,
    },
    strengthBarBg: {
      height: 5,
      borderRadius: 3,
      overflow: 'hidden',
    },
    strengthBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    rulesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      rowGap: 4,
    },
    ruleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      width: '47%',
    },
    ruleText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 11.5,
    },
    loginRow: {
      marginTop: 20,
      alignItems: 'center',
    },
    loginInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    loginText: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 14,
    },
    loginLink: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 14,
    },
  });
