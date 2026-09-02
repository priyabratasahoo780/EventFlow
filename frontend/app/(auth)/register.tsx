import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GoogleButton from '../../components/GoogleButton';
import api from '../../services/api';
import { useAuthStore, UserProfile } from '../../store/useAuthStore';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Check, X, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useGoogleAuth } from '../../services/clerkAuth';

export default function RegisterScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const login = useAuthStore(state => state.login);
  const router = useRouter();

  const { signInWithGoogle } = useGoogleAuth();

  // Password criteria
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const passedCount = [hasMinLength, hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
  const isPasswordStrong = passedCount === 5;

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Missing Info', 'Please provide full name, email, and password.');
      return;
    }

    if (!isPasswordStrong) {
      Alert.alert(
        'Weak Password',
        'Please ensure your password meets all strong security requirements:\n• At least 8 characters\n• Uppercase (A-Z) & Lowercase (a-z)\n• At least 1 number (0-9)\n• At least 1 symbol (!@#$%^&*)'
      );
      return;
    }
    
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username || name.split(' ')[0]).trim().toLowerCase();
    const cleanName = name.trim();

    try {
      const res = await api.post('/auth/register', {
        name: cleanName,
        username: cleanUsername,
        email: cleanEmail,
        city: city.trim(),
        password
      });
      await login(res.data.token, res.data.user);
      router.replace('/(tabs)');
    } catch (err: any) {
      const serverError = err.response?.data?.error || err.response?.data?.message;
      if (serverError) {
        const errStr = String(serverError).toLowerCase();
        if (errStr.includes('already') || errStr.includes('exist')) {
          Alert.alert(
            'Account Exists',
            'You already have an account! Please log in instead.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Go to Login', onPress: () => router.push('/(auth)/login') }
            ]
          );
        } else {
          Alert.alert('Registration Notice', serverError);
        }
      } else {
        // Unreachable backend / network fallback session
        const localUser: UserProfile = {
          _id: 'local_user_' + Date.now(),
          uniqueId: 'FOCUS' + Math.floor(100000 + Math.random() * 900000),
          name: cleanName,
          username: cleanUsername,
          email: cleanEmail,
          profilePhoto: ''
        };
        await login('local_demo_token', localUser);
        router.replace('/(tabs)');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await signInWithGoogle();
      
      if (result?.user?.email) {
        try {
          const res = await api.post('/auth/google', {
            email: result.user.email,
            name: result.user.name || name.trim() || 'Google User',
            profilePhoto: result.user.profilePhoto || ''
          });

          await login(res.data.token, res.data.user);
        } catch (apiErr) {
          const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
          const lowers = 'abcdefghijkmnopqrstuvwxyz';
          const numbers = '23456789';
          const symbols = '!@#$%&*_-';
          const getRandom = (set: string) => set[Math.floor(Math.random() * set.length)];
          const chars = [
            getRandom(uppers), getRandom(lowers), getRandom(numbers), getRandom(symbols),
            getRandom(uppers), getRandom(lowers), getRandom(numbers), getRandom(symbols)
          ];
          for (let i = chars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
          }
          const randomId = chars.join(''); // Exact 8 characters

          const fallbackUser: UserProfile = {
            _id: 'google_user_' + Date.now(),
            uniqueId: randomId,
            name: result.user.name || name.trim() || 'Google User',
            username: (result.user.email.split('@')[0] || 'googleuser').replace(/[^a-zA-Z0-9_]/g, ''),
            email: result.user.email,
            profilePhoto: result.user.profilePhoto || ''
          };
          await login('google_session_token_' + Date.now(), fallbackUser);
        }

        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.warn('Google sign-up notice:', err);
      if (err?.code !== 'ERR_REQUEST_CANCELED' && !err?.message?.includes('cancel')) {
        Alert.alert('Google Sign-Up', 'Could not complete Google sign-up. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.appName}>FOCUSFLOW</Text>
        <Text style={styles.title}>SIGN UP</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>FULL NAME</Text>
          <TextInput 
            style={styles.input} 
            placeholder="John Doe"
            placeholderTextColor="#888"
            value={name} 
            onChangeText={setName} 
          />

          <Text style={styles.label}>USERNAME</Text>
          <TextInput 
            style={styles.input} 
            placeholder="johndoe"
            placeholderTextColor="#888"
            value={username} 
            onChangeText={setUsername} 
            autoCapitalize="none" 
          />
          
          <Text style={styles.label}>EMAIL</Text>
          <TextInput 
            style={styles.input} 
            placeholder="john@example.com"
            placeholderTextColor="#888"
            value={email} 
            onChangeText={setEmail} 
            autoCapitalize="none" 
            keyboardType="email-address" 
          />
          
          <Text style={styles.label}>CITY</Text>
          <TextInput 
            style={styles.input} 
            placeholder="New York"
            placeholderTextColor="#888"
            value={city} 
            onChangeText={setCity} 
          />
          
          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.passwordWrapper}>
            <TextInput 
              style={styles.passwordInput} 
              placeholder="••••••••"
              placeholderTextColor="#888"
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry={!showPassword} 
            />
            <Pressable style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff color="#000" size={22} /> : <Eye color="#000" size={22} />}
            </Pressable>
          </View>

          {/* Password Strength Indicator */}
          {password.length > 0 && (
            <View style={{ marginTop: 10, padding: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck color={isPasswordStrong ? '#10B981' : passedCount >= 3 ? '#F59E0B' : '#EF4444'} size={16} />
                  <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 12, color: isPasswordStrong ? '#10B981' : passedCount >= 3 ? '#F59E0B' : '#EF4444' }}>
                    {isPasswordStrong ? 'STRONG PASSWORD' : passedCount >= 3 ? 'MEDIUM PASSWORD' : 'WEAK PASSWORD'}
                  </Text>
                </View>
                <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: colors.textSecondary }}>{passedCount}/5 Met</Text>
              </View>

              {/* Progress bar */}
              <View style={{ height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
                <View style={{ height: '100%', width: `${(passedCount / 5) * 100}%`, backgroundColor: isPasswordStrong ? '#10B981' : passedCount >= 3 ? '#F59E0B' : '#EF4444' }} />
              </View>

              {/* Rules checklist */}
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {hasMinLength ? <Check color="#10B981" size={13} strokeWidth={3} /> : <X color="#9CA3AF" size={13} strokeWidth={2} />}
                  <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: hasMinLength ? '#10B981' : colors.textSecondary }}>At least 8 characters</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {hasUpper && hasLower ? <Check color="#10B981" size={13} strokeWidth={3} /> : <X color="#9CA3AF" size={13} strokeWidth={2} />}
                  <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: hasUpper && hasLower ? '#10B981' : colors.textSecondary }}>Uppercase (A-Z) & Lowercase (a-z)</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {hasNumber ? <Check color="#10B981" size={13} strokeWidth={3} /> : <X color="#9CA3AF" size={13} strokeWidth={2} />}
                  <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: hasNumber ? '#10B981' : colors.textSecondary }}>At least 1 number (0-9)</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {hasSymbol ? <Check color="#10B981" size={13} strokeWidth={3} /> : <X color="#9CA3AF" size={13} strokeWidth={2} />}
                  <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: hasSymbol ? '#10B981' : colors.textSecondary }}>At least 1 special symbol (!@#$%^&*)</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <Pressable
          onPress={handleRegister}
          disabled={loading}
          style={({ pressed }) => [pressed && { opacity: 0.88 }]}
        >
          <LinearGradient
            colors={loading ? ['#FFB86A', '#FF9840'] : [colors.secondary, colors.secondary]}
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

        <View style={styles.orDividerRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.orLine} />
        </View>

        <GoogleButton onPress={handleGoogleSignUp} loading={googleLoading} title="SIGN UP WITH GOOGLE" />
        
        <Pressable onPress={() => router.back()} style={styles.link}>
          <Text style={styles.linkText}>Already have an account? Log in</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingBottom: 60 },
  appName: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 14,
    color: colors.secondary,
    letterSpacing: 2,
    marginTop: 10,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 28,
    color: colors.text,
    marginBottom: 4,
  },
  inputContainer: { marginBottom: 16 },
  label: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: colors.text,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: colors.text,
  },
  eyeBtn: { padding: 6 },
  registerBtn: {
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
    marginTop: 8,
  },
  registerBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: colors.card,
    letterSpacing: 0.3,
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
  },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: colors.secondary,
  },
});
