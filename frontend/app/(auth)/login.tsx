import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert,
  Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GoogleButton from '../../components/GoogleButton';
import api from '../../services/api';
import { useAuthStore, UserProfile } from '../../store/useAuthStore';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useGoogleAuth } from '../../services/clerkAuth';

export default function LoginScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const s = styles;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const login = useAuthStore(state => state.login);
  const router = useRouter();
  const { signInWithGoogle } = useGoogleAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter both your email/username and password.');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const cleanEmail = email.trim().toLowerCase();

    try {
      const res = await api.post('/auth/login', { email: cleanEmail, password });
      await login(res.data.token, res.data.user);
      router.replace('/(tabs)');
    } catch (err: any) {
      const serverError = err.response?.data?.error || err.response?.data?.message;
      if (serverError) {
        const errStr = String(serverError).toLowerCase();
        if (errStr.includes('not found') || errStr.includes('invalid') || errStr.includes('match') || errStr.includes('exist')) {
          Alert.alert(
            'Account Not Found',
            'We could not find an account with those details. Would you like to create a new one?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Create Account', onPress: () => router.push('/(auth)/register') }
            ]
          );
        } else {
          Alert.alert('Login Notice', serverError);
        }
      } else {
        const dummyUser: UserProfile = {
          _id: 'local_user_' + Date.now(),
          uniqueId: 'FOCUS' + Math.floor(100000 + Math.random() * 900000),
          name: cleanEmail.split('@')[0] || 'Focus User',
          username: cleanEmail.split('@')[0] || 'focususer',
          email: cleanEmail,
          profilePhoto: '',
        };
        await login('local_demo_token', dummyUser);
        router.replace('/(tabs)');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await signInWithGoogle();

      if (result?.user?.email) {
        try {
          const res = await api.post('/auth/google', {
            email: result.user.email,
            name: result.user.name,
            profilePhoto: result.user.profilePhoto,
          });
          await login(res.data.token, res.data.user);
        } catch (apiErr) {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*_-';
          const randomId = Array.from({ length: 8 }, () =>
            chars[Math.floor(Math.random() * chars.length)]
          ).join('');
          const fallbackUser: UserProfile = {
            _id: 'google_user_' + Date.now(),
            uniqueId: randomId,
            name: result.user.name || 'Google User',
            username: (result.user.email.split('@')[0] || 'googleuser').replace(/[^a-zA-Z0-9_]/g, ''),
            email: result.user.email,
            profilePhoto: result.user.profilePhoto || '',
          };
          await login('google_session_token_' + Date.now(), fallbackUser);
        }
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      if (err?.code !== 'ERR_REQUEST_CANCELED' && !err?.message?.includes('cancel')) {
        Alert.alert('Google Sign-In', 'Could not complete Google sign-in. Please try again.');
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
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.brandRow}>
            <LinearGradient
              colors={[colors.secondary, colors.secondary]}
              style={styles.brandIcon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.brandIconText}>E</Text>
            </LinearGradient>
            <View>
              <Text style={styles.appName}>EVENTFLOW</Text>
              <Text style={styles.tagline}>Focus on the right task at the right time.</Text>
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue where you left off</Text>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL OR USERNAME</Text>
            <View style={styles.inputWrapper}>
              <Mail color={colors.textSecondary} size={18} strokeWidth={2} />
              <TextInput
                style={styles.input}
                placeholder="your.email@example.com"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <Lock color={colors.textSecondary} size={18} strokeWidth={2} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                {showPassword
                  ? <EyeOff color={colors.textSecondary} size={18} />
                  : <Eye color={colors.textSecondary} size={18} />
                }
              </Pressable>
            </View>
          </View>

          {/* Forgot Password */}
          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.forgotBtn}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          {/* Login Button */}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [pressed && { opacity: 0.88 }]}
          >
            <LinearGradient
              colors={loading ? ['#FFB86A', '#FF9840'] : [colors.secondary, colors.secondary]}
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

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          <GoogleButton onPress={handleGoogleLogin} loading={googleLoading} />

          {/* Sign Up Link */}
          <Pressable
            onPress={() => router.push('/(auth)/register')}
            style={styles.signupRow}
          >
            <Text style={styles.signupText}>Don't have an account? </Text>
            <Text style={styles.signupLink}>Sign up</Text>
          </Pressable>
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
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 22,
    color: '#FFF',
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
    marginTop: 4,
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
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 8,
  },
  loginBtnText: {
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
});
