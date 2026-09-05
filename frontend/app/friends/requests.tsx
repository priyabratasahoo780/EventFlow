import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, FlatList, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import BrutalCard from '../../components/BrutalCard';
import api from '../../services/api';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, X, UserPlus, Inbox, MapPin } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function FriendRequestsScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const router = useRouter();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/friends/requests');
      setRequests(res.data || []);
    } catch (err) {
      console.log('[FriendRequests Notice]: Network sync deferred or offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAccept = async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActionInProgress(id);
    try {
      await api.post('/friends/accept', { requestId: id });
      setRequests(prev => prev.filter(req => req._id !== id));
      Alert.alert('Connected! 🎉', 'You are now friends and can collaborate on tasks!');
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.error || 'Could not accept friend request.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionInProgress(id);
    try {
      await api.post('/friends/reject', { requestId: id });
      setRequests(prev => prev.filter(req => req._id !== id));
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.error || 'Could not reject request.');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable 
          onPress={() => { 
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
            router.back(); 
          }} 
          style={styles.backBtn}
        >
          <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>FRIEND REQUESTS</Text>
          <Text style={styles.subtitle}>Manage your incoming invites</Text>
        </View>
      </View>
      
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.secondary} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Inbox color={colors.secondary} size={42} strokeWidth={2} />
          </View>
          <Text style={styles.emptyTitle}>You're all caught up!</Text>
          <Text style={styles.emptySub}>No pending friend requests at the moment.</Text>
          <Pressable 
            style={styles.findFriendsBtn} 
            onPress={() => { 
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
              router.push('/friends/connect'); 
            }}
          >
            <LinearGradient 
              colors={[colors.secondary, colors.secondary]} 
              style={styles.findFriendsBtnGrad}
            >
              <UserPlus color="#FFF" size={20} strokeWidth={2.5} />
              <Text style={styles.findFriendsBtnText}>FIND & ADD FRIENDS</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item, index) => (item._id ? `${item._id}-${index}` : `req-${index}`)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <BrutalCard shadowOffset={4} style={styles.card}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  {item.senderId?.profilePhoto ? (
                    <Image source={{ uri: item.senderId.profilePhoto }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarText}>
                      {item.senderId?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.senderId?.name}</Text>
                  <Text style={styles.username}>@{item.senderId?.username}</Text>
                  {item.senderId?.city ? (
                    <View style={styles.cityRow}>
                      <MapPin color={colors.textSecondary} size={12} strokeWidth={2} />
                      <Text style={styles.city}>{item.senderId.city}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable 
                  style={[styles.acceptBtn, actionInProgress === item._id && styles.disabledBtn]} 
                  onPress={() => handleAccept(item._id)}
                  disabled={actionInProgress === item._id}
                >
                  <LinearGradient 
                    colors={[colors.success, colors.success]} 
                    style={styles.actionBtnGrad}
                  >
                    <Check color="#FFF" size={18} strokeWidth={3} />
                    <Text style={styles.acceptText}>ACCEPT</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable 
                  style={[styles.rejectBtn, actionInProgress === item._id && styles.disabledBtn]} 
                  onPress={() => handleReject(item._id)}
                  disabled={actionInProgress === item._id}
                >
                  <X color={colors.textSecondary} size={18} strokeWidth={2.5} />
                  <Text style={styles.rejectText}>DECLINE</Text>
                </Pressable>
              </View>
            </BrutalCard>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    backgroundColor: colors.card, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border 
  },
  backBtn: { 
    width: 42, 
    height: 42, 
    borderRadius: 12, 
    backgroundColor: colors.surface, 
    borderWidth: 1, 
    borderColor: colors.border, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 14 
  },
  title: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 18, 
    color: colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: -2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: { 
    padding: 16, 
    gap: 14,
    paddingBottom: 40,
  },
  card: { 
    padding: 16, 
    backgroundColor: colors.card, 
    borderRadius: 18, 
    borderWidth: 1.5, 
    borderColor: colors.border, 
  },
  userInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 14, 
    marginBottom: 16 
  },
  avatar: { 
    width: 52, 
    height: 52, 
    borderRadius: 16, 
    backgroundColor: colors.secondaryLight, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 22, 
    color: colors.secondary 
  },
  name: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 16, 
    color: colors.text 
  },
  username: { 
    fontFamily: 'Poppins_600SemiBold', 
    fontSize: 13, 
    color: colors.textSecondary 
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  city: { 
    fontFamily: 'Poppins_500Medium', 
    fontSize: 12, 
    color: colors.textSecondary, 
  },
  actions: { 
    flexDirection: 'row', 
    gap: 10, 
    width: '100%' 
  },
  actionBtnGrad: { 
    width: '100%', 
    height: '100%', 
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'center', 
    borderRadius: 12,
    gap: 6,
  },
  acceptBtn: { 
    flex: 1.2, 
    height: 44, 
    borderRadius: 12, 
    overflow: 'hidden' 
  },
  acceptText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 13,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  rejectBtn: { 
    flex: 1, 
    height: 44, 
    borderRadius: 12, 
    backgroundColor: colors.surface, 
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 6,
  },
  rejectText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 32 
  },
  emptyIconCircle: { 
    width: 84, 
    height: 84, 
    borderRadius: 42, 
    backgroundColor: colors.secondaryLight, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  emptyTitle: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 20, 
    color: colors.text, 
    marginBottom: 6, 
    textAlign: 'center' 
  },
  emptySub: { 
    fontFamily: 'Poppins_500Medium', 
    fontSize: 13, 
    color: colors.textSecondary, 
    textAlign: 'center', 
    marginBottom: 28 
  },
  findFriendsBtn: { 
    width: '100%', 
    height: 52, 
    borderRadius: 14, 
    overflow: 'hidden',
  },
  findFriendsBtnGrad: { 
    width: '100%', 
    height: '100%', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8 
  },
  findFriendsBtnText: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 14, 
    color: '#FFF',
    letterSpacing: 0.5,
  }
});
