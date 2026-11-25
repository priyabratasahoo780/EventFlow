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
import api from '../../services/api';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, ArrowLeft, Mail, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useFormik } from 'formik';
import * as yup from 'yup';

const validationSchema = yup.object().shape({
  email: yup.string().email('Invalid email address').required('Registered email is required'),
  newPassword: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password requires an uppercase letter (A-Z)')
    .matches(/[a-z]/, 'Password requires a lowercase letter (a-z)')
    .matches(/[0-9]/, 'Password requires a number (0-9)')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password requires a special symbol')
    .required('New password is required'),
});

export default function ForgotPasswordScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);

  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const formik = useFormik({
    initialValues: { email: '', newPassword: '' },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        await api.post('/auth/forgot-password', {
          email: values.email.trim().toLowerCase(),
          newPassword: values.newPassword,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Password Reset Successful',
          'Your password has been updated. You can now log in with your new password.',
          [
            {
              text: 'GO TO LOGIN',
              onPress: () => router.replace('/(auth)/login'),
            },
          ]
        );
      } catch (err: any) {
        const errorMsg =
          err.response?.data?.error || 'Unable to reset password. Please verify your email.';

        Alert.alert('Reset Failed', errorMsg);
      } finally {
        setLoading(false);
      }
    },
  });

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
          {/* Back button */}
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <ArrowLeft size={20} color={colors.text} />
            <Text style={styles.backBtnText}>Back to Login</Text>
          </Pressable>

          {/* Brand Row */}
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
              <Text style={styles.tagline}>Reset your password securely</Text>
            </View>
          </View>

          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Enter your account email and choose a new password.
          </Text>

          {/* Inputs */}
          <View style={styles.formContainer}>
            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>REGISTERED EMAIL</Text>
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
                  placeholder="your.email@example.com"
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
                />
              </View>
              {formik.touched.email && formik.errors.email && (
                <Text style={styles.errorText}>{formik.errors.email}</Text>
              )}
            </View>

            {/* New Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>NEW PASSWORD</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'newPassword' && styles.inputWrapperFocused,
                  formik.touched.newPassword &&
                    formik.errors.newPassword && { borderColor: colors.error },
                ]}
              >
                <Lock
                  color={focusedField === 'newPassword' ? colors.secondary : colors.textSecondary}
                  size={18}
                  strokeWidth={2}
                />
                <TextInput
                  style={styles.input}
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.textSecondary}
                  value={formik.values.newPassword}
                  onChangeText={formik.handleChange('newPassword')}
                  onFocus={() => setFocusedField('newPassword')}
                  onBlur={() => {
                    setFocusedField(null);
                    formik.handleBlur('newPassword')('newPassword');
                  }}
                  secureTextEntry={!showPassword}
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
              {formik.touched.newPassword && formik.errors.newPassword && (
                <Text style={styles.errorText}>{formik.errors.newPassword}</Text>
              )}
            </View>
          </View>

          {/* Reset Button */}
          <Pressable
            onPress={() => formik.handleSubmit()}
            disabled={loading}
            style={({ pressed }) => [pressed && { opacity: 0.88 }]}
          >
            <LinearGradient
              colors={loading ? ['#FFB86A', '#FF9840'] : [colors.secondary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.resetBtn}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.resetBtnText}>Reset Password</Text>
              )}
            </LinearGradient>
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
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 20,
    },
    backBtnText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 14,
      color: colors.text,
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
      marginBottom: 28,
    },
    formContainer: {
      marginBottom: 12,
    },
    inputGroup: {
      marginBottom: 18,
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
    resetBtn: {
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.secondary,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 6,
      marginTop: 8,
    },
    resetBtnText: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 16,
      color: colors.card,
      letterSpacing: 0.3,
    },
    errorText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
      marginLeft: 4,
    },
  });
