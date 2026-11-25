/**
 * admin/index.tsx
 * Polished, animated, strictly isolated Admin Portal with Overview, Festival Card Studio,
 * Community Sentiment Moderation, User Management, Tasks Monitor, and Profile + 3-Mode Security Lock.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Platform,
  ToastAndroid,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import {
  Shield,
  Fingerprint,
  Users,
  MessageSquare,
  LayoutDashboard,
  Trash2,
  Ban,
  CheckCircle2,
  Lock,
  Search,
  Star,
  AlertTriangle,
  KeyRound,
  RefreshCw,
  LogOut,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  Sparkles,
  ImagePlus,
  Calendar,
  Clock,
  User as UserIcon,
  Smartphone,
  Eye,
  EyeOff,
  ChevronRight,
  Camera,
  X,
} from 'lucide-react-native';
import { useThemeStore } from '../../store/useThemeStore';
import { useAuthStore } from '../../store/useAuthStore';
import { ColorTheme } from '../../constants/theme';
import api from '../../services/api';
import {
  AdminLockConfig,
  DEFAULT_ADMIN_LOCK_CONFIG,
  getBiometricCapabilities,
  authenticateWithBiometrics,
  authenticateWithDevicePatternOrPin,
  getAdminLockConfig,
  saveAdminLockConfig,
  clearAdminVaultSession,
} from '../../services/biometricAuth';
import { useRouter } from 'expo-router';

type AdminTab = 'overview' | 'festival' | 'community' | 'users' | 'profile';
type SentimentFilter = 'all' | 'positive' | 'neutral' | 'negative';
type FestivalPickerTarget = 'start-date' | 'start-time' | 'end-date' | 'end-time' | null;

function resolveMediaUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) return url;
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || '';
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

function formatFestDateLabel(d: Date | null): string {
  if (!d) return 'Select Date';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFestTimeLabel(d: Date | null): string {
  if (!d) return 'Select Time';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatBannerDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })}`;
}

interface ReviewStats {
  total: number;
  avgRating: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  positivePercent: number;
  neutralPercent: number;
  negativePercent: number;
  totalLikes: number;
  breakdown: Record<number, number>;
}

function computeLocalReviewStats(reviewsList: any[]): ReviewStats {
  const total = reviewsList.length;
  const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let ratingSum = 0;
  let positiveCount = 0;
  let neutralCount = 0;
  let negativeCount = 0;
  let totalLikes = 0;

  for (const rev of reviewsList) {
    const r = Math.min(5, Math.max(1, Math.round(Number(rev.rating) || 0)));
    breakdown[r] = (breakdown[r] || 0) + 1;
    ratingSum += r;
    totalLikes += Array.isArray(rev.likes) ? rev.likes.length : 0;

    if (r >= 4) positiveCount++;
    else if (r === 3) neutralCount++;
    else negativeCount++;
  }

  return {
    total,
    avgRating: total > 0 ? Number((ratingSum / total).toFixed(1)) : 0,
    positiveCount,
    neutralCount,
    negativeCount,
    positivePercent: total > 0 ? Math.round((positiveCount / total) * 100) : 0,
    neutralPercent: total > 0 ? Math.round((neutralCount / total) * 100) : 0,
    negativePercent: total > 0 ? Math.round((negativeCount / total) * 100) : 0,
    totalLikes,
    breakdown,
  };
}

/** Breathing live dot for header and security status */
function PulsingDot({ color }: { color: string }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.55, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1.75 - pulse.value * 0.5,
  }));

  return (
    <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
          },
          ringStyle,
        ]}
      />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

/** Smooth spring-animated pressable wrapper */
function SpringPressable({
  children,
  onPress,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 14, stiffness: 280 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 280 });
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Animated horizontal fill bar for star rating distribution */
function AnimatedStarBar({ percent, color, trackColor }: { percent: number; color: string; trackColor: string }) {
  const widthVal = useSharedValue(0);

  useEffect(() => {
    widthVal.value = withTiming(Math.min(100, Math.max(0, percent)), {
      duration: 650,
      easing: Easing.out(Easing.cubic),
    });
  }, [percent, widthVal]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${widthVal.value}%`,
    backgroundColor: color,
  }));

  return (
    <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: trackColor, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: 4 }, fillStyle]} />
    </View>
  );
}

export default function AdminPortalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();
  const dark = isDark();
  const s = getStyles(colors, dark);
  const { user, logout } = useAuthStore();

  // Security / Lock Gate State (Default OFF — normal email & password login enters directly)
  const [unlocked, setUnlocked] = useState(false);
  const [checkingGate, setCheckingGate] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [devicePatternAvailable, setDevicePatternAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Fingerprint');
  const [lockConfig, setLockConfig] = useState<AdminLockConfig>(DEFAULT_ADMIN_LOCK_CONFIG);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Admin Profile & Password Change State
  const [adminNameInput, setAdminNameInput] = useState(user?.name || 'EventFlow Admin');
  const [adminPhotoInput, setAdminPhotoInput] = useState(user?.profilePhoto || '');
  const [savingAdminProfile, setSavingAdminProfile] = useState(false);
  const [uploadingAdminPhoto, setUploadingAdminPhoto] = useState(false);
  const [currentPwdInput, setCurrentPwdInput] = useState('');
  const [newPwdInput, setNewPwdInput] = useState('');
  const [confirmPwdInput, setConfirmPwdInput] = useState('');
  const [showAdminPwds, setShowAdminPwds] = useState(false);
  const [changingAdminPwd, setChangingAdminPwd] = useState(false);

  // Admin Portal Data State
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all');
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [overview, setOverview] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [festivalBanners, setFestivalBanners] = useState<any[]>([]);

  // Festival Card Composer State
  const [festTitle, setFestTitle] = useState('');
  const [festImageUrl, setFestImageUrl] = useState('');
  const [festGreeting, setFestGreeting] = useState('');
  const [festStartAt, setFestStartAt] = useState<Date | null>(null);
  const [festEndAt, setFestEndAt] = useState<Date | null>(null);
  const [festPickerTarget, setFestPickerTarget] = useState<FestivalPickerTarget>(null);
  const [uploadingFestPhoto, setUploadingFestPhoto] = useState(false);
  const [publishingFest, setPublishingFest] = useState(false);

  // Lock screen shake & shield glow animations
  const shakeX = useSharedValue(0);
  const shieldPulse = useSharedValue(1);

  useEffect(() => {
    shieldPulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [shieldPulse]);

  const gateShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const shieldPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shieldPulse.value }],
  }));

  const triggerGateShake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeX.value = withSequence(
      withTiming(-9, { duration: 50 }),
      withTiming(9, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(-3, { duration: 40 }),
      withTiming(0, { duration: 40 })
    );
  }, [shakeX]);

  const showToast = (msg: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert('Admin Portal', msg);
    }
  };

  // Live sentiment stats derived directly from reviews (stays synced after deletions)
  const reviewStats = useMemo<ReviewStats>(() => {
    if (reviews.length > 0 || overview) {
      return computeLocalReviewStats(reviews);
    }
    return (
      overview?.reviewStats || {
        total: 0,
        avgRating: 0,
        positiveCount: 0,
        neutralCount: 0,
        negativeCount: 0,
        positivePercent: 0,
        neutralPercent: 0,
        negativePercent: 0,
        totalLikes: 0,
        breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      }
    );
  }, [reviews, overview]);

  const fetchOverviewAndAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const results = await Promise.allSettled([
        api.get('/admin/overview'),
        api.get('/admin/reviews'),
        api.get('/admin/users'),
        api.get('/admin/festival'),
      ]);

      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      );

      const authErr = rejected.find(
        (r) => r.reason?.response?.status === 403 || r.reason?.response?.status === 401
      );
      if (authErr) {
        setAccessDenied(true);
        setUnlocked(false);
        return;
      }

      const [ovRes, revRes, usrRes, festRes] = results;
      if (ovRes.status === 'fulfilled') setOverview(ovRes.value.data);
      if (revRes.status === 'fulfilled') setReviews(revRes.value.data || []);
      if (usrRes.status === 'fulfilled') setUsersList(usrRes.value.data || []);
      if (festRes.status === 'fulfilled') setFestivalBanners(festRes.value.data || []);

      if (rejected.length === results.length) {
        const firstErr = rejected[0]?.reason;
        const msg =
          firstErr?.response?.data?.error ||
          firstErr?.message ||
          'Could not load Admin Portal data.';
        Alert.alert('Connection Error', msg);
      } else {
        setAccessDenied(false);
        if (festRes.status === 'rejected') {
          showToast('Festival service unavailable on current backend');
        }
      }
    } catch (err: any) {
      Alert.alert(
        'Connection Error',
        err?.response?.data?.error || err?.message || 'Could not load Admin Portal data.'
      );
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  }, []);

  const triggerFingerprintUnlock = useCallback(async () => {
    setUnlocking(true);
    try {
      const result = await authenticateWithBiometrics('Scan your fingerprint to enter Admin Portal', {
        allowDeviceCredentialFallback: false,
      });
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setUnlocked(true);
        await fetchOverviewAndAll();
      } else if (result.error) {
        triggerGateShake();
        if (result.unavailable) {
          Alert.alert('Fingerprint Unavailable', result.error);
        }
      }
    } finally {
      setUnlocking(false);
    }
  }, [fetchOverviewAndAll, triggerGateShake]);

  const triggerDevicePatternUnlock = useCallback(async () => {
    setUnlocking(true);
    try {
      const result = await authenticateWithDevicePatternOrPin('Draw Phone Pattern or Enter Device PIN');
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setUnlocked(true);
        await fetchOverviewAndAll();
      } else if (result.error) {
        triggerGateShake();
        if (result.unavailable) {
          Alert.alert('Phone Lock Unavailable', result.error);
        }
      }
    } finally {
      setUnlocking(false);
    }
  }, [fetchOverviewAndAll, triggerGateShake]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!user || user.role !== 'admin') {
          if (mounted) {
            setAccessDenied(true);
            setCheckingGate(false);
          }
          return;
        }

        setAdminNameInput(user.name || 'EventFlow Admin');
        setAdminPhotoInput(user.profilePhoto || '');

        const [caps, cfg] = await Promise.all([
          getBiometricCapabilities(),
          getAdminLockConfig(),
        ]);

        if (!mounted) return;
        setBiometricAvailable(caps.available);
        setDevicePatternAvailable(caps.available || caps.deviceSecurityAvailable);
        setBiometricLabel(caps.label);
        setLockConfig(cfg);
        setCheckingGate(false);

        if (!cfg.enabled) {
          setUnlocked(true);
          await fetchOverviewAndAll();
        } else if (cfg.allowFingerprint && caps.available) {
          await triggerFingerprintUnlock();
        }
      } catch {
        if (mounted) {
          setCheckingGate(false);
          setUnlocked(true);
          fetchOverviewAndAll().catch(() => {});
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const handlePasswordUnlock = async () => {
    if (!adminPasswordInput) {
      triggerGateShake();
      Alert.alert('Password Required', 'Enter your Admin password to unlock.');
      return;
    }
    setUnlocking(true);
    try {
      await api.post('/admin/verify-password', { password: adminPasswordInput });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAdminPasswordInput('');
      setUnlocked(true);
      await fetchOverviewAndAll();
    } catch (err: any) {
      triggerGateShake();
      Alert.alert('Verification Failed', err?.response?.data?.error || 'Incorrect Admin password.');
    } finally {
      setUnlocking(false);
    }
  };

  const updateLockConfig = async (patch: Partial<AdminLockConfig>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next: AdminLockConfig = { ...lockConfig, ...patch };

    if (next.enabled && !next.allowFingerprint && !next.allowDevicePattern && !next.allowPassword) {
      Alert.alert(
        'Keep At Least One Option',
        'While Admin Portal Lock is ON, keep at least one unlock method enabled (or turn Portal Lock OFF).'
      );
      return;
    }

    if (patch.enabled === true && !next.allowFingerprint && !next.allowDevicePattern && !next.allowPassword) {
      next.allowPassword = true;
    }

    setLockConfig(next);
    await saveAdminLockConfig(next);

    if (Object.prototype.hasOwnProperty.call(patch, 'enabled')) {
      showToast(next.enabled ? 'Admin Portal Lock Enabled' : 'Admin Portal Lock Disabled');
    } else {
      showToast('Security option updated');
    }
  };

  const handlePickAdminPhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow photo gallery access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingAdminPhoto(true);
    try {
      const formData = new FormData();
      const filename = asset.uri.split('/').pop() || 'admin_avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      formData.append('image', { uri: asset.uri, name: filename, type: mime } as any);
      const uploadRes = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (uploadRes.data?.url) {
        const res = await api.patch('/admin/profile', { profilePhoto: uploadRes.data.url });
        setAdminPhotoInput(uploadRes.data.url);
        if (res.data?.user) {
          await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
          useAuthStore.setState({ user: res.data.user });
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Admin photo updated');
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.response?.data?.error || 'Could not update photo.');
    } finally {
      setUploadingAdminPhoto(false);
    }
  };

  const handleSaveAdminProfile = async () => {
    if (!adminNameInput.trim()) {
      Alert.alert('Name Required', 'Please enter an Admin display name.');
      return;
    }
    setSavingAdminProfile(true);
    try {
      const res = await api.patch('/admin/profile', { name: adminNameInput.trim() });
      if (res.data?.user) {
        await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
        useAuthStore.setState({ user: res.data.user });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Admin profile saved');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSavingAdminProfile(false);
    }
  };

  const handleChangeAdminPassword = async () => {
    if (!currentPwdInput || !newPwdInput || !confirmPwdInput) {
      Alert.alert('All Fields Required', 'Enter current password, new password, and confirm password.');
      return;
    }
    if (newPwdInput !== confirmPwdInput) {
      Alert.alert('Password Mismatch', 'New password and confirm password do not match.');
      return;
    }

    setChangingAdminPwd(true);
    try {
      await api.post('/admin/change-password', {
        currentPassword: currentPwdInput,
        newPassword: newPwdInput,
      });
      setCurrentPwdInput('');
      setNewPwdInput('');
      setConfirmPwdInput('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Password Updated', 'Your Admin password has been changed securely.');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Password Update Failed', err?.response?.data?.error || 'Could not update password.');
    } finally {
      setChangingAdminPwd(false);
    }
  };

  const handleDeleteReview = (reviewId: string, authorName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete Community Comment',
      `Remove comment by ${authorName || 'this user'} permanently?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/reviews/${reviewId}`);
              setReviews((prev) => prev.filter((r) => r._id !== reviewId));
              showToast('Comment deleted');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to delete comment.');
            }
          },
        },
      ]
    );
  };

  const handleToggleBanUser = (targetUser: any) => {
    const nextBanned = !targetUser.isBanned;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      nextBanned ? 'Suspend User' : 'Restore User',
      nextBanned
        ? `Suspend "${targetUser.name}" (${targetUser.email})? They will immediately lose access to EventFlow.`
        : `Restore access for "${targetUser.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextBanned ? 'Suspend' : 'Restore',
          style: nextBanned ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const res = await api.patch(`/admin/users/${targetUser._id}/ban`, { banned: nextBanned });
              setUsersList((prev) =>
                prev.map((u) => (u._id === targetUser._id ? { ...u, isBanned: res.data.isBanned } : u))
              );
              showToast(res.data.message);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to update user status.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = (targetUser: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete User Permanently',
      `Delete "${targetUser.name}" (${targetUser.email}) and ALL their tasks, comments, and messages? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/users/${targetUser._id}`);
              setUsersList((prev) => prev.filter((u) => u._id !== targetUser._id));
              showToast('User deleted permanently');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to delete user.');
            }
          },
        },
      ]
    );
  };

  const handleAdminLogout = async (clearVault = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (clearVault) {
      await clearAdminVaultSession();
    }
    await logout();
    router.replace('/(auth)/login');
  };

  const handlePickFestivalPhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow photo gallery access to upload a festival banner photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingFestPhoto(true);
    try {
      const formData = new FormData();
      const filename = asset.uri.split('/').pop() || 'festival.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      formData.append('image', { uri: asset.uri, name: filename, type: mime } as any);

      const uploadRes = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (uploadRes.data?.url) {
        setFestImageUrl(uploadRes.data.url);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Festival photo uploaded!');
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.response?.data?.error || 'Could not upload festival photo.');
    } finally {
      setUploadingFestPhoto(false);
    }
  };

  const handleFestivalPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    const currentTarget = festPickerTarget;
    if (Platform.OS !== 'ios') {
      setFestPickerTarget(null);
    }
    if (event.type === 'dismissed' || !selected || !currentTarget) return;

    const isStart = currentTarget.startsWith('start');
    const isDate = currentTarget.endsWith('date');
    const existing = isStart ? festStartAt : festEndAt;
    const base = existing ? new Date(existing) : new Date();

    if (!existing && isDate) {
      if (isStart) {
        base.setHours(0, 0, 0, 0);
      } else {
        base.setHours(23, 59, 0, 0);
      }
    }

    if (isDate) {
      base.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    } else {
      base.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    }

    if (isStart) {
      setFestStartAt(base);
    } else {
      setFestEndAt(base);
    }
  };

  const handlePublishFestivalCard = async () => {
    if (!festTitle.trim()) {
      Alert.alert('Title Required', 'Please enter a festival card title (e.g. Happy Diwali!).');
      return;
    }
    if (!festImageUrl.trim()) {
      Alert.alert('Photo Required', 'Please upload a festival photo for the card.');
      return;
    }
    if (!festGreeting.trim()) {
      Alert.alert('Greeting Required', 'Please enter a festival greeting message.');
      return;
    }
    if (festStartAt && festEndAt && festEndAt <= festStartAt) {
      Alert.alert('Invalid Schedule', 'End Date & Time must be after Start Date & Time.');
      return;
    }

    setPublishingFest(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await api.post('/admin/festival', {
        title: festTitle.trim(),
        imageUrl: festImageUrl.trim(),
        greeting: festGreeting.trim(),
        startDate: festStartAt ? festStartAt.toISOString() : undefined,
        endDate: festEndAt ? festEndAt.toISOString() : undefined,
        isActive: true,
      });

      setFestivalBanners((prev) => [
        res.data,
        ...prev.map((b) => ({ ...b, isActive: false })),
      ]);
      setFestTitle('');
      setFestImageUrl('');
      setFestGreeting('');
      setFestStartAt(null);
      setFestEndAt(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Festival card live for users in scheduled window!');
    } catch (err: any) {
      Alert.alert('Publish Failed', err?.response?.data?.error || 'Could not publish festival card.');
    } finally {
      setPublishingFest(false);
    }
  };

  const handleToggleFestivalBanner = async (banner: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const nextActive = !banner.isActive;
      const res = await api.patch(`/admin/festival/${banner._id}/toggle`, { isActive: nextActive });
      setFestivalBanners((prev) =>
        prev.map((b) => {
          if (b._id === banner._id) return res.data;
          return nextActive ? { ...b, isActive: false } : b;
        })
      );
      showToast(nextActive ? 'Festival card activated' : 'Festival card paused');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Could not update festival card.');
    }
  };

  const handleDeleteFestivalBanner = (banner: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Festival Card', `Remove "${banner.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/admin/festival/${banner._id}`);
            setFestivalBanners((prev) => prev.filter((b) => b._id !== banner._id));
            showToast('Festival card deleted');
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Could not delete festival card.');
          }
        },
      },
    ]);
  };

  const qLower = searchQuery.trim().toLowerCase();
  const filteredReviews = reviews.filter((r) => {
    const ratingVal = Number(r.rating) || 0;
    if (sentimentFilter === 'positive' && ratingVal < 4) return false;
    if (sentimentFilter === 'neutral' && ratingVal !== 3) return false;
    if (sentimentFilter === 'negative' && ratingVal > 2) return false;
    if (!qLower) return true;
    return `${r.text || ''} ${r.user?.name || ''} ${r.user?.email || ''}`.toLowerCase().includes(qLower);
  });

  const filteredUsers = qLower
    ? usersList.filter((u) =>
        `${u.name || ''} ${u.username || ''} ${u.email || ''} ${u.uniqueId || ''}`.toLowerCase().includes(qLower)
      )
    : usersList;

  // ── 1. ACCESS DENIED SCREEN ───────────────────────────────────
  if (accessDenied) {
    return (
      <SafeAreaView style={s.gateRoot}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <Animated.View entering={ZoomIn.duration(350)} style={s.gateCard}>
          <View style={[s.gateBadge, { backgroundColor: colors.dangerLight }]}>
            <AlertTriangle color={colors.error} size={34} />
          </View>
          <Text style={s.gateTitle}>Admin Access Restricted</Text>
          <Text style={s.gateSub}>
            Only verified EventFlow administrators can access this management portal.
          </Text>
          <SpringPressable style={{ width: '100%' }} onPress={() => router.replace('/(tabs)')}>
            <LinearGradient
              colors={['#FF7A00', '#EA580C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.gatePrimaryBtn}
            >
              <Text style={s.gatePrimaryText}>Return to App</Text>
            </LinearGradient>
          </SpringPressable>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── 2. ANIMATED MULTI-OPTION LOCK GATE ────────────────────────
  if (!unlocked) {
    return (
      <SafeAreaView style={s.gateRoot}>
        <StatusBar style={dark ? 'light' : 'dark'} />

        {/* Ambient decorative glow */}
        <View pointerEvents="none" style={[s.glowOrbTop, { backgroundColor: colors.secondary + '18' }]} />
        <View pointerEvents="none" style={[s.glowOrbBottom, { backgroundColor: colors.primary + '14' }]} />

        <Pressable style={s.gateLogoutBtn} onPress={() => handleAdminLogout(false)}>
          <LogOut color={colors.error} size={16} />
          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: colors.error }}>
            Logout
          </Text>
        </Pressable>

        <Animated.View entering={ZoomIn.duration(400).springify()} style={[s.gateCard, gateShakeStyle]}>
          <Animated.View style={[s.gateBadge, { backgroundColor: colors.secondaryLight }, shieldPulseStyle]}>
            {checkingGate || unlocking ? (
              <ActivityIndicator color={colors.secondary} size="large" />
            ) : (
              <Shield color={colors.secondary} size={38} strokeWidth={2} />
            )}
          </Animated.View>

          <Text style={s.gateTitle}>Admin Portal Locked</Text>
          <Text style={s.gateSub}>
            {user?.email ? `${user.email}\n` : ''}
            Choose one of your active security options to continue.
          </Text>

          <View style={{ width: '100%', gap: 10 }}>
            {lockConfig.allowFingerprint && (
              <SpringPressable onPress={triggerFingerprintUnlock} disabled={unlocking}>
                <LinearGradient
                  colors={['#FF7A00', '#EA580C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.gatePrimaryBtn}
                >
                  <Fingerprint color="#FFF" size={20} />
                  <Text style={s.gatePrimaryText}>
                    {biometricAvailable ? `Unlock with ${biometricLabel}` : 'Fingerprint (Enroll on Phone)'}
                  </Text>
                </LinearGradient>
              </SpringPressable>
            )}

            {lockConfig.allowDevicePattern && (
              <SpringPressable onPress={triggerDevicePatternUnlock} disabled={unlocking}>
                <LinearGradient
                  colors={[colors.primary, '#4F46E5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.gateSecondaryBtn}
                >
                  <Smartphone color="#FFF" size={18} />
                  <Text style={s.gatePrimaryText}>
                    {devicePatternAvailable ? 'Unlock with Phone Pattern / PIN' : 'Phone Pattern / PIN'}
                  </Text>
                </LinearGradient>
              </SpringPressable>
            )}

            {lockConfig.allowPassword && (
              <View style={{ width: '100%', marginTop: 4, gap: 8 }}>
                <TextInput
                  value={adminPasswordInput}
                  onChangeText={setAdminPasswordInput}
                  placeholder="Enter Admin Normal Password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  style={s.gateInput}
                  onSubmitEditing={handlePasswordUnlock}
                />
                <SpringPressable onPress={handlePasswordUnlock} disabled={unlocking}>
                  <View
                    style={[
                      s.gateSecondaryBtn,
                      { backgroundColor: dark ? '#334155' : '#1E293B' },
                    ]}
                  >
                    <KeyRound color="#FFF" size={18} />
                    <Text style={s.gatePrimaryText}>Unlock with Admin Password</Text>
                  </View>
                </SpringPressable>
              </View>
            )}
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── 3. UNLOCKED ANIMATED ADMIN PORTAL ─────────────────────────
  const stats = overview?.stats || {};
  const completedPct =
    stats.totalTasks > 0 ? Math.round(((stats.completedTasks || 0) / stats.totalTasks) * 100) : 0;

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >

      {/* Subtle Ambient Background Orbs */}
      <View pointerEvents="none" style={[s.glowOrbTop, { backgroundColor: colors.secondary + '12' }]} />
      <View pointerEvents="none" style={[s.glowOrbBottom, { backgroundColor: colors.primary + '10' }]} />

      {/* Top Header */}
      <Animated.View entering={FadeInDown.duration(350)} style={s.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('profile');
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }}
        >
          {user?.profilePhoto ? (
            <Image source={{ uri: resolveMediaUrl(user.profilePhoto) }} style={s.headerAvatar} />
          ) : (
            <LinearGradient colors={['#FF7A00', '#EA580C']} style={s.headerAvatarFallback}>
              <Shield color="#FFF" size={19} strokeWidth={2.4} />
            </LinearGradient>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.headerTitle}>Admin Portal</Text>
              <View style={s.liveBadge}>
                <PulsingDot color="#10B981" />
                <Text style={s.liveBadgeText}>LIVE</Text>
              </View>
            </View>
            <Text style={s.headerSub} numberOfLines={1}>
              {user?.name || 'EventFlow Admin'} • {overview?.admin?.email || user?.email}
            </Text>
          </View>
        </Pressable>

        <SpringPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setRefreshing(true);
            fetchOverviewAndAll();
          }}
        >
          <View style={s.iconBtn}>
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.secondary} />
            ) : (
              <RefreshCw color={colors.text} size={17} />
            )}
          </View>
        </SpringPressable>

        <SpringPressable
          style={{ marginLeft: 7 }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (!lockConfig.enabled) {
              Alert.alert(
                'Portal Lock is OFF',
                'Turn on Admin Portal Lock inside the Profile tab to enable Fingerprint, Phone Pattern, or Password locking.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Profile', onPress: () => setActiveTab('profile') },
                ]
              );
              return;
            }
            setUnlocked(false);
          }}
        >
          <View
            style={[
              s.iconBtn,
              {
                backgroundColor: lockConfig.enabled ? colors.secondaryLight : colors.card,
                borderColor: lockConfig.enabled ? colors.secondary + '40' : colors.border,
              },
            ]}
          >
            <Lock color={lockConfig.enabled ? colors.secondary : colors.textSecondary} size={17} />
          </View>
        </SpringPressable>

        <SpringPressable style={{ marginLeft: 7 }} onPress={() => handleAdminLogout(false)}>
          <View style={[s.iconBtn, { backgroundColor: colors.dangerLight, borderColor: colors.error + '30' }]}>
            <LogOut color={colors.error} size={17} />
          </View>
        </SpringPressable>
      </Animated.View>

      {/* Navigation Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={s.tabBar}
      >
        {(
          [
            { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
            { key: 'festival', label: 'Festival Card', Icon: Sparkles },
            { key: 'community', label: `Reviews (${reviews.length})`, Icon: MessageSquare },
            { key: 'users', label: `Users (${usersList.length})`, Icon: Users },
            { key: 'profile', label: 'Profile', Icon: UserIcon },
          ] as const
        ).map(({ key, label, Icon }) => {
          const active = activeTab === key;
          return (
            <SpringPressable
              key={key}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(key);
              }}
            >
              {active ? (
                <LinearGradient
                  colors={['#FF7A00', '#EA580C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.tabPill, { borderColor: 'transparent' }]}
                >
                  <Icon color="#FFF" size={14} strokeWidth={2.4} />
                  <Text style={[s.tabPillText, { color: '#FFF' }]} numberOfLines={1}>
                    {label}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={s.tabPill}>
                  <Icon color={colors.textSecondary} size={14} />
                  <Text style={s.tabPillText} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              )}
            </SpringPressable>
          );
        })}
      </ScrollView>

      {/* Search & Sentiment Filter Bar */}
      {activeTab !== 'overview' && activeTab !== 'festival' && activeTab !== 'profile' && (
        <Animated.View entering={FadeIn.duration(220)}>
          <View style={s.searchWrap}>
            <Search color={colors.textSecondary} size={17} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={
                activeTab === 'community'
                  ? 'Search comments or author...'
                  : 'Search name, email, or Unique ID...'
              }
              placeholderTextColor={colors.textSecondary}
              style={s.searchInput}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <X color={colors.textSecondary} size={16} />
              </Pressable>
            )}
          </View>

          {activeTab === 'community' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filterRow}
            >
              {(
                [
                  { key: 'all', label: `All (${reviewStats.total})`, color: colors.secondary },
                  { key: 'positive', label: `Positive (${reviewStats.positiveCount})`, color: colors.success },
                  { key: 'neutral', label: `Neutral (${reviewStats.neutralCount})`, color: '#F59E0B' },
                  { key: 'negative', label: `Negative (${reviewStats.negativeCount})`, color: colors.error },
                ] as const
              ).map(({ key, label, color }) => {
                const selected = sentimentFilter === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSentimentFilter(key);
                    }}
                    style={[
                      s.filterChip,
                      selected && { backgroundColor: color, borderColor: color },
                    ]}
                  >
                    <Text style={[s.filterChipText, selected && { color: '#FFF' }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Animated.View>
      )}

      {/* Main Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 56 },
        ]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchOverviewAndAll();
            }}
            tintColor={colors.secondary}
          />
        }
      >
        {loadingData && !overview ? (
          <View style={{ paddingVertical: 80, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color={colors.secondary} />
            <Text style={s.cardSub}>Loading EventFlow Command Center...</Text>
          </View>
        ) : (
          <>
            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && (
              <Animated.View key="tab-overview" entering={FadeInDown.duration(340)} style={{ gap: 14 }}>
                {/* Hero Command Summary Banner */}
                <LinearGradient
                  colors={dark ? ['#1E293B', '#0F172A'] : ['#FF7A00', '#EA580C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.heroBanner}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.heroEyebrow}>PLATFORM PULSE</Text>
                    <Text style={s.heroBigText}>
                      {stats.totalUsers ?? 0} Active Users
                    </Text>
                    <Text style={s.heroSubText}>
                      {completedPct}% task completion • {reviewStats.avgRating.toFixed(1)} ★ community rating
                    </Text>
                  </View>
                  <View style={s.heroIconGlass}>
                    <Sparkles color="#FFF" size={26} />
                  </View>
                </LinearGradient>

                {/* Interactive KPI Grid */}
                <View style={s.statsGrid}>
                  <Animated.View entering={FadeInDown.delay(60).duration(350).springify()} style={s.statGridCell}>
                    <SpringPressable onPress={() => setActiveTab('users')}>
                      <View style={s.statCard}>
                        <View style={[s.statIconDot, { backgroundColor: colors.primaryLight }]}>
                          <Users color={colors.primary} size={17} />
                        </View>
                        <Text style={s.statNum}>{stats.totalUsers ?? 0}</Text>
                        <Text style={s.statLabel}>Registered Users</Text>
                      </View>
                    </SpringPressable>
                  </Animated.View>

                  <Animated.View entering={FadeInDown.delay(110).duration(350).springify()} style={s.statGridCell}>
                    <SpringPressable onPress={() => setActiveTab('community')}>
                      <View style={s.statCard}>
                        <View style={[s.statIconDot, { backgroundColor: colors.secondaryLight }]}>
                          <MessageSquare color={colors.secondary} size={17} />
                        </View>
                        <Text style={[s.statNum, { color: colors.secondary }]}>{reviewStats.total}</Text>
                        <Text style={s.statLabel}>Total Comments</Text>
                      </View>
                    </SpringPressable>
                  </Animated.View>

                  <Animated.View entering={FadeInDown.delay(160).duration(350).springify()} style={s.statGridCell}>
                    <SpringPressable onPress={() => setActiveTab('users')}>
                      <View style={s.statCard}>
                        <View style={[s.statIconDot, { backgroundColor: colors.success + '20' }]}>
                          <CheckCircle2 color={colors.success} size={17} />
                        </View>
                        <Text style={[s.statNum, { color: colors.primary }]}>{stats.twoFactorUsers ?? 0}</Text>
                        <Text style={s.statLabel}>2FA Protected</Text>
                      </View>
                    </SpringPressable>
                  </Animated.View>

                  <Animated.View entering={FadeInDown.delay(210).duration(350).springify()} style={s.statGridCell}>
                    <SpringPressable onPress={() => setActiveTab('users')}>
                      <View style={s.statCard}>
                        <View style={[s.statIconDot, { backgroundColor: colors.dangerLight }]}>
                          <Ban color={colors.error} size={17} />
                        </View>
                        <Text style={[s.statNum, { color: colors.error }]}>{stats.bannedUsers ?? 0}</Text>
                        <Text style={s.statLabel}>Banned Users</Text>
                      </View>
                    </SpringPressable>
                  </Animated.View>
                </View>

                {/* Review & Sentiment Analytics Card */}
                <Animated.View entering={FadeInDown.delay(240).duration(380)} style={s.sectionCard}>
                  <View style={[s.rowBetween, { marginBottom: 14 }]}>
                    <View>
                      <Text style={s.cardTitle}>Community Review Sentiment</Text>
                      <Text style={s.cardSub}>
                        {reviewStats.total} reviews • {reviewStats.totalLikes} helpful likes
                      </Text>
                    </View>
                    <View style={s.avgBadge}>
                      <Star color="#F59E0B" fill="#F59E0B" size={16} />
                      <Text style={s.avgBadgeText}>{reviewStats.avgRating.toFixed(1)}</Text>
                    </View>
                  </View>

                  {/* 3 Interactive Sentiment Boxes */}
                  <View style={s.sentimentRow}>
                    <SpringPressable
                      style={{ flex: 1 }}
                      onPress={() => {
                        setSentimentFilter('positive');
                        setActiveTab('community');
                      }}
                    >
                      <View style={[s.sentimentBox, { backgroundColor: colors.success + '14', borderColor: colors.success + '40' }]}>
                        <ThumbsUp color={colors.success} size={16} />
                        <Text style={[s.sentimentPercent, { color: colors.success }]}>
                          {reviewStats.positivePercent}%
                        </Text>
                        <Text style={s.sentimentLabel}>Positive (4-5★)</Text>
                        <Text style={s.sentimentCount}>{reviewStats.positiveCount} reviews</Text>
                      </View>
                    </SpringPressable>

                    <SpringPressable
                      style={{ flex: 1 }}
                      onPress={() => {
                        setSentimentFilter('neutral');
                        setActiveTab('community');
                      }}
                    >
                      <View style={[s.sentimentBox, { backgroundColor: '#F59E0B14', borderColor: '#F59E0B40' }]}>
                        <MinusCircle color="#F59E0B" size={16} />
                        <Text style={[s.sentimentPercent, { color: '#F59E0B' }]}>
                          {reviewStats.neutralPercent}%
                        </Text>
                        <Text style={s.sentimentLabel}>Neutral (3★)</Text>
                        <Text style={s.sentimentCount}>{reviewStats.neutralCount} reviews</Text>
                      </View>
                    </SpringPressable>

                    <SpringPressable
                      style={{ flex: 1 }}
                      onPress={() => {
                        setSentimentFilter('negative');
                        setActiveTab('community');
                      }}
                    >
                      <View style={[s.sentimentBox, { backgroundColor: colors.dangerLight, borderColor: colors.error + '40' }]}>
                        <ThumbsDown color={colors.error} size={16} />
                        <Text style={[s.sentimentPercent, { color: colors.error }]}>
                          {reviewStats.negativePercent}%
                        </Text>
                        <Text style={s.sentimentLabel}>Negative (1-2★)</Text>
                        <Text style={s.sentimentCount}>{reviewStats.negativeCount} reviews</Text>
                      </View>
                    </SpringPressable>
                  </View>

                  {/* Stacked Sentiment Ratio Bar */}
                  {reviewStats.total > 0 && (
                    <View style={s.stackedBar}>
                      {reviewStats.positiveCount > 0 && (
                        <View style={{ flex: reviewStats.positiveCount, backgroundColor: colors.success }} />
                      )}
                      {reviewStats.neutralCount > 0 && (
                        <View style={{ flex: reviewStats.neutralCount, backgroundColor: '#F59E0B' }} />
                      )}
                      {reviewStats.negativeCount > 0 && (
                        <View style={{ flex: reviewStats.negativeCount, backgroundColor: colors.error }} />
                      )}
                    </View>
                  )}

                  {/* Animated 5-Star Breakdown Bars */}
                  <View style={{ gap: 8, marginTop: 14 }}>
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = reviewStats.breakdown[star] || 0;
                      const pct = reviewStats.total > 0 ? Math.round((count / reviewStats.total) * 100) : 0;
                      const barColor = star >= 4 ? colors.success : star === 3 ? '#F59E0B' : colors.error;
                      return (
                        <View key={star} style={s.starDistRow}>
                          <Text style={s.starDistLabel}>{star} ★</Text>
                          <AnimatedStarBar
                            percent={pct}
                            color={barColor}
                            trackColor={dark ? colors.background : '#E2E8F0'}
                          />
                          <Text style={s.starDistCount}>
                            {count} ({pct}%)
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Animated.View>

                {/* Portal Lock Summary Card */}
                <Animated.View entering={FadeInDown.delay(290).duration(380)}>
                  <SpringPressable onPress={() => setActiveTab('profile')}>
                    <View style={s.sectionCard}>
                      <View style={s.rowBetween}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                          <View style={[s.smallBadge, { backgroundColor: colors.secondaryLight }]}>
                            <Lock color={colors.secondary} size={20} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.cardTitle}>
                              Admin Portal Lock: {lockConfig.enabled ? 'ON' : 'OFF'}
                            </Text>
                            <Text style={s.cardSub}>
                              Fingerprint, Phone Pattern & Password settings in Profile
                            </Text>
                          </View>
                        </View>
                        <View
                          style={[
                            s.pillTag,
                            { backgroundColor: lockConfig.enabled ? colors.success + '22' : colors.border },
                          ]}
                        >
                          <Text
                            style={[
                              s.pillTagText,
                              { color: lockConfig.enabled ? colors.success : colors.textSecondary },
                            ]}
                          >
                            {lockConfig.enabled ? 'ON' : 'OFF'}
                          </Text>
                        </View>
                        <ChevronRight color={colors.textSecondary} size={17} />
                      </View>
                    </View>
                  </SpringPressable>
                </Animated.View>

                {/* Quick Moderation Actions */}
                <Animated.View entering={FadeInDown.delay(340).duration(380)} style={s.sectionCard}>
                  <Text style={[s.cardTitle, { marginBottom: 10 }]}>Quick Actions</Text>
                  <View style={{ gap: 9 }}>
                    <SpringPressable onPress={() => setActiveTab('festival')}>
                      <View style={s.quickActionRow}>
                        <Sparkles color={colors.secondary} size={18} />
                        <Text style={s.quickActionText}>Create / Manage Festival Greeting Card</Text>
                        <ChevronRight color={colors.textSecondary} size={16} />
                      </View>
                    </SpringPressable>
                    <SpringPressable
                      onPress={() => {
                        setSentimentFilter('negative');
                        setActiveTab('community');
                      }}
                    >
                      <View style={s.quickActionRow}>
                        <ThumbsDown color={colors.error} size={18} />
                        <Text style={s.quickActionText}>
                          Inspect Negative Reviews ({reviewStats.negativeCount})
                        </Text>
                        <ChevronRight color={colors.textSecondary} size={16} />
                      </View>
                    </SpringPressable>
                    <SpringPressable onPress={() => setActiveTab('users')}>
                      <View style={s.quickActionRow}>
                        <Users color={colors.primary} size={18} />
                        <Text style={s.quickActionText}>Manage Users ({usersList.length})</Text>
                        <ChevronRight color={colors.textSecondary} size={16} />
                      </View>
                    </SpringPressable>
                    <SpringPressable onPress={() => handleAdminLogout(true)}>
                      <View style={[s.quickActionRow, { borderColor: colors.error + '45' }]}>
                        <LogOut color={colors.error} size={18} />
                        <Text style={[s.quickActionText, { color: colors.error }]}>Logout Admin Session</Text>
                      </View>
                    </SpringPressable>
                  </View>
                </Animated.View>
              </Animated.View>
            )}

            {/* ── FESTIVAL GREETING CARD TAB ── */}
            {activeTab === 'festival' && (
              <Animated.View key="tab-festival" entering={FadeInDown.duration(340)} style={{ gap: 14 }}>
                <View style={s.sectionCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <View style={[s.smallBadge, { backgroundColor: colors.secondaryLight }]}>
                      <Sparkles color={colors.secondary} size={19} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>Festival Greeting Studio</Text>
                      <Text style={s.cardSub}>Shows on every user Home screen during festival days</Text>
                    </View>
                  </View>

                  <Text style={[s.inputLabel, { marginTop: 12 }]}>STEP 1 • TOP TITLE</Text>
                  <TextInput
                    value={festTitle}
                    onChangeText={setFestTitle}
                    placeholder="e.g. Happy Diwali! 🪔"
                    placeholderTextColor={colors.textSecondary}
                    style={s.formInput}
                  />

                  <Text style={[s.inputLabel, { marginTop: 14 }]}>STEP 2 • FESTIVAL PHOTO</Text>
                  <SpringPressable onPress={handlePickFestivalPhoto} disabled={uploadingFestPhoto}>
                    <View style={s.photoUploadBox}>
                      {uploadingFestPhoto ? (
                        <View style={{ alignItems: 'center', gap: 6, paddingVertical: 14 }}>
                          <ActivityIndicator color={colors.secondary} />
                          <Text style={s.cardSub}>Uploading photo securely...</Text>
                        </View>
                      ) : festImageUrl ? (
                        <View style={{ width: '100%' }}>
                          <Image
                            source={{ uri: resolveMediaUrl(festImageUrl) }}
                            style={s.previewUploadImg}
                            resizeMode="cover"
                          />
                          <Text style={[s.cardSub, { textAlign: 'center', marginTop: 7, color: colors.secondary }]}>
                            Tap to change festival photo
                          </Text>
                        </View>
                      ) : (
                        <View style={{ alignItems: 'center', gap: 6, paddingVertical: 16 }}>
                          <ImagePlus color={colors.secondary} size={30} />
                          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: colors.text }}>
                            Upload Festival Photo
                          </Text>
                          <Text style={s.cardSub}>16:9 image recommended (JPG / PNG)</Text>
                        </View>
                      )}
                    </View>
                  </SpringPressable>

                  <Text style={[s.inputLabel, { marginTop: 14 }]}>STEP 3 • FESTIVAL GREETING</Text>
                  <TextInput
                    value={festGreeting}
                    onChangeText={setFestGreeting}
                    placeholder="e.g. Wishing everyone light, joy, and unstoppable focus! ✨"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={3}
                    style={[s.formInput, { minHeight: 82, textAlignVertical: 'top' }]}
                  />

                  <View style={[s.rowBetween, { marginTop: 14, marginBottom: 8 }]}>
                    <Text style={[s.inputLabel, { marginBottom: 0 }]}>STEP 4 • DATE & TIME WINDOW</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          setFestStartAt(null);
                          setFestEndAt(null);
                        }}
                        style={[
                          s.presetChip,
                          !festStartAt && !festEndAt && { backgroundColor: colors.secondary },
                        ]}
                      >
                        <Text
                          style={[
                            s.presetChipText,
                            !festStartAt && !festEndAt && { color: '#FFF' },
                          ]}
                        >
                          All Time
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          const start = new Date();
                          const end = new Date();
                          end.setHours(23, 59, 59, 999);
                          setFestStartAt(start);
                          setFestEndAt(end);
                        }}
                        style={s.presetChip}
                      >
                        <Text style={s.presetChipText}>Today</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          const start = new Date();
                          const end = new Date(Date.now() + 7 * 86400000);
                          end.setHours(23, 59, 59, 999);
                          setFestStartAt(start);
                          setFestEndAt(end);
                        }}
                        style={s.presetChip}
                      >
                        <Text style={s.presetChipText}>7 Days</Text>
                      </Pressable>
                    </View>
                  </View>

                  <Text style={[s.cardSub, { marginBottom: 10 }]}>
                    Card sirf selected Start Date & Time se End Date & Time tak users ko dikhega, uske baad auto-hide ho jayega.
                  </Text>

                  {/* Start Date & Time Selector Card */}
                  <View style={s.scheduleBox}>
                    <View style={s.rowBetween}>
                      <Text style={s.scheduleHeading}>SHOW FROM (START)</Text>
                      {festStartAt && (
                        <Pressable onPress={() => setFestStartAt(null)} hitSlop={8}>
                          <Text style={[s.presetChipText, { color: colors.error }]}>Clear</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <SpringPressable style={{ flex: 1.25 }} onPress={() => setFestPickerTarget('start-date')}>
                        <View style={[s.pickerBtn, festStartAt && s.pickerBtnActive]}>
                          <Calendar color={festStartAt ? colors.secondary : colors.textSecondary} size={15} />
                          <Text style={[s.pickerBtnText, !festStartAt && { color: colors.textSecondary }]} numberOfLines={1}>
                            {formatFestDateLabel(festStartAt)}
                          </Text>
                        </View>
                      </SpringPressable>
                      <SpringPressable style={{ flex: 1 }} onPress={() => setFestPickerTarget('start-time')}>
                        <View style={[s.pickerBtn, festStartAt && s.pickerBtnActive]}>
                          <Clock color={festStartAt ? colors.secondary : colors.textSecondary} size={15} />
                          <Text style={[s.pickerBtnText, !festStartAt && { color: colors.textSecondary }]} numberOfLines={1}>
                            {formatFestTimeLabel(festStartAt)}
                          </Text>
                        </View>
                      </SpringPressable>
                    </View>
                  </View>

                  {/* End Date & Time Selector Card */}
                  <View style={[s.scheduleBox, { marginTop: 10 }]}>
                    <View style={s.rowBetween}>
                      <Text style={s.scheduleHeading}>HIDE AFTER (END)</Text>
                      {festEndAt && (
                        <Pressable onPress={() => setFestEndAt(null)} hitSlop={8}>
                          <Text style={[s.presetChipText, { color: colors.error }]}>Clear</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <SpringPressable style={{ flex: 1.25 }} onPress={() => setFestPickerTarget('end-date')}>
                        <View style={[s.pickerBtn, festEndAt && s.pickerBtnActive]}>
                          <Calendar color={festEndAt ? colors.secondary : colors.textSecondary} size={15} />
                          <Text style={[s.pickerBtnText, !festEndAt && { color: colors.textSecondary }]} numberOfLines={1}>
                            {formatFestDateLabel(festEndAt)}
                          </Text>
                        </View>
                      </SpringPressable>
                      <SpringPressable style={{ flex: 1 }} onPress={() => setFestPickerTarget('end-time')}>
                        <View style={[s.pickerBtn, festEndAt && s.pickerBtnActive]}>
                          <Clock color={festEndAt ? colors.secondary : colors.textSecondary} size={15} />
                          <Text style={[s.pickerBtnText, !festEndAt && { color: colors.textSecondary }]} numberOfLines={1}>
                            {formatFestTimeLabel(festEndAt)}
                          </Text>
                        </View>
                      </SpringPressable>
                    </View>
                  </View>

                  {festPickerTarget && (
                    <View style={{ marginTop: 10 }}>
                      <DateTimePicker
                        value={
                          festPickerTarget.startsWith('start')
                            ? festStartAt || new Date()
                            : festEndAt || festStartAt || new Date()
                        }
                        mode={festPickerTarget.endsWith('date') ? 'date' : 'time'}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        is24Hour={false}
                        minimumDate={
                          festPickerTarget === 'end-date' && festStartAt ? festStartAt : undefined
                        }
                        onChange={handleFestivalPickerChange}
                      />
                      {Platform.OS === 'ios' && (
                        <Pressable
                          onPress={() => setFestPickerTarget(null)}
                          style={[s.presetChip, { alignSelf: 'flex-end', marginTop: 4 }]}
                        >
                          <Text style={s.presetChipText}>Done</Text>
                        </Pressable>
                      )}
                    </View>
                  )}

                  {(festTitle.trim() || festImageUrl || festGreeting.trim()) && (
                    <Animated.View entering={FadeIn.duration(260)} style={{ marginTop: 16 }}>
                      <Text style={s.inputLabel}>LIVE USER HOME PREVIEW</Text>
                      <View style={s.livePreviewCard}>
                        <Text style={s.livePreviewTitle}>{festTitle.trim() || 'Festival Title'}</Text>
                        {festImageUrl ? (
                          <Image
                            source={{ uri: resolveMediaUrl(festImageUrl) }}
                            style={s.livePreviewImg}
                            resizeMode="cover"
                          />
                        ) : null}
                        <Text style={s.livePreviewGreeting}>
                          {festGreeting.trim() || 'Festival greeting message will appear here...'}
                        </Text>
                      </View>
                    </Animated.View>
                  )}

                  <SpringPressable style={{ marginTop: 16 }} onPress={handlePublishFestivalCard} disabled={publishingFest}>
                    <LinearGradient
                      colors={['#FF7A00', '#EA580C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={s.gatePrimaryBtn}
                    >
                      {publishingFest ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <>
                          <Sparkles color="#FFF" size={18} />
                          <Text style={s.gatePrimaryText}>Publish Festival Card</Text>
                        </>
                      )}
                    </LinearGradient>
                  </SpringPressable>
                </View>

                <Text style={[s.cardTitle, { marginTop: 4 }]}>
                  Published Festival Cards ({festivalBanners.length})
                </Text>

                {festivalBanners.length === 0 ? (
                  <View style={s.emptyCard}>
                    <Sparkles color={colors.textSecondary} size={26} />
                    <Text style={s.emptyText}>No festival greeting cards created yet.</Text>
                  </View>
                ) : (
                  festivalBanners.map((b, idx) => (
                    <Animated.View
                      key={b._id}
                      entering={FadeInDown.delay(idx * 50).duration(300)}
                      style={s.sectionCard}
                    >
                      <View style={s.rowBetween}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={s.cardTitle}>{b.title}</Text>
                            <View
                              style={[
                                s.pillTag,
                                { backgroundColor: b.isActive ? colors.success + '22' : colors.border },
                              ]}
                            >
                              <Text
                                style={[
                                  s.pillTagText,
                                  { color: b.isActive ? colors.success : colors.textSecondary },
                                ]}
                              >
                                {b.isActive ? 'ACTIVE' : 'PAUSED'}
                              </Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Calendar color={colors.textSecondary} size={12} />
                            <Text style={s.cardSub}>
                              {b.startDate || b.endDate
                                ? `${b.startDate ? formatBannerDateTime(b.startDate) : 'Now'} → ${
                                    b.endDate ? formatBannerDateTime(b.endDate) : 'Forever'
                                  }`
                                : 'All Time (until paused)'}
                            </Text>
                          </View>
                        </View>
                        <Switch
                          value={Boolean(b.isActive)}
                          onValueChange={() => handleToggleFestivalBanner(b)}
                          trackColor={{ false: colors.border, true: colors.secondary }}
                          thumbColor="#FFF"
                        />
                      </View>

                      {b.imageUrl ? (
                        <Image
                          source={{ uri: resolveMediaUrl(b.imageUrl) }}
                          style={[s.livePreviewImg, { marginTop: 10, marginBottom: 8 }]}
                          resizeMode="cover"
                        />
                      ) : null}

                      <Text style={s.commentBody}>{b.greeting}</Text>

                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                        <Pressable onPress={() => handleDeleteFestivalBanner(b)} style={s.dangerBtn}>
                          <Trash2 color={colors.error} size={14} />
                          <Text style={s.dangerBtnText}>Delete Card</Text>
                        </Pressable>
                      </View>
                    </Animated.View>
                  ))
                )}
              </Animated.View>
            )}

            {/* ── COMMUNITY COMMENTS TAB ── */}
            {activeTab === 'community' && (
              <Animated.View key="tab-community" entering={FadeInRight.duration(260)} style={{ gap: 12 }}>
                <View style={[s.sectionCard, { paddingVertical: 11 }]}>
                  <View style={s.rowBetween}>
                    <Text style={[s.cardSub, { color: colors.success, fontFamily: 'Poppins_600SemiBold' }]}>
                      Positive: {reviewStats.positiveCount} ({reviewStats.positivePercent}%)
                    </Text>
                    <Text style={[s.cardSub, { color: '#F59E0B', fontFamily: 'Poppins_600SemiBold' }]}>
                      Neutral: {reviewStats.neutralCount} ({reviewStats.neutralPercent}%)
                    </Text>
                    <Text style={[s.cardSub, { color: colors.error, fontFamily: 'Poppins_600SemiBold' }]}>
                      Negative: {reviewStats.negativeCount} ({reviewStats.negativePercent}%)
                    </Text>
                  </View>
                </View>

                {filteredReviews.length === 0 ? (
                  <View style={s.emptyCard}>
                    <MessageSquare color={colors.textSecondary} size={26} />
                    <Text style={s.emptyText}>No community comments match this filter.</Text>
                  </View>
                ) : (
                  filteredReviews.map((item, idx) => {
                    const r = Number(item.rating) || 0;
                    const sentimentLabel = r >= 4 ? 'Positive' : r === 3 ? 'Neutral' : 'Negative';
                    const sentimentColor = r >= 4 ? colors.success : r === 3 ? '#F59E0B' : colors.error;

                    return (
                      <Animated.View
                        key={item._id}
                        entering={FadeInDown.delay(Math.min(idx, 8) * 45).duration(280)}
                        style={s.sectionCard}
                      >
                        <View style={s.rowBetween}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={s.cardTitle}>{item.user?.name || 'Deleted User'}</Text>
                              <View style={[s.pillTag, { backgroundColor: sentimentColor + '20' }]}>
                                <Text style={[s.pillTagText, { color: sentimentColor }]}>
                                  {sentimentLabel.toUpperCase()}
                                </Text>
                              </View>
                            </View>
                            <Text style={s.cardSub}>
                              {item.user?.email || 'No email'} • {item.rating} ★ •{' '}
                              {new Date(item.createdAt).toLocaleDateString()}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => handleDeleteReview(item._id, item.user?.name)}
                            style={s.dangerBtn}
                          >
                            <Trash2 color={colors.error} size={15} />
                            <Text style={s.dangerBtnText}>Delete</Text>
                          </Pressable>
                        </View>
                        <Text style={s.commentBody}>{item.text}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                          <Star color="#F59E0B" fill="#F59E0B" size={13} />
                          <Text style={s.cardSub}>{item.likes?.length || 0} Helpful likes</Text>
                        </View>
                      </Animated.View>
                    );
                  })
                )}
              </Animated.View>
            )}

            {/* ── USERS TAB ── */}
            {activeTab === 'users' && (
              <Animated.View key="tab-users" entering={FadeInRight.duration(260)} style={{ gap: 12 }}>
                {filteredUsers.length === 0 ? (
                  <View style={s.emptyCard}>
                    <Users color={colors.textSecondary} size={26} />
                    <Text style={s.emptyText}>No matching users found.</Text>
                  </View>
                ) : (
                  filteredUsers.map((u, idx) => (
                    <Animated.View
                      key={u._id}
                      entering={FadeInDown.delay(Math.min(idx, 8) * 45).duration(280)}
                      style={s.sectionCard}
                    >
                      <View style={s.rowBetween}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          {u.profilePhoto ? (
                            <Image source={{ uri: resolveMediaUrl(u.profilePhoto) }} style={s.avatar} />
                          ) : (
                            <View
                              style={[
                                s.avatar,
                                { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
                              ]}
                            >
                              <Text style={{ fontFamily: 'Poppins_700Bold', color: colors.primary }}>
                                {(u.name || 'U')[0].toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={s.cardTitle}>{u.name}</Text>
                              {u.role === 'admin' && (
                                <View style={[s.pillTag, { backgroundColor: colors.secondaryLight }]}>
                                  <Text style={[s.pillTagText, { color: colors.secondary }]}>ADMIN</Text>
                                </View>
                              )}
                              {u.isBanned && (
                                <View style={[s.pillTag, { backgroundColor: colors.dangerLight }]}>
                                  <Text style={[s.pillTagText, { color: colors.error }]}>BANNED</Text>
                                </View>
                              )}
                              {u.twoFactorEnabled && (
                                <View style={[s.pillTag, { backgroundColor: colors.success + '22' }]}>
                                  <Text style={[s.pillTagText, { color: colors.success }]}>2FA</Text>
                                </View>
                              )}
                            </View>
                            <Text style={s.cardSub} numberOfLines={1}>
                              @{u.username} • {u.email}
                            </Text>
                            <Text style={s.cardSub}>
                              ID: {u.uniqueId} • {u.taskCount || 0} Tasks
                            </Text>
                          </View>
                        </View>
                      </View>

                      {u.role !== 'admin' && (
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                          <Pressable
                            onPress={() => handleToggleBanUser(u)}
                            style={[
                              s.actionChip,
                              { backgroundColor: u.isBanned ? colors.success + '18' : colors.warningLight },
                            ]}
                          >
                            {u.isBanned ? (
                              <CheckCircle2 color={colors.success} size={14} />
                            ) : (
                              <Ban color={colors.warning} size={14} />
                            )}
                            <Text
                              style={[
                                s.actionChipText,
                                { color: u.isBanned ? colors.success : colors.warning },
                              ]}
                            >
                              {u.isBanned ? 'Restore User' : 'Suspend / Ban'}
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={() => handleDeleteUser(u)}
                            style={[s.actionChip, { backgroundColor: colors.dangerLight }]}
                          >
                            <Trash2 color={colors.error} size={14} />
                            <Text style={[s.actionChipText, { color: colors.error }]}>Delete User</Text>
                          </Pressable>
                        </View>
                      )}
                    </Animated.View>
                  ))
                )}
              </Animated.View>
            )}

            {/* ── ADMIN PROFILE & SETTINGS TAB ── */}
            {activeTab === 'profile' && (
              <Animated.View key="tab-profile" entering={FadeInDown.duration(340)} style={{ gap: 14 }}>
                {/* 1. Admin Profile Card */}
                <View style={s.sectionCard}>
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <Pressable onPress={handlePickAdminPhoto} disabled={uploadingAdminPhoto} style={{ position: 'relative' }}>
                      {adminPhotoInput ? (
                        <Image
                          source={{ uri: resolveMediaUrl(adminPhotoInput) }}
                          style={s.profileAvatarLg}
                        />
                      ) : (
                        <LinearGradient colors={['#FF7A00', '#EA580C']} style={s.profileAvatarLgFallback}>
                          <Shield color="#FFF" size={34} />
                        </LinearGradient>
                      )}
                      <View style={s.cameraBadge}>
                        {uploadingAdminPhoto ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <Camera color="#FFF" size={14} />
                        )}
                      </View>
                    </Pressable>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                      <Text style={[s.cardTitle, { fontSize: 17 }]}>{user?.name || 'EventFlow Admin'}</Text>
                      <View style={[s.pillTag, { backgroundColor: colors.secondaryLight }]}>
                        <Text style={[s.pillTagText, { color: colors.secondary }]}>ADMIN</Text>
                      </View>
                    </View>
                    <Text style={s.cardSub}>{user?.email}</Text>
                  </View>

                  <Text style={s.inputLabel}>ADMIN DISPLAY NAME</Text>
                  <TextInput
                    value={adminNameInput}
                    onChangeText={setAdminNameInput}
                    placeholder="EventFlow Admin"
                    placeholderTextColor={colors.textSecondary}
                    style={s.formInput}
                  />

                  <SpringPressable style={{ marginTop: 12 }} onPress={handleSaveAdminProfile} disabled={savingAdminProfile}>
                    <LinearGradient
                      colors={['#FF7A00', '#EA580C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[s.gatePrimaryBtn, { paddingVertical: 12 }]}
                    >
                      {savingAdminProfile ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={s.gatePrimaryText}>Save Admin Profile</Text>
                      )}
                    </LinearGradient>
                  </SpringPressable>
                </View>

                {/* 2. Change Admin Password Card */}
                <View style={s.sectionCard}>
                  <View style={[s.rowBetween, { marginBottom: 12 }]}>
                    <View>
                      <Text style={s.cardTitle}>Change Admin Password</Text>
                      <Text style={s.cardSub}>Update your Admin login password anytime</Text>
                    </View>
                    <Pressable onPress={() => setShowAdminPwds((p) => !p)} style={s.iconBtn}>
                      {showAdminPwds ? (
                        <EyeOff color={colors.textSecondary} size={17} />
                      ) : (
                        <Eye color={colors.textSecondary} size={17} />
                      )}
                    </Pressable>
                  </View>

                  <View style={{ gap: 10 }}>
                    <TextInput
                      value={currentPwdInput}
                      onChangeText={setCurrentPwdInput}
                      placeholder="Current Password"
                      placeholderTextColor={colors.textSecondary}
                      secureTextEntry={!showAdminPwds}
                      style={s.formInput}
                    />
                    <TextInput
                      value={newPwdInput}
                      onChangeText={setNewPwdInput}
                      placeholder="New Password (8+ chars, A-z, 0-9, symbol)"
                      placeholderTextColor={colors.textSecondary}
                      secureTextEntry={!showAdminPwds}
                      style={s.formInput}
                    />
                    <TextInput
                      value={confirmPwdInput}
                      onChangeText={setConfirmPwdInput}
                      placeholder="Confirm New Password"
                      placeholderTextColor={colors.textSecondary}
                      secureTextEntry={!showAdminPwds}
                      style={s.formInput}
                    />
                  </View>

                  <SpringPressable style={{ marginTop: 12 }} onPress={handleChangeAdminPassword} disabled={changingAdminPwd}>
                    <LinearGradient
                      colors={[colors.primary, '#4F46E5']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={s.gateSecondaryBtn}
                    >
                      {changingAdminPwd ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <>
                          <KeyRound color="#FFF" size={17} />
                          <Text style={s.gatePrimaryText}>Update Admin Password</Text>
                        </>
                      )}
                    </LinearGradient>
                  </SpringPressable>
                </View>

                {/* 3. Admin Lock & 3 Security Options */}
                <View style={s.sectionCard}>
                  <View style={[s.rowBetween, { marginBottom: 12 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>Admin Portal Security Lock</Text>
                      <Text style={s.cardSub}>
                        OFF = direct normal email & password login. ON = extra lock using options below.
                      </Text>
                    </View>
                    <Switch
                      value={lockConfig.enabled}
                      onValueChange={(val) => updateLockConfig({ enabled: val })}
                      trackColor={{ false: colors.border, true: colors.secondary }}
                      thumbColor="#FFF"
                    />
                  </View>

                  <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                    <Text style={s.inputLabel}>3 UNLOCK OPTIONS (TURN EACH ON OR OFF)</Text>

                    <View style={s.lockOptionRow}>
                      <View style={[s.smallBadge, { backgroundColor: colors.secondaryLight }]}>
                        <Fingerprint color={colors.secondary} size={18} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle}>1. Fingerprint Lock</Text>
                        <Text style={s.cardSub}>
                          {biometricAvailable ? `${biometricLabel} ready on this phone` : 'Biometric sensor unavailable'}
                        </Text>
                      </View>
                      <Switch
                        value={lockConfig.allowFingerprint}
                        onValueChange={(val) => updateLockConfig({ allowFingerprint: val })}
                        trackColor={{ false: colors.border, true: colors.secondary }}
                        thumbColor="#FFF"
                      />
                    </View>

                    <View style={s.lockOptionRow}>
                      <View style={[s.smallBadge, { backgroundColor: colors.primaryLight }]}>
                        <Smartphone color={colors.primary} size={18} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle}>2. Phone Pattern / Device PIN</Text>
                        <Text style={s.cardSub}>Phone screen Pattern, PIN, or Passcode</Text>
                      </View>
                      <Switch
                        value={lockConfig.allowDevicePattern}
                        onValueChange={(val) => updateLockConfig({ allowDevicePattern: val })}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor="#FFF"
                      />
                    </View>

                    <View style={s.lockOptionRow}>
                      <View style={[s.smallBadge, { backgroundColor: colors.warningLight }]}>
                        <KeyRound color={colors.warning} size={18} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle}>3. Normal Admin Password</Text>
                        <Text style={s.cardSub}>EventFlow Admin password verification</Text>
                      </View>
                      <Switch
                        value={lockConfig.allowPassword}
                        onValueChange={(val) => updateLockConfig({ allowPassword: val })}
                        trackColor={{ false: colors.border, true: colors.warning }}
                        thumbColor="#FFF"
                      />
                    </View>
                  </View>
                </View>

                <SpringPressable onPress={() => handleAdminLogout(true)}>
                  <View style={[s.quickActionRow, { borderColor: colors.error + '50', justifyContent: 'center' }]}>
                    <LogOut color={colors.error} size={18} />
                    <Text style={[s.quickActionText, { color: colors.error, flex: 0 }]}>Logout Admin</Text>
                  </View>
                </SpringPressable>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ColorTheme, isDark: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    glowOrbTop: {
      position: 'absolute',
      top: -90,
      right: -80,
      width: 240,
      height: 240,
      borderRadius: 120,
    },
    glowOrbBottom: {
      position: 'absolute',
      bottom: -90,
      left: -80,
      width: 220,
      height: 220,
      borderRadius: 110,
    },
    gateRoot: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      padding: 24,
    },
    gateLogoutBtn: {
      position: 'absolute',
      top: 54,
      right: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 14,
      backgroundColor: colors.dangerLight,
    },
    gateCard: {
      backgroundColor: colors.card,
      borderRadius: 26,
      padding: 26,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.35 : 0.08,
      shadowRadius: 20,
      elevation: 6,
    },
    gateBadge: {
      width: 80,
      height: 80,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    gateTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 21,
      color: colors.text,
      textAlign: 'center',
    },
    gateSub: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 13.5,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 6,
      marginBottom: 20,
    },
    gatePrimaryBtn: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 15,
    },
    gateSecondaryBtn: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13.5,
      borderRadius: 15,
    },
    gatePrimaryText: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 14.5,
      color: '#FFFFFF',
    },
    gateInput: {
      width: '100%',
      backgroundColor: isDark ? colors.background : '#F8FAFC',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: 'Poppins_500Medium',
      fontSize: 14,
      color: colors.text,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '80',
    },
    headerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 14,
    },
    headerAvatarFallback: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 17.5,
      color: colors.text,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#10B9811A',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 8,
    },
    liveBadgeText: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 9,
      color: '#10B981',
      letterSpacing: 0.6,
    },
    headerSub: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 11.5,
      color: colors.textSecondary,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 14,
      paddingVertical: 11,
      gap: 8,
    },
    tabPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 13,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabPillText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 11.5,
      color: colors.textSecondary,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 14,
      marginBottom: 9,
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontFamily: 'Poppins_400Regular',
      fontSize: 13.5,
      color: colors.text,
      paddingVertical: 2,
    },
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 14,
      marginBottom: 8,
      gap: 7,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 11,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 11.5,
      color: colors.textSecondary,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 14,
      paddingBottom: 72,
    },
    heroBanner: {
      borderRadius: 22,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      shadowColor: '#FF7A00',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.25 : 0.22,
      shadowRadius: 16,
      elevation: 6,
    },
    heroEyebrow: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 10,
      color: 'rgba(255,255,255,0.78)',
      letterSpacing: 1.2,
    },
    heroBigText: {
      fontFamily: 'Poppins_800ExtraBold',
      fontSize: 24,
      color: '#FFFFFF',
      marginTop: 2,
    },
    heroSubText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 12.5,
      color: 'rgba(255,255,255,0.9)',
      marginTop: 2,
    },
    heroIconGlass: {
      width: 54,
      height: 54,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    statGridCell: {
      width: '48.3%',
    },
    statCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 15,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    statIconDot: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    statNum: {
      fontFamily: 'Poppins_800ExtraBold',
      fontSize: 22,
      color: colors.text,
    },
    statLabel: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    avgBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: '#F59E0B1A',
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 11,
    },
    avgBadgeText: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 15,
      color: '#F59E0B',
    },
    sentimentRow: {
      flexDirection: 'row',
      gap: 8,
    },
    sentimentBox: {
      borderRadius: 15,
      padding: 10,
      borderWidth: 1,
      alignItems: 'center',
      gap: 3,
    },
    sentimentPercent: {
      fontFamily: 'Poppins_800ExtraBold',
      fontSize: 18,
    },
    sentimentLabel: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 10,
      color: colors.text,
      textAlign: 'center',
    },
    sentimentCount: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 10,
      color: colors.textSecondary,
    },
    stackedBar: {
      height: 9,
      borderRadius: 5,
      overflow: 'hidden',
      flexDirection: 'row',
      marginTop: 12,
      backgroundColor: colors.border,
    },
    starDistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    starDistLabel: {
      width: 28,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 11.5,
      color: colors.text,
    },
    starDistCount: {
      width: 60,
      textAlign: 'right',
      fontFamily: 'Poppins_500Medium',
      fontSize: 11,
      color: colors.textSecondary,
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: 19,
      padding: 15,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.22 : 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    smallBadge: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    cardTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 14.5,
      color: colors.text,
    },
    cardSub: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 11.5,
      color: colors.textSecondary,
    },
    commentBody: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 13.5,
      color: colors.text,
      marginTop: 8,
      lineHeight: 20,
    },
    dangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.dangerLight,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 11,
    },
    dangerBtnText: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 11.5,
      color: colors.error,
    },
    quickActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.background : '#F8FAFC',
    },
    quickActionText: {
      flex: 1,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      color: colors.text,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    pillTag: {
      paddingHorizontal: 8,
      paddingVertical: 2.5,
      borderRadius: 7,
    },
    pillTagText: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 9.5,
    },
    actionChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9.5,
      borderRadius: 11,
    },
    actionChipText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 12,
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 32,
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    emptyText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 13.5,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    inputLabel: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 11,
      letterSpacing: 0.6,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    formInput: {
      backgroundColor: isDark ? colors.background : '#F8FAFC',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      paddingHorizontal: 13,
      paddingVertical: 11,
      fontFamily: 'Poppins_500Medium',
      fontSize: 13.5,
      color: colors.text,
    },
    photoUploadBox: {
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.secondary + '80',
      borderRadius: 16,
      padding: 10,
      backgroundColor: isDark ? colors.background : '#FFFBF5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewUploadImg: {
      width: '100%',
      height: 160,
      borderRadius: 12,
    },
    presetChip: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 9,
      backgroundColor: colors.secondaryLight,
    },
    presetChipText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 10.5,
      color: colors.secondary,
    },
    scheduleBox: {
      borderRadius: 14,
      padding: 11,
      backgroundColor: isDark ? colors.background : '#F8FAFC',
      borderWidth: 1,
      borderColor: colors.border,
    },
    scheduleHeading: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.textSecondary,
    },
    pickerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 10,
      borderRadius: 11,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pickerBtnActive: {
      borderColor: colors.secondary + '70',
      backgroundColor: colors.secondaryLight + '55',
    },
    pickerBtnText: {
      flex: 1,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 12,
      color: colors.text,
    },
    livePreviewCard: {
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.secondary + '60',
      borderRadius: 22,
      padding: 16,
      alignItems: 'center',
      backgroundColor: isDark ? colors.background : '#FFF9F2',
      gap: 10,
    },
    livePreviewTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 18,
      color: colors.secondary,
      textAlign: 'center',
    },
    livePreviewImg: {
      width: '100%',
      height: 165,
      borderRadius: 14,
    },
    livePreviewGreeting: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 13.5,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    profileAvatarLg: {
      width: 82,
      height: 82,
      borderRadius: 41,
      borderWidth: 2,
      borderColor: colors.secondary,
    },
    profileAvatarLgFallback: {
      width: 82,
      height: 82,
      borderRadius: 41,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.card,
    },
    lockOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderRadius: 14,
      backgroundColor: isDark ? colors.background : '#F8FAFC',
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
