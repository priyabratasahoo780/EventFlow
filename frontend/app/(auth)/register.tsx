import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GoogleButton from '../../components/GoogleButton';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useRouter } from 'expo-router';
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
          Alert.alert(
            'Connection Error',
            'Unable to reach the server. Please check your internet connection and try again.',
          );
        }
      } finally {
        setLoading(false);
      }
    },
  });

  // Password criteria derived from formik values
  const password = formik.values.password;
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const passedCount = [hasMinLength, hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
  const isPasswordStrong = passedCount === 5;

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await signInWithGoogle();

      if (!result || !result.user?.email) {
        // User cancelled or Clerk returned no email — silently stop
        return;
      }

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
        const serverError = err?.response?.data?.error;
        Alert.alert(
          'Google Sign-Up Failed',
          serverError || 'Could not complete Google sign-up. Please try again.',
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Header */}
          <View style={styles.brandRow}>
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
          </View>

          {/* Heading */}
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to organize and supercharge your focus</Text>

          <View style={styles.formContainer}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>FULL NAME</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'name' && styles.inputWrapperFocused,
                  formik.touched.name && formik.errors.name && { borderColor: colors.error },
                ]}
              >
                <User
                  color={focusedField === 'name' ? colors.secondary : colors.textSecondary}
                  size={18}
                  strokeWidth={2}
                />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={colors.textSecondary}
                  value={formik.values.name}
                  onChangeText={formik.handleChange('name')}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => {
                    setFocusedField(null);
                    formik.handleBlur('name')('name');
                  }}
                  autoCapitalize="words"
                  textContentType="name"
                  autoComplete="name"
                />
              </View>
              {formik.touched.name && formik.errors.name && (
                <Text style={styles.errorText}>{formik.errors.name}</Text>
              )}
            </View>

            {/* Username */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>USERNAME</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'username' && styles.inputWrapperFocused,
                  formik.touched.username && formik.errors.username && { borderColor: colors.error },
                ]}
              >
                <AtSign
                  color={focusedField === 'username' ? colors.secondary : colors.textSecondary}
                  size={18}
                  strokeWidth={2}
                />
                <TextInput
                  style={styles.input}
                  placeholder="johndoe"
                  placeholderTextColor={colors.textSecondary}
                  value={formik.values.username}
                  onChangeText={(val) =>
                    formik.setFieldValue('username', val.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  }
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => {
                    setFocusedField(null);
                    formik.handleBlur('username')('username');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  autoComplete="username"
                />
              </View>
              {formik.touched.username && formik.errors.username && (
                <Text style={styles.errorText}>{formik.errors.username}</Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'email' && styles.inputWrapperFocused,
                  formik.touched.email && formik.errors.email && { borderColor: colors.error },
                ]}
              >
                <Mail
                  color={focusedField === 'email' ? colors.secondary : colors.textSecondary}
                  size={18}
                  strokeWidth={2}
                />
                <TextInput
                  style={styles.input}
                  placeholder="john@example.com"
                  placeholderTextColor={colors.textSecondary}
                  value={formik.values.email}
                  onChangeText={formik.handleChange('email')}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => {
                    setFocusedField(null);
                    formik.handleBlur('email')('email');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                />
              </View>
              {formik.touched.email && formik.errors.email && (
                <Text style={styles.errorText}>{formik.errors.email}</Text>
              )}
            </View>

            {/* City */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>CITY</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'city' && styles.inputWrapperFocused,
                  formik.touched.city && formik.errors.city && { borderColor: colors.error },
                ]}
              >
                <MapPin
                  color={focusedField === 'city' ? colors.secondary : colors.textSecondary}
                  size={18}
                  strokeWidth={2}
                />
                <TextInput
                  style={styles.input}
                  placeholder="New York"
                  placeholderTextColor={colors.textSecondary}
                  value={formik.values.city}
                  onChangeText={formik.handleChange('city')}
                  onFocus={() => setFocusedField('city')}
                  onBlur={() => {
                    setFocusedField(null);
                    formik.handleBlur('city')('city');
                  }}
                  autoCapitalize="words"
                />
              </View>
              {formik.touched.city && formik.errors.city && (
                <Text style={styles.errorText}>{formik.errors.city}</Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'password' && styles.inputWrapperFocused,
                  formik.touched.password && formik.errors.password && { borderColor: colors.error },
                ]}
              >
                <Lock
                  color={focusedField === 'password' ? colors.secondary : colors.textSecondary}
                  size={18}
                  strokeWidth={2}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textSecondary}
                  value={formik.values.password}
                  onChangeText={formik.handleChange('password')}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => {
                    setFocusedField(null);
                    formik.handleBlur('password')('password');
                  }}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                />
                <Pressable
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={10}
                >
                  {showPassword ? (
                    <EyeOff color={colors.textSecondary} size={18} />
                  ) : (
                    <Eye color={colors.textSecondary} size={18} />
                  )}
                </Pressable>
              </View>
              {formik.touched.password && formik.errors.password && (
                <Text style={styles.errorText}>{formik.errors.password}</Text>
              )}

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <View style={styles.strengthBox}>
                  <View style={styles.strengthHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ShieldCheck
                        color={isPasswordStrong ? '#10B981' : passedCount >= 3 ? '#F59E0B' : '#EF4444'}
                        size={16}
                      />
                      <Text
                        style={[
                          styles.strengthTitle,
                          {
                            color: isPasswordStrong
                              ? '#10B981'
                              : passedCount >= 3
                              ? '#F59E0B'
                              : '#EF4444',
                          },
                        ]}
                      >
                        {isPasswordStrong
                          ? 'STRONG PASSWORD'
                          : passedCount >= 3
                          ? 'MEDIUM PASSWORD'
                          : 'WEAK PASSWORD'}
                      </Text>
                    </View>
                    <Text style={styles.strengthCount}>{passedCount}/5 Met</Text>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.strengthBarBg}>
                    <View
                      style={[
                        styles.strengthBarFill,
                        {
                          width: `${(passedCount / 5) * 100}%`,
                          backgroundColor: isPasswordStrong
                            ? '#10B981'
                            : passedCount >= 3
                            ? '#F59E0B'
                            : '#EF4444',
                        },
                      ]}
                    />
                  </View>

                  {/* Rules checklist */}
                  <View style={{ gap: 5 }}>
                    <View style={styles.ruleItem}>
                      {hasMinLength ? (
                        <Check color="#10B981" size={13} strokeWidth={3} />
                      ) : (
                        <X color={colors.textSecondary} size={13} strokeWidth={2} />
                      )}
                      <Text
                        style={[
                          styles.ruleText,
                          { color: hasMinLength ? '#10B981' : colors.textSecondary },
                        ]}
                      >
                        At least 8 characters
                      </Text>
                    </View>
                    <View style={styles.ruleItem}>
                      {hasUpper && hasLower ? (
                        <Check color="#10B981" size={13} strokeWidth={3} />
                      ) : (
                        <X color={colors.textSecondary} size={13} strokeWidth={2} />
                      )}
                      <Text
                        style={[
                          styles.ruleText,
                          { color: hasUpper && hasLower ? '#10B981' : colors.textSecondary },
                        ]}
                      >
                        Uppercase (A-Z) & Lowercase (a-z)
                      </Text>
                    </View>
                    <View style={styles.ruleItem}>
                      {hasNumber ? (
                        <Check color="#10B981" size={13} strokeWidth={3} />
                      ) : (
                        <X color={colors.textSecondary} size={13} strokeWidth={2} />
                      )}
                      <Text
                        style={[
                          styles.ruleText,
                          { color: hasNumber ? '#10B981' : colors.textSecondary },
                        ]}
                      >
                        At least 1 number (0-9)
                      </Text>
                    </View>
                    <View style={styles.ruleItem}>
                      {hasSymbol ? (
                        <Check color="#10B981" size={13} strokeWidth={3} />
                      ) : (
                        <X color={colors.textSecondary} size={13} strokeWidth={2} />
                      )}
                      <Text
                        style={[
                          styles.ruleText,
                          { color: hasSymbol ? '#10B981' : colors.textSecondary },
                        ]}
                      >
                        At least 1 special symbol (!@#$%^&*)
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={() => formik.handleSubmit()}
            disabled={loading}
            style={({ pressed }) => [pressed && { opacity: 0.88 }]}
          >
            <LinearGradient
              colors={loading ? ['#FFB86A', '#FF9840'] : [colors.secondary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.registerBtn}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.registerBtnText}>Create Account</Text>
              )}
            </LinearGradient>
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign Up */}
          <GoogleButton
            onPress={handleGoogleSignUp}
            loading={googleLoading}
            title="CONTINUE WITH GOOGLE"
          />

          {/* Login Link */}
          <Pressable onPress={() => router.push('/(auth)/login')} style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Text style={styles.loginLink}>Log in</Text>
          </Pressable>
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
      paddingBottom: 40,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 24,
    },
    brandIcon: {
      width: 44,
      height: 44,
      borderRadius: 13,
      overflow: 'hidden',
      shadowColor: colors.secondary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    },
    brandIconImage: {
      width: '100%',
      height: '100%',
    },
    appName: {
      fontFamily: 'Poppins_800ExtraBold',
      fontSize: 14,
      color: colors.secondary,
      letterSpacing: 2,
    },
    tagline: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
    },
    title: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 28,
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
    },
    formContainer: {
      marginBottom: 8,
    },
    inputGroup: {
      marginBottom: 16,
    },
    label: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 6,
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
      shadowColor: colors.secondary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    inputWrapperFocused: {
      borderColor: colors.secondary,
      shadowColor: colors.secondary,
      shadowOpacity: 0.25,
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
      marginTop: 10,
      padding: 12,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    strengthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
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
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 10,
    },
    strengthBarFill: {
      height: '100%',
      borderRadius: 2,
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
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 6,
      marginBottom: 8,
      marginTop: 8,
    },
    registerBtnText: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 16,
      color: colors.card,
      letterSpacing: 0.3,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 18,
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
      marginTop: 4,
      marginLeft: 4,
    },
  });
