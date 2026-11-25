import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { useState, useRef, useCallback, ComponentRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
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
import api from '../../services/api';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react-native';
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
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();
  const dark = isDark();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();

  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const router = useRouter();

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
          [{ text: 'GO TO LOGIN', onPress: () => router.replace('/(auth)/login') }]
        );
      } catch (err: any) {
        triggerShake();
        const errorMsg =
          err.response?.data?.error || 'Unable to reset password. Please verify your email.';
        Alert.alert('Reset Failed', errorMsg);
      } finally {
        setLoading(false);
      }
    },
  });

  const handleSubmitForm = async () => {
    const errors = await formik.validateForm();
    if (Object.keys(errors).length > 0) {
      formik.setTouched({ email: true, newPassword: true });
      triggerShake();
      return;
    }
    formik.handleSubmit();
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
              paddingTop: Math.max(insets.top + 14, 28),
              paddingBottom: Math.max(insets.bottom + 24, 34),
            },
          ]}
        >
          <AuthHeader
            title="Forgot Password?"
            subtitle="Enter your account email and choose a strong new password."
            onBack={() => router.back()}
          />

          <Animated.View style={shakeStyle}>
            <Animated.View entering={FadeInDown.delay(110).duration(420).springify()}>
              <AuthInput
                label="REGISTERED EMAIL"
                colors={colors}
                isDark={dark}
                isFocused={focusedField === 'email'}
                error={formik.errors.email}
                touched={formik.touched.email}
                isValid={formik.values.email.trim().length > 0 && !formik.errors.email}
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
                  formik.handleBlur('email')('email');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(170).duration(420).springify()}>
              <AuthInput
                ref={passwordRef}
                label="NEW PASSWORD"
                colors={colors}
                isDark={dark}
                isFocused={focusedField === 'newPassword'}
                error={formik.errors.newPassword}
                touched={formik.touched.newPassword}
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
                placeholder="At least 8 characters"
                value={formik.values.newPassword}
                onChangeText={formik.handleChange('newPassword')}
                onFocus={() => setFocusedField('newPassword')}
                onBlur={() => {
                  setFocusedField(null);
                  formik.handleBlur('newPassword')('newPassword');
                }}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleSubmitForm}
              />
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(230).duration(420).springify()}
              style={{ marginTop: 8 }}
            >
              <AnimatedPrimaryButton
                title="Reset Password"
                onPress={handleSubmitForm}
                loading={loading}
                rightIcon={<ArrowRight color="#FFF" size={18} strokeWidth={2.5} />}
              />
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    eyeBtn: {
      padding: 4,
    },
  });
