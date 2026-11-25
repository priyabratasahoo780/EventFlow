import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Switch, Pressable, ScrollView, Alert, ToastAndroid, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VolumeX, Moon, Bell, Download, Upload, Trash2, Info, Users, Volume2, UserPlus, Sun, Lock, UserX, Shield } from 'lucide-react-native';
import { useEventStore } from '../../store/useEventStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useAuthStore } from '../../store/useAuthStore';
import api from '../../services/api';
import { ColorTheme } from '../../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import * as Notifications from '../../mock-expo-notifications';
import { Event } from '../../models/Event';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import AlarmModal from '../../components/AlarmModal';

export default function SettingsScreen() {
  const { setMode, isDark, getColors } = useThemeStore();
  const isDarkMode = isDark();
  const colors = getColors();
  const styles = getStyles(colors);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [muteFriendAlarms, setMuteFriendAlarms] = useState(false);
  const [showTestAlarmModal, setShowTestAlarmModal] = useState(false);
  const router = useRouter();
  
  const { user, updateUserProfile, logout } = useAuthStore();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const { events, clearCompletedEvents, addEvent, loadEvents } = useEventStore();

  useEffect(() => {
    (async () => {
      try {
        const storedReminders = await AsyncStorage.getItem('smartRemindersEnabled');
        if (storedReminders !== null) {
          setNotificationsEnabled(JSON.parse(storedReminders));
        } else {
          const { status } = await Notifications.getPermissionsAsync();
          setNotificationsEnabled(status === 'granted');
        }
      } catch (e) {
        console.warn('Notification permission check error:', e);
      }
      
      try {
        const storedMute = await AsyncStorage.getItem('muteFriendAlarms');
        if (storedMute !== null) setMuteFriendAlarms(JSON.parse(storedMute));
      } catch (e) {}
    })();
  }, []);

  const toggleTheme = (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(val ? 'dark' : 'light');
  };

  const toggleNotifications = async (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (val) {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        const granted = status === 'granted';
        setNotificationsEnabled(granted);
        await AsyncStorage.setItem('smartRemindersEnabled', JSON.stringify(granted));
        if (granted) {
          if (Platform.OS === 'android') ToastAndroid.show('Notifications Enabled! 🔔', ToastAndroid.SHORT);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '🔔 FocusFlow Notifications Active',
              body: 'Smart contextual reminders and alarms are fully enabled!',
              sound: 'default',
            },
            trigger: null,
          });
        } else {
          Alert.alert('Permissions Required', 'Please enable notifications in your phone Settings to receive task alarms.');
        }
      } catch (e) {
        console.warn('Notification error:', e);
        setNotificationsEnabled(false);
        await AsyncStorage.setItem('smartRemindersEnabled', JSON.stringify(false));
      }
    } else {
      setNotificationsEnabled(false);
      await AsyncStorage.setItem('smartRemindersEnabled', JSON.stringify(false));
      if (Platform.OS === 'android') {
        ToastAndroid.show('Notifications disabled', ToastAndroid.SHORT);
      }
    }
  };

  const toggleMuteFriendAlarms = async (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMuteFriendAlarms(val);
    await AsyncStorage.setItem('muteFriendAlarms', JSON.stringify(val));
    if (Platform.OS === 'android') {
      ToastAndroid.show(val ? 'Friend alarms muted 🔇' : 'Friend alarms unmuted 🔊', ToastAndroid.SHORT);
    }
  };

  const testAlarmChime = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowTestAlarmModal(true);
  };

  const toggle2FA = async (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTwoFactorEnabled(val); // optimistic update
    try {
      const res = await api.post('/auth/2fa/toggle', { enabled: val });
      if (res.data?.user) {
        updateUserProfile({ twoFactorEnabled: res.data.user.twoFactorEnabled });
      }
      if (Platform.OS === 'android') {
        ToastAndroid.show(val ? '2FA Enabled 🔒' : '2FA Disabled 🔓', ToastAndroid.SHORT);
      }
    } catch (err) {
      console.error('Failed to toggle 2FA', err);
      setTwoFactorEnabled(!val); // revert on failure
      Alert.alert('Error', 'Failed to update 2FA settings.');
    }
  };

  const handleClearCompleted = () => {
    const completedCount = events.filter(e => e.completed || e.status === 'completed').length;
    if (completedCount === 0) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('No completed tasks to clear!', ToastAndroid.SHORT);
      } else {
        Alert.alert('No Completed Tasks', 'You do not have any completed tasks to clear.');
      }
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Clear Completed Tasks",
      `Are you sure you want to remove all ${completedCount} completed task(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear All", 
          style: "destructive",
          onPress: async () => {
            await clearCompletedEvents();
            if (Platform.OS === 'android') ToastAndroid.show(`Cleared ${completedCount} completed task(s)!`, ToastAndroid.SHORT);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete Account Permanently',
      'Are you sure you want to delete your account? This will permanently delete your profile, tasks, messages, and all personal data. This action CANNOT be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              await api.delete('/users/account');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (Platform.OS === 'android') {
                ToastAndroid.show('Account permanently deleted', ToastAndroid.LONG);
              }
              await logout();
              router.replace('/(auth)/welcome');
            } catch (err: any) {
              const msg = err.response?.data?.error || 'Failed to delete account. Please try again.';
              Alert.alert('Error', msg);
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const exportEvents = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const fileUri = (FileSystem.documentDirectory || '') + 'focusflow_backup.json';
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(events, null, 2), { encoding: 'utf8' as any });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export FocusFlow Tasks & Events Backup',
          UTI: 'public.json'
        });
      } else {
        Alert.alert('Export Success', `Backup saved locally to:\n${fileUri}`);
      }
    } catch (err) {
      console.error(err);
      if (Platform.OS === 'android') ToastAndroid.show('Failed to export events', ToastAndroid.SHORT);
    }
  };

  const importEvents = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: 'utf8' as any });
        const importedData = JSON.parse(fileContent);
        
        if (Array.isArray(importedData)) {
          let count = 0;
          for (const ev of importedData) {
            if (ev.id && ev.title && ev.date) {
              const existing = events.find(e => e.id === ev.id);
              if (!existing) {
                const cleanEv = { ...ev, reminders: ev.reminders?.map((r: any) => ({ ...r, notificationIds: [] })) };
                await addEvent(cleanEv as Event);
                count++;
              }
            }
          }
          await loadEvents();
          Alert.alert('Import Success', `Successfully imported ${count} new task(s) into FocusFlow!`);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          throw new Error('Invalid JSON structure');
        }
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Import Failed', 'Please select a valid FocusFlow backup JSON file.');
    }
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://github.com');
  };

  const testAlarmEvent: Event = {
    id: 'test-alarm-id',
    title: 'Test Alarm Configuration',
    description: 'This is a test to verify notification sound and routing.',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM',
    category: 'System',
    priority: 'critical',
    priorityScore: 100,
    estimatedDuration: 5,
    completed: false,
    status: 'pending',
    reminders: [],
    visibility: 'onlyMe',
    color: colors.secondary,
    icon: 'bell',
    notes: '',
    location: '',
    sharedWith: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <View style={styles.root}>
      <View style={styles.bgGlow} />

      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBox}>
          <Text style={styles.header}>Settings</Text>
          <Text style={styles.headerSub}>Manage your preferences</Text>
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          
          <View style={styles.premiumCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBadge, { backgroundColor: colors.primaryLight }]}>
                  {isDarkMode ? (
                    <Sun color={colors.primary} size={18} strokeWidth={2.5} />
                  ) : (
                    <Moon color={colors.primary} size={18} strokeWidth={2.5} />
                  )}
                </View>
                <Text style={styles.settingText}>App Theme</Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.secondary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBadge, { backgroundColor: colors.secondaryLight }]}>
                  <Bell color={colors.secondary} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.settingText}>Smart Reminders</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <Pressable style={({pressed}) => [styles.settingRow, pressed && { opacity: 0.7 }]} onPress={testAlarmChime}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBadge, { backgroundColor: colors.dangerLight }]}>
                  <Volume2 color={colors.error} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.settingText}>Test Alarm Chime</Text>
              </View>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>FRIENDS & COLLABORATION</Text>
          
          <View style={styles.premiumCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBadge, { backgroundColor: colors.dangerLight }]}>
                  <VolumeX color={colors.error} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.settingText}>Mute Friend Alarms</Text>
              </View>
              <Switch
                value={muteFriendAlarms}
                onValueChange={toggleMuteFriendAlarms}
                trackColor={{ false: colors.border, true: colors.error }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <Pressable style={({pressed}) => [styles.settingRow, pressed && { opacity: 0.7 }]} onPress={() => router.push('/friends/list' as any)}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBadge, { backgroundColor: colors.primaryLight }]}>
                  <Users color={colors.primary} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.settingText}>My Friends</Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={({pressed}) => [styles.settingRow, pressed && { opacity: 0.7 }]} onPress={() => router.push('/friends/requests' as any)}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBadge, { backgroundColor: colors.secondaryLight }]}>
                  <Bell color={colors.secondary} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.settingText}>Friend Requests</Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={({pressed}) => [styles.settingRow, pressed && { opacity: 0.7 }]} onPress={() => router.push('/friends/connect' as any)}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBadge, { backgroundColor: colors.successLight }]}>
                  <UserPlus color={colors.success} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.settingText}>Add a Friend</Text>
              </View>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>DATA & BACKUP</Text>
          
          <View style={styles.premiumCard}>
            <Pressable style={({pressed}) => [styles.settingRow, pressed && { opacity: 0.7 }]} onPress={exportEvents}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBadge, { backgroundColor: colors.secondaryLight }]}>
                  <Download color={colors.secondary} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.settingText}>Export Backup (JSON)</Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={({pressed}) => [styles.settingRow, pressed && { opacity: 0.7 }]} onPress={importEvents}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBadge, { backgroundColor: colors.primaryLight }]}>
                  <Upload color={colors.primary} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.settingText}>Import Backup (JSON)</Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={({pressed}) => [styles.settingRow, pressed && { opacity: 0.7 }]} onPress={handleClearCompleted}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBadge, { backgroundColor: colors.dangerLight }]}>
                  <Trash2 color={colors.error} size={18} strokeWidth={2.5} />
                </View>
                <Text style={[styles.settingText, { color: colors.error }]}>Clear Completed Tasks</Text>
              </View>
            </Pressable>
          </View>

          {user?.role === 'admin' && (
            <>
              <Text style={styles.sectionTitle}>ADMINISTRATION</Text>
              <View style={styles.premiumCard}>
                <Pressable
                  style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push('/admin' as any);
                  }}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.iconBadge, { backgroundColor: colors.secondaryLight }]}>
                      <Shield color={colors.secondary} size={18} strokeWidth={2.5} />
                    </View>
                    <View>
                      <Text style={styles.settingText}>Admin Portal</Text>
                      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 11, color: colors.textSecondary }}>
                        Fingerprint-protected community & app console
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>SECURITY</Text>
          
          <View style={styles.premiumCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBadge, { backgroundColor: colors.warningLight }]}>
                  <Lock color={colors.warning} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.settingText}>Two-Factor Auth (2FA)</Text>
              </View>
              <Switch
                value={twoFactorEnabled}
                onValueChange={toggle2FA}
                trackColor={{ false: colors.border, true: colors.warning }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>ABOUT</Text>
          
          <View style={styles.premiumCard}>
            <Pressable style={({pressed}) => [styles.settingRow, pressed && { opacity: 0.7 }]} onPress={openPrivacyPolicy}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBadge, { backgroundColor: colors.primaryLight }]}>
                  <Info color={colors.primary} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.settingText}>Privacy & Security</Text>
              </View>
            </Pressable>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.error }]}>DANGER ZONE</Text>
          
          <View style={styles.premiumCard}>
            <Pressable 
              style={({pressed}) => [styles.settingRow, pressed && { opacity: 0.7 }]} 
              onPress={handleDeleteAccount}
              disabled={isDeletingAccount}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.iconBadge, { backgroundColor: colors.dangerLight }]}>
                  <UserX color={colors.error} size={18} strokeWidth={2.5} />
                </View>
                <View>
                  <Text style={[styles.settingText, { color: colors.error }]}>
                    {isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
                  </Text>
                  <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 11, color: colors.textSecondary }}>
                    Permanently delete your account & all data
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>

          {/* Official App Logo Badge */}
          <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 8, gap: 6 }}>
            <Image
              source={require('../../assets/images/icon_squared.png')}
              style={{ width: 60, height: 60, borderRadius: 16 }}
              resizeMode="cover"
            />
            <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 15, color: colors.text }}>EventFlow</Text>
          </View>

          <Text style={styles.versionText}>EventFlow v2.0 • Intelligent Event Management</Text>
        </ScrollView>

        <AlarmModal 
          visible={showTestAlarmModal}
          event={testAlarmEvent}
          onDismiss={() => setShowTestAlarmModal(false)}
          onStartTask={() => setShowTestAlarmModal(false)}
        />
      </SafeAreaView>
    </View>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bgGlow: {
    position: 'absolute',
    top: -50,
    right: -100,
    width: 300,
    height: 300,
    backgroundColor: colors.secondaryLight,
    opacity: 0.6,
    borderRadius: 150,
    transform: [{ scaleX: 1.5 }],
  },
  container: {
    flex: 1,
  },
  headerBox: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  header: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 26,
    color: colors.text,
  },
  headerSub: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  premiumCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 3,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  settingText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: colors.text,
  },
  versionText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 32,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: 16,
  },
});
