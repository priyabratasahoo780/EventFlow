/**
 * admin/index.tsx
 * Fingerprint-protected Admin Portal for managing Community Comments, Users, Tasks, and App Health.
 */
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import {
  Shield,
  Fingerprint,
  ArrowLeft,
  Users,
  MessageSquare,
  CheckSquare,
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
} from 'lucide-react-native';
import { useThemeStore } from '../../store/useThemeStore';
import { useAuthStore } from '../../store/useAuthStore';
import { ColorTheme } from '../../constants/theme';
import api from '../../services/api';
import {
  getBiometricCapabilities,
  authenticateWithBiometrics,
  isAdminBiometricLockEnabled,
  setAdminBiometricLockEnabled,
  clearAdminVaultSession,
} from '../../services/biometricAuth';

type AdminTab = 'overview' | 'community' | 'users' | 'tasks';

export default function AdminPortalScreen() {
  const router = useRouter();
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();
  const dark = isDark();
  const s = getStyles(colors, dark);
  const { user, logout } = useAuthStore();

  // Security / Lock Gate State
  const [unlocked, setUnlocked] = useState(false);
  const [checkingGate, setCheckingGate] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Fingerprint');
  const [biometricLockEnabled, setBiometricLockEnabled] = useState(true);
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Admin Portal Data State
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [overview, setOverview] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [tasksList, setTasksList] = useState<any[]>([]);

  const showToast = (msg: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert('Admin Portal', msg);
    }
  };

  const fetchOverviewAndAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [ovRes, revRes, usrRes, tskRes] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/reviews'),
        api.get('/admin/users'),
        api.get('/admin/tasks'),
      ]);
      setOverview(ovRes.data);
      setReviews(revRes.data || []);
      setUsersList(usrRes.data || []);
      setTasksList(tskRes.data || []);
      setAccessDenied(false);
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.response?.status === 401) {
        setAccessDenied(true);
        setUnlocked(false);
      } else {
        Alert.alert('Connection Error', err?.response?.data?.error || 'Could not load Admin Portal data.');
      }
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  }, []);

  const triggerFingerprintUnlock = useCallback(async () => {
    setUnlocking(true);
    try {
      const result = await authenticateWithBiometrics('Scan your fingerprint to enter Admin Portal');
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setUnlocked(true);
        setShowPasswordFallback(false);
        await fetchOverviewAndAll();
      } else if (result.unavailable) {
        setShowPasswordFallback(true);
      } else if (result.error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setUnlocking(false);
    }
  }, [fetchOverviewAndAll]);

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

        const [caps, lockOn] = await Promise.all([
          getBiometricCapabilities(),
          isAdminBiometricLockEnabled(),
        ]);

        if (!mounted) return;
        setBiometricAvailable(caps.available);
        setBiometricLabel(caps.label);
        setBiometricLockEnabled(lockOn);
        setCheckingGate(false);

        if (!lockOn) {
          setUnlocked(true);
          await fetchOverviewAndAll();
        } else if (caps.available) {
          await triggerFingerprintUnlock();
        } else {
          setShowPasswordFallback(true);
        }
      } catch {
        if (mounted) {
          setCheckingGate(false);
          setShowPasswordFallback(true);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const handlePasswordUnlock = async () => {
    if (!adminPasswordInput) {
      Alert.alert('Password Required', 'Enter your Admin password to unlock.');
      return;
    }
    setUnlocking(true);
    try {
      const res = await api.post('/auth/login', {
        email: user?.email,
        password: adminPasswordInput,
      });
      if (res.data?.user?.role !== 'admin') {
        setAccessDenied(true);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAdminPasswordInput('');
      setUnlocked(true);
      await fetchOverviewAndAll();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Verification Failed', err?.response?.data?.error || 'Incorrect Admin password.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleToggleBiometricLock = async (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (val && !biometricAvailable) {
      Alert.alert(
        'Fingerprint Not Available',
        'Please enroll a fingerprint in your phone Settings (or rebuild APK with expo-local-authentication) to enable biometric lock.'
      );
      return;
    }
    setBiometricLockEnabled(val);
    await setAdminBiometricLockEnabled(val);
    showToast(val ? 'Fingerprint Lock Enabled' : 'Fingerprint Lock Disabled');
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
              setOverview((prev: any) =>
                prev
                  ? {
                      ...prev,
                      stats: { ...prev.stats, totalReviews: Math.max(0, (prev.stats.totalReviews || 1) - 1) },
                    }
                  : prev
              );
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

  const handleDeleteTask = (task: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Remove Task',
      `Remove task "${task.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/tasks/${task._id}`);
              setTasksList((prev) => prev.filter((t) => t._id !== task._id));
              showToast('Task removed');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to remove task.');
            }
          },
        },
      ]
    );
  };

  const handleExitAdmin = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const qLower = searchQuery.trim().toLowerCase();
  const filteredReviews = qLower
    ? reviews.filter((r) =>
        `${r.text || ''} ${r.user?.name || ''} ${r.user?.email || ''}`.toLowerCase().includes(qLower)
      )
    : reviews;
  const filteredUsers = qLower
    ? usersList.filter((u) =>
        `${u.name || ''} ${u.username || ''} ${u.email || ''} ${u.uniqueId || ''}`.toLowerCase().includes(qLower)
      )
    : usersList;
  const filteredTasks = qLower
    ? tasksList.filter((t) =>
        `${t.title || ''} ${t.category || ''} ${t.ownerId?.name || ''} ${t.ownerId?.email || ''}`
          .toLowerCase()
          .includes(qLower)
      )
    : tasksList;

  // ── 1. ACCESS DENIED SCREEN ───────────────────────────────────
  if (accessDenied) {
    return (
      <SafeAreaView style={s.gateRoot}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <View style={s.gateCard}>
          <View style={[s.gateBadge, { backgroundColor: colors.dangerLight }]}>
            <AlertTriangle color={colors.error} size={34} />
          </View>
          <Text style={s.gateTitle}>Admin Access Restricted</Text>
          <Text style={s.gateSub}>
            Only verified EventFlow administrators can access this management portal.
          </Text>
          <Pressable style={s.gatePrimaryBtn} onPress={handleExitAdmin}>
            <Text style={s.gatePrimaryText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── 2. FINGERPRINT / PASSWORD LOCK SCREEN ─────────────────────
  if (!unlocked) {
    return (
      <SafeAreaView style={s.gateRoot}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <Pressable style={s.gateBackBtn} onPress={handleExitAdmin}>
          <ArrowLeft color={colors.text} size={22} />
        </Pressable>

        <Animated.View entering={ZoomIn.duration(350)} style={s.gateCard}>
          <View style={[s.gateBadge, { backgroundColor: colors.secondaryLight }]}>
            {checkingGate || unlocking ? (
              <ActivityIndicator color={colors.secondary} size="large" />
            ) : (
              <Fingerprint color={colors.secondary} size={40} strokeWidth={1.8} />
            )}
          </View>

          <Text style={s.gateTitle}>Admin Portal Locked</Text>
          <Text style={s.gateSub}>
            {user?.email ? `Signed in as ${user.email}\n` : ''}
            Verify with {biometricLabel} or Admin Password to manage EventFlow.
          </Text>

          {biometricAvailable && (
            <Pressable
              style={({ pressed }) => [s.gatePrimaryBtn, pressed && { opacity: 0.85 }]}
              onPress={triggerFingerprintUnlock}
              disabled={unlocking}
            >
              <Fingerprint color="#FFF" size={20} />
              <Text style={s.gatePrimaryText}>Scan {biometricLabel} to Unlock</Text>
            </Pressable>
          )}

          {showPasswordFallback ? (
            <View style={{ width: '100%', marginTop: 14, gap: 10 }}>
              <TextInput
                value={adminPasswordInput}
                onChangeText={setAdminPasswordInput}
                placeholder="Enter Admin Password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                style={s.gateInput}
                onSubmitEditing={handlePasswordUnlock}
              />
              <Pressable
                style={({ pressed }) => [
                  s.gateSecondaryBtn,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handlePasswordUnlock}
                disabled={unlocking}
              >
                <KeyRound color="#FFF" size={18} />
                <Text style={s.gatePrimaryText}>Verify Password</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={{ marginTop: 14, padding: 6 }}
              onPress={() => setShowPasswordFallback(true)}
            >
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: colors.textSecondary }}>
                Use Admin Password Instead
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── 3. UNLOCKED ADMIN PORTAL ──────────────────────────────────
  const stats = overview?.stats || {};

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar style={dark ? 'light' : 'dark'} />

      {/* Top Header */}
      <View style={s.header}>
        <Pressable style={s.iconBtn} onPress={handleExitAdmin}>
          <ArrowLeft color={colors.text} size={20} />
        </Pressable>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Shield color={colors.secondary} size={18} strokeWidth={2.5} />
            <Text style={s.headerTitle}>Admin Portal</Text>
          </View>
          <Text style={s.headerSub} numberOfLines={1}>
            {overview?.admin?.email || user?.email}
          </Text>
        </View>

        <Pressable
          style={s.iconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setRefreshing(true);
            fetchOverviewAndAll();
          }}
        >
          <RefreshCw color={colors.text} size={18} />
        </Pressable>

        <Pressable
          style={[s.iconBtn, { marginLeft: 8, backgroundColor: colors.secondaryLight }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setUnlocked(false);
          }}
        >
          <Lock color={colors.secondary} size={18} />
        </Pressable>
      </View>

      {/* Navigation Tabs */}
      <View style={s.tabBar}>
        {(
          [
            { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
            { key: 'community', label: `Community (${reviews.length})`, Icon: MessageSquare },
            { key: 'users', label: `Users (${usersList.length})`, Icon: Users },
            { key: 'tasks', label: `Tasks (${tasksList.length})`, Icon: CheckSquare },
          ] as const
        ).map(({ key, label, Icon }) => {
          const active = activeTab === key;
          return (
            <Pressable
              key={key}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(key);
              }}
              style={[s.tabPill, active && { backgroundColor: colors.secondary }]}
            >
              <Icon color={active ? '#FFF' : colors.textSecondary} size={14} />
              <Text style={[s.tabPillText, active && { color: '#FFF' }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Search Bar for Moderation Tabs */}
      {activeTab !== 'overview' && (
        <View style={s.searchWrap}>
          <Search color={colors.textSecondary} size={17} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              activeTab === 'community'
                ? 'Search comments or author...'
                : activeTab === 'users'
                  ? 'Search name, email, or Unique ID...'
                  : 'Search tasks or owners...'
            }
            placeholderTextColor={colors.textSecondary}
            style={s.searchInput}
          />
        </View>
      )}

      {/* Main Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
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
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.secondary} />
          </View>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 14 }}>
                <View style={s.statsGrid}>
                  <View style={s.statCard}>
                    <Text style={s.statNum}>{stats.totalUsers ?? 0}</Text>
                    <Text style={s.statLabel}>Total Users</Text>
                  </View>
                  <View style={s.statCard}>
                    <Text style={[s.statNum, { color: colors.secondary }]}>{stats.totalReviews ?? 0}</Text>
                    <Text style={s.statLabel}>Community Comments</Text>
                  </View>
                  <View style={s.statCard}>
                    <Text style={[s.statNum, { color: '#F59E0B' }]}>{stats.avgRating ?? 0} ★</Text>
                    <Text style={s.statLabel}>Avg Rating</Text>
                  </View>
                  <View style={s.statCard}>
                    <Text style={[s.statNum, { color: colors.primary }]}>{stats.totalTasks ?? 0}</Text>
                    <Text style={s.statLabel}>Total Tasks</Text>
                  </View>
                  <View style={s.statCard}>
                    <Text style={[s.statNum, { color: colors.success }]}>{stats.twoFactorUsers ?? 0}</Text>
                    <Text style={s.statLabel}>2FA Protected</Text>
                  </View>
                  <View style={s.statCard}>
                    <Text style={[s.statNum, { color: colors.error }]}>{stats.bannedUsers ?? 0}</Text>
                    <Text style={s.statLabel}>Banned Users</Text>
                  </View>
                </View>

                {/* Biometric Security Control */}
                <View style={s.sectionCard}>
                  <View style={s.rowBetween}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={[s.smallBadge, { backgroundColor: colors.secondaryLight }]}>
                        <Fingerprint color={colors.secondary} size={20} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle}>Fingerprint Portal Lock</Text>
                        <Text style={s.cardSub}>
                          {biometricAvailable
                            ? `Require ${biometricLabel} whenever opening Admin Portal`
                            : 'Biometric scanner unavailable on this runtime'}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={biometricLockEnabled}
                      onValueChange={handleToggleBiometricLock}
                      trackColor={{ false: colors.border, true: colors.secondary }}
                      thumbColor="#FFF"
                    />
                  </View>
                </View>

                {/* Quick Actions */}
                <View style={s.sectionCard}>
                  <Text style={[s.cardTitle, { marginBottom: 10 }]}>Quick Moderation</Text>
                  <View style={{ gap: 10 }}>
                    <Pressable
                      style={s.quickActionRow}
                      onPress={() => setActiveTab('community')}
                    >
                      <MessageSquare color={colors.secondary} size={18} />
                      <Text style={s.quickActionText}>Moderate Community Comments ({reviews.length})</Text>
                    </Pressable>
                    <Pressable
                      style={s.quickActionRow}
                      onPress={() => setActiveTab('users')}
                    >
                      <Users color={colors.primary} size={18} />
                      <Text style={s.quickActionText}>Manage Registered Users ({usersList.length})</Text>
                    </Pressable>
                    <Pressable
                      style={[s.quickActionRow, { borderColor: colors.error + '40' }]}
                      onPress={async () => {
                        await clearAdminVaultSession();
                        await logout();
                        router.replace('/(auth)/login');
                      }}
                    >
                      <Lock color={colors.error} size={18} />
                      <Text style={[s.quickActionText, { color: colors.error }]}>
                        Logout & Clear Admin Fingerprint Vault
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* COMMUNITY COMMENTS TAB */}
            {activeTab === 'community' && (
              <View style={{ gap: 12 }}>
                {filteredReviews.length === 0 ? (
                  <Text style={s.emptyText}>No community comments found.</Text>
                ) : (
                  filteredReviews.map((item) => (
                    <View key={item._id} style={s.sectionCard}>
                      <View style={s.rowBetween}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.cardTitle}>{item.user?.name || 'Deleted User'}</Text>
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
                    </View>
                  ))
                )}
              </View>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
              <View style={{ gap: 12 }}>
                {filteredUsers.length === 0 ? (
                  <Text style={s.emptyText}>No matching users found.</Text>
                ) : (
                  filteredUsers.map((u) => (
                    <View key={u._id} style={s.sectionCard}>
                      <View style={s.rowBetween}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          {u.profilePhoto ? (
                            <Image source={{ uri: u.profilePhoto }} style={s.avatar} />
                          ) : (
                            <View style={[s.avatar, { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }]}>
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
                              {
                                backgroundColor: u.isBanned ? colors.success + '18' : colors.warningLight,
                              },
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
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TASKS TAB */}
            {activeTab === 'tasks' && (
              <View style={{ gap: 12 }}>
                {filteredTasks.length === 0 ? (
                  <Text style={s.emptyText}>No platform tasks found.</Text>
                ) : (
                  filteredTasks.map((t) => (
                    <View key={t._id} style={s.sectionCard}>
                      <View style={s.rowBetween}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.cardTitle}>{t.title}</Text>
                          <Text style={s.cardSub}>
                            By {t.ownerId?.name || 'Unknown'} ({t.ownerId?.email || 'N/A'})
                          </Text>
                          <Text style={s.cardSub}>
                            {t.category} • {t.priority?.toUpperCase()} • {t.status}
                          </Text>
                        </View>
                        <Pressable onPress={() => handleDeleteTask(t)} style={s.dangerBtn}>
                          <Trash2 color={colors.error} size={15} />
                          <Text style={s.dangerBtnText}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ColorTheme, isDark: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    gateRoot: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      padding: 24,
    },
    gateBackBtn: {
      position: 'absolute',
      top: 54,
      left: 20,
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    gateCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 26,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    gateBadge: {
      width: 76,
      height: 76,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    gateTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 20,
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
      backgroundColor: colors.secondary,
      paddingVertical: 14,
      borderRadius: 14,
    },
    gateSecondaryBtn: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 14,
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
      borderRadius: 12,
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
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 18,
      color: colors.text,
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
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 6,
    },
    tabPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabPillText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 10.5,
      color: colors.textSecondary,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 14,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
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
    scrollContent: {
      padding: 14,
      paddingBottom: 36,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    statCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
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
      marginTop: 2,
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    smallBadge: {
      width: 40,
      height: 40,
      borderRadius: 12,
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
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 10,
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
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.background : '#F8FAFC',
    },
    quickActionText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      color: colors.text,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
    },
    pillTag: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
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
      paddingVertical: 9,
      borderRadius: 10,
    },
    actionChipText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 12,
    },
    emptyText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 40,
    },
  });
