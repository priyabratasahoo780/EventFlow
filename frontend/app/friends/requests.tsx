import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrutalCard from '../../components/BrutalCard';
import { Colors } from '../../constants/Colors';
import api from '../../services/api';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, X, UserPlus, Inbox } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function FriendRequestsScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const s = styles;
  const [requests, setRequests] = useState<any[]>([]);
  const router = useRouter();

  const fetchRequests = async () => {
    try {
      const res = await api.get('/friends/requests');
      setRequests(res.data || []);
    } catch (err) {
      console.log('[FriendRequests Notice]: Network sync deferred or offline');
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAccept = async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await api.post('/friends/accept', { requestId: id });
      setRequests(requests.filter(req => req._id !== id));
      Alert.alert('Accepted', 'You are now friends!');
    } catch (err) {
      Alert.alert('Error', 'Could not accept request');
    }
  };

  const handleReject = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post('/friends/reject', { requestId: id });
      setRequests(requests.filter(req => req._id !== id));
    } catch (err) {
      Alert.alert('Error', 'Could not reject request');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={styles.backBtn}>
          <ArrowLeft color={colors.text} size={24} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.title}>Friend Requests</Text>
      </View>
      
      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Inbox color={colors.secondary} size={40} strokeWidth={2} />
          </View>
          <Text style={styles.emptyTitle}>You're all caught up!</Text>
          <Text style={styles.emptySub}>No pending friend requests at the moment.</Text>
          <Pressable style={styles.findFriendsBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/friends/connect'); }}>
            <LinearGradient colors={[colors.secondary, colors.secondary]} style={styles.findFriendsBtnGrad}>
              <UserPlus color="#FFF" size={20} strokeWidth={2.5} />
              <Text style={styles.findFriendsBtnText}>FIND FRIENDS</Text>
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
                  <Text style={styles.avatarText}>{item.senderId.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.senderId.name}</Text>
                  <Text style={styles.username}>@{item.senderId.username}</Text>
                  {item.senderId.city ? <Text style={styles.city}>{item.senderId.city}</Text> : null}
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable style={styles.acceptBtn} onPress={() => handleAccept(item._id)}>
                  <LinearGradient colors={[colors.success, colors.success]} style={styles.actionBtnGrad}>
                    <Check color="#FFF" size={20} strokeWidth={3} />
                  </LinearGradient>
                </Pressable>
                <Pressable style={styles.rejectBtn} onPress={() => handleReject(item._id)}>
                  <X color={colors.textSecondary} size={20} strokeWidth={3} />
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: colors.text },
  list: { padding: 16, gap: 16 },
  card: { padding: 16, flexDirection: 'column', backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, shadowColor: colors.text, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.secondaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Poppins_700Bold', fontSize: 22, color: colors.secondary },
  name: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: colors.text },
  username: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: colors.textSecondary },
  city: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 12, width: '100%' },
  actionBtnGrad: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  acceptBtn: { flex: 1, height: 46, borderRadius: 12, overflow: 'hidden' },
  rejectBtn: { flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.secondaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: colors.text, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 32 },
  findFriendsBtn: { width: '100%', height: 56, borderRadius: 16, overflow: 'hidden', shadowColor: colors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  findFriendsBtnGrad: { width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  findFriendsBtnText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: colors.card }
});
