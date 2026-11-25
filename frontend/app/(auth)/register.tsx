import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, Pressable,
  ScrollView, ActivityIndicator, Image, KeyboardAvoidingView,
  Platform, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GoogleButton from '../../components/GoogleButton';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useRouter } from 'expo-router';
import {
  Eye, EyeOff, Check, X, ShieldCheck,
  User, AtSign, Mail, MapPin, Lock,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { useGoogleAuth } from '../../services/clerkAuth';

const validationSchema = yup.object().shape({
  name: yup.string().trim().min(2, 'Name is too short').required('Full Name is required'),
  username: yup
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .matches(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed')
    .required('Username is required'),
  email: yup.string().email('Invalid email address').trim().required('Email is required'),
  city: yup.string().trim().required('City is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password requires an uppercase letter')
    .matches(/[a-z]/, 'Password requires a lowercase letter')
    .matches(/[0-9]/, 'Password requires a number')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password requires a symbol')
    .required('Password is required'),
});

function useEntryAnimation(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return { opacity, translateY };
}

export default function RegisterScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);

  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const login = useAuthStore((state) => state.login);
  const router = useRouter();
  const { signInWithGoogle } = useGoogleAuth();

  // Staggered animations
  const brand = useEntryAnimation(0);
  const heading = useEntryAnimation(60);
  const f1 = useEntryAnimation(120);
  const f2 = useEntryAnimation(170);
  const f3 = useEntryAnimation(220);
  const f4 = useEntryAnimation(270);
  const f5 = useEntryAnimation(320);
  const btn = useEntryAnimation(400);
  const divAnim = useEntryAnimation(460);
  const googleAnim = useEntryAnimation(520);
  const linkAnim = useEntryAnimation(580);

  // Button press scale
  const btnScale = useRef(new Animated.Value(1)).current;
  const animPressIn = () =>
    Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start();
  const animPressOut = () =>
    Animated.spring(btnScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  const formik = useFormik({
    initialValues: { name: '', username: '', email: '', city: '', password: '' },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const cleanEmail = values.email.trim().toLowerCase();
      const cleanUsername = (values.username || values.name.split(' ')[0]).trim().toLowerCase();
      const cleanName = values.name.trim();

      try {
        const res = await api.post('/auth/register', {
          name: cleanName,
          username: cleanUsername,
          email: cleanEmail,
          city: values.city.trim(),
          password: values.password,
        });
        await login(res.data.token, res.data.user);
        router.replace('/(tabs)');
      } catch (err: any) {
        const serverError = err.response?.data?.error || err.response?.data?.message;
        if (serverError) {
          const errStr = String(serverError).toLowerCase();
          if (errStr.includes('already') || errStr.includes('exist')) {
            Alert.alert('Account Exists', 'You already have an account! Please log in instead.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Go to Login', onPress: () => router.push('/(auth)/login') },
            ]);
          } else {
            Alert.alert('Registration Notice', serverError);
          }
        } else {
          Alert.alert('Connection Error', 'Unable to reach the server. Please check your internet connection.');
        }
      } finally {
        setLoading(false);
      }
    },
  });

  // Password strength
  const password = formik.values.password;
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const passedCount = [hasMinLength, hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
  const isPasswordStrong = passedCount === 5;
  const strengthColor = isPasswordStrong ? '#10B981' : passedCount >= 3 ? '#F59E0B' : '#EF4444';

  // Animated strength bar width
  const strengthBarWidth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(strengthBarWidth, {
      toValue: (passedCount / 5) * 100,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [passedCount, strengthBarWidth]);

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await signInWithGoogle();
      if (!result || !result.user?.email) return;

      const res = await api.post('/auth/google', {
        email: result.user.email,
        name: result.user.name || formik.values.name.trim() || 'Google User',
        profilePhoto: result.user.profilePhoto || '',
      });

      await login(res.data.token, res.data.user);
      router.replace('/(tabs)');
    } catch (err: any) {
      const isCancelled =
        err?.code === 'ERR_REQUEST_CANCELED' ||
        err?.message?.includes('cancel') ||
        err?.message?.includes('dismissed');
      if (!isCancelled) {
        Alert.alert(
          'Google Sign-Up Failed',
          err?.response?.data?.error || 'Could not complete Google sign-up. Please try again.',
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const FieldRow = ({
    anim,
    label,
    icon,
    children,
    error,
    touched,
  }: {
    anim: ReturnType<typeof useEntryAnimation>;
    label: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    error?: string;
    touched?: boolean;
  }) => (
    <Animated.View style={[styles.inputGroup, { opacity: anim.opacity, transform: [{ translateY: anim.translateY }] }]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[
        styles.inputWrapper,
        focusedField === label && styles.inputWrapperFocused,
        touched && error ? { borderColor: colors.error } : null,
      ]}>
        {icon}
        {children}
      </View>
      {touched && error ? <Text style={styles.errorText}>{error}</Text> : null}
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to organize and supercharge your focus</Text>
          </Animated.View>

          {/* Full Name */}
          <FieldRow
            anim={f1}
            label="FULL NAME"
            icon={<User color={focusedField === 'FULL NAME' ? colors.secondary : colors.textSecondary} size={18} strokeWidth={2} />}
            error={formik.errors.name}
            touched={formik.touched.name}
          >
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor={colors.textSecondary}
              value={formik.values.name}
              onChangeText={formik.handleChange('name')}
              onFocus={() => setFocusedField('FULL NAME')}
              onBlur={() => { setFocusedField(null); formik.handleBlur('name')('name'); }}
              autoCapitalize="words"
              textContentType="name"
            />
          </FieldRow>

          {/* Username */}
          <FieldRow
            anim={f2}
            label="USERNAME"
            icon={<AtSign color={focusedField === 'USERNAME' ? colors.secondary : colors.textSecondary} size={18} strokeWidth={2} />}
            error={formik.errors.username}
            touched={formik.touched.username}
          >
            <TextInput
              style={styles.input}
              placeholder="johndoe"
              placeholderTextColor={colors.textSecondary}
              value={formik.values.username}
              onChangeText={(val) => formik.setFieldValue('username', val.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              onFocus={() => setFocusedField('USERNAME')}
              onBlur={() => { setFocusedField(null); formik.handleBlur('username')('username'); }}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
            />
          </FieldRow>

          {/* Email */}
          <FieldRow
            anim={f3}
            label="EMAIL"
            icon={<Mail color={focusedField === 'EMAIL' ? colors.secondary : colors.textSecondary} size={18} strokeWidth={2} />}
            error={formik.errors.email}
            touched={formik.touched.email}
          >
            <TextInput
              style={styles.input}
              placeholder="john@example.com"
              placeholderTextColor={colors.textSecondary}
              value={formik.values.email}
              onChangeText={formik.handleChange('email')}
              onFocus={() => setFocusedField('EMAIL')}
              onBlur={() => { setFocusedField(null); formik.handleBlur('email')('email'); }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </FieldRow>

          {/* City */}
          <FieldRow
            anim={f4}
            label="CITY"
            icon={<MapPin color={focusedField === 'CITY' ? colors.secondary : colors.textSecondary} size={18} strokeWidth={2} />}
            error={formik.errors.city}
            touched={formik.touched.city}
          >
            <TextInput
              style={styles.input}
              placeholder="New York"
              placeholderTextColor={colors.textSecondary}
              value={formik.values.city}
              onChangeText={formik.handleChange('city')}
              onFocus={() => setFocusedField('CITY')}
              onBlur={() => { setFocusedField(null); formik.handleBlur('city')('city'); }}
              autoCapitalize="words"
            />
          </FieldRow>

          {/* Password */}
          <Animated.View style={[styles.inputGroup, { opacity: f5.opacity, transform: [{ translateY: f5.translateY }] }]}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={[
              styles.inputWrapper,
              focusedField === 'PASSWORD' && styles.inputWrapperFocused,
              formik.touched.password && formik.errors.password ? { borderColor: colors.error } : null,
            ]}>
              <Lock color={focusedField === 'PASSWORD' ? colors.secondary : colors.textSecondary} size={18} strokeWidth={2} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                value={formik.values.password}
                onChangeText={formik.handleChange('password')}
                onFocus={() => setFocusedField('PASSWORD')}
                onBlur={() => { setFocusedField(null); formik.handleBlur('password')('password'); }}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
              />
              <Pressable style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                {showPassword ? <EyeOff color={colors.textSecondary} size={18} /> : <Eye color={colors.textSecondary} size={18} />}
              </Pressable>
            </View>
            {formik.touched.password && formik.errors.password && (
              <Text style={styles.errorText}>{formik.errors.password}</Text>
            )}

            {/* Animated Password Strength */}
            {password.length > 0 && (
              <View style={styles.strengthBox}>
                <View style={styles.strengthHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck color={strengthColor} size={15} />
                    <Text style={[styles.strengthTitle, { color: strengthColor }]}>
                      {isPasswordStrong ? 'STRONG' : passedCount >= 3 ? 'MEDIUM' : 'WEAK'} PASSWORD
                    </Text>
                  </View>
                  <Text style={styles.strengthCount}>{passedCount}/5</Text>
                </View>

                {/* Animated bar */}
                <View style={styles.strengthBarBg}>
                  <Animated.View
                    style={[
                      styles.strengthBarFill,
                      {
                        width: strengthBarWidth.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                        backgroundColor: strengthColor,
                      },
                    ]}
                  />
                </View>

                <View style={{ gap: 5 }}>
                  {[
                    { met: hasMinLength, label: 'At least 8 characters' },
                    { met: hasUpper && hasLower, label: 'Uppercase (A-Z) & Lowercase (a-z)' },
                    { met: hasNumber, label: 'At least 1 number (0-9)' },
                    { met: hasSymbol, label: 'At least 1 special symbol (!@#$…)' },
                  ].map(({ met, label }) => (
                    <View key={label} style={styles.ruleItem}>
                      {met
                        ? <Check color="#10B981" size={13} strokeWidth={3} />
                        : <X color={colors.textSecondary} size={13} strokeWidth={2} />
                      }
                      <Text style={[styles.ruleText, { color: met ? '#10B981' : colors.textSecondary }]}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Animated.View>

          {/* Submit Button */}
          <Animated.View style={[{ opacity: btn.opacity, transform: [{ translateY: btn.translateY }, { scale: btnScale }] }]}>
            <Pressable
              onPress={() => formik.handleSubmit()}
              onPressIn={animPressIn}
              onPressOut={animPressOut}
              disabled={loading}
            >
              <LinearGradient
                colors={loading ? ['#FFB86A', '#FF9840'] : ['#FF8C42', '#FF6B1A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.registerBtn}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={styles.registerBtnText}>Create Account</Text>
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

          {/* Google Sign Up */}
          <Animated.View style={{ opacity: googleAnim.opacity, transform: [{ translateY: googleAnim.translateY }] }}>
            <GoogleButton onPress={handleGoogleSignUp} loading={googleLoading} title="CONTINUE WITH GOOGLE" />
          </Animated.View>

          {/* Login Link */}
          <Animated.View style={[styles.loginRow, { opacity: linkAnim.opacity, transform: [{ translateY: linkAnim.translateY }] }]}>
            <Pressable onPress={() => router.push('/(auth)/login')} style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <Text style={styles.loginLink}>Log in</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ColorTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flexGrow: 1,
      padding: 24,
      paddingTop: 16,
      paddingBottom: 40,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 28,
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
      marginBottom: 24,
      lineHeight: 20,
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
    strengthBox: {
      marginTop: 12,
      padding: 14,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    strengthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    strengthTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 11.5,
    },
    strengthCount: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    strengthBarBg: {
      height: 5,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    strengthBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    ruleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    ruleText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 11,
    },
    registerBtn: {
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
      marginTop: 8,
    },
    registerBtnText: {
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
    loginRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 20,
    },
    loginText: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 14,
      color: colors.textSecondary,
    },
    loginLink: {
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
