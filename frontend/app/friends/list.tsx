import { useEffect, useState, useMemo } from 'react';
import { 
  View, Text, StyleSheet, Pressable, Alert, FlatList, 
  TextInput, Image, Modal, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import BrutalButton from '../../components/BrutalButton';
import BrutalCard from '../../components/BrutalCard';
import api from '../../services/api';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, Search, UserPlus, Users, Sparkles, 
  UserMinus, MessageSquare, Send, X, MapPin 
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const QUICK_NUDGES = [
  "🚀 Let's crush today's tasks together!",
  "⚡ Time to focus and lock in!",
  "🎯 How's your current sprint going?",
  "☕ Don't forget to take a breather!",
  "🔥 Keep the momentum going!",
  "🏆 Great job staying productive today!"
];

export default function FriendListScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const router = useRouter();

  const [friends, setFriends] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const fetchFriends = async () => {
    try {
      const res = await api.get('/friends');
      setFriends(res.data || []);
    } catch (err) {
      console.log('[FriendList Notice]: Network sync deferred or offline');
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const handleRemove = async (friend: any) => {
    Alert.alert('Remove Friend', `Are you sure you want to remove ${friend.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Remove', 
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          try {
            await api.delete('/friends/remove', { data: { friendId: friend._id } });
            setFriends(prev => prev.filter(f => f._id !== friend._id));
          } catch (err) {
            Alert.alert('Error', 'Could not remove friend');
          }
        }
      }
    ]);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedFriend) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSendingMessage(true);

    try {
      await api.post('/friends/message', {
        receiverId: selectedFriend._id,
        text: messageText.trim(),
        type: 'message'
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Delivered! ✨', `Cheer sent to ${selectedFriend.name}!`);
      setMessageText('');
      setShowMessageModal(false);
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.error || 'Could not send message.');
    } finally {
      setSendingMessage(false);
    }
  };

  const filteredFriends = useMemo(() => {
    if (!searchQuery) return friends;
    return friends.filter(f => 
      f.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      f.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [friends, searchQuery]);

  return (
    <View style={styles.root}>
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

          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>MY FRIENDS ({friends.length})</Text>
            <Text style={styles.subtitle}>Collaborate and share productivity goals</Text>
          </View>

          <Pressable 
            style={styles.addFriendHeaderBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/friends/connect' as any);
            }}
          >
            <UserPlus color="#FFF" size={18} strokeWidth={2.5} />
          </Pressable>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search color={colors.textSecondary} size={18} strokeWidth={2.2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or username..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <X color={colors.textSecondary} size={16} strokeWidth={2.5} />
              </Pressable>
            )}
          </View>
        </View>
        
        {/* FRIENDS LIST */}
        {friends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Users color={colors.secondary} size={40} strokeWidth={2} />
            </View>
            <Text style={styles.emptyTitle}>No friends connected yet</Text>
            <Text style={styles.emptySub}>Share your Unique ID or search for friends to stay accountable together!</Text>
            <Pressable 
              style={styles.addBtn} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/friends/connect' as any);
              }}
            >
              <LinearGradient colors={[colors.secondary, colors.secondary]} style={styles.addBtnGrad}>
                <UserPlus color="#FFF" size={18} strokeWidth={2.5} />
                <Text style={styles.addBtnText}>ADD YOUR FIRST FRIEND</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filteredFriends}
            keyExtractor={(item, index) => (item._id ? `${item._id}-${index}` : `friend-${index}`)}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <BrutalCard shadowOffset={3} style={styles.card}>
                <View style={styles.userInfo}>
                  <View style={styles.avatar}>
                    {item.profilePhoto ? (
                      <Image source={{ uri: item.profilePhoto }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarText}>{item.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.username}>@{item.username}</Text>
                    {item.city ? (
                      <View style={styles.cityRow}>
                        <MapPin color={colors.textSecondary} size={11} strokeWidth={2} />
                        <Text style={styles.city}>{item.city}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Card Actions */}
                <View style={styles.cardActionRow}>
                  <Pressable 
                    style={styles.cheerBtn} 
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setSelectedFriend(item);
                      setShowMessageModal(true);
                    }}
                  >
                    <MessageSquare color={colors.secondary} size={16} strokeWidth={2.2} />
                    <Text style={styles.cheerBtnText}>CHEER</Text>
                  </Pressable>

                  <Pressable 
                    style={styles.removeBtn} 
                    onPress={() => handleRemove(item)}
                    hitSlop={8}
                  >
                    <UserMinus color={colors.error || '#EF4444'} size={18} strokeWidth={2.2} />
                  </Pressable>
                </View>
              </BrutalCard>
            )}
          />
        )}

        {/* CHEER MODAL */}
        <Modal
          visible={showMessageModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowMessageModal(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={styles.modalOverlay}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Sparkles color={colors.secondary} size={22} strokeWidth={2.5} />
                  <Text style={styles.modalTitle}>CHEER {selectedFriend?.name?.toUpperCase()}</Text>
                </View>
                <Pressable onPress={() => setShowMessageModal(false)} style={styles.closeBtn}>
                  <X color={colors.text} size={20} strokeWidth={2.5} />
                </Pressable>
              </View>

              <Text style={styles.quickLabel}>SELECT A MOTIVATION NUDGE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nudgeScroll}>
                {QUICK_NUDGES.map((nudge, idx) => (
                  <Pressable 
                    key={idx} 
                    style={styles.nudgeChip}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setMessageText(nudge);
                    }}
                  >
                    <Text style={styles.nudgeText}>{nudge}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <TextInput
                style={styles.messageInput}
                placeholder="Write a cheer or note..."
                placeholderTextColor={colors.textSecondary}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                numberOfLines={3}
              />

              <BrutalButton 
                title={sendingMessage ? "SENDING..." : "SEND FOCUS CHEER"} 
                color={colors.secondary} 
                onPress={handleSendMessage} 
                disabled={sendingMessage || !messageText.trim()}
              >
                <Send color="#FFF" size={18} strokeWidth={2.5} />
              </BrutalButton>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: { 
    flex: 1, 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { 
    width: 42, 
    height: 42, 
    backgroundColor: colors.surface, 
    borderRadius: 12, 
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
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
  addFriendHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: colors.text,
    marginLeft: 10,
  },
  list: { 
    paddingHorizontal: 16, 
    paddingBottom: 40,
    gap: 12,
  },
  card: { 
    padding: 14, 
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
    flex: 1,
  },
  avatar: { 
    width: 48, 
    height: 48, 
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
    fontSize: 20, 
    color: colors.secondary,
  },
  name: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 15, 
    color: colors.text,
  },
  username: { 
    fontFamily: 'Poppins_500Medium', 
    fontSize: 12, 
    color: colors.textSecondary,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  city: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cheerBtn: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7, 
    borderRadius: 10, 
    backgroundColor: colors.secondaryLight, 
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  cheerBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: colors.secondary,
  },
  removeBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 10, 
    backgroundColor: colors.surface, 
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  emptyTitle: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 19, 
    color: colors.text, 
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  addBtn: { 
    width: '100%',
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
  },
  addBtnGrad: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnText: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 14, 
    color: '#FFF',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 32,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 20,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 14,
    color: colors.text,
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  quickLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  nudgeScroll: {
    marginBottom: 14,
  },
  nudgeChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  nudgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: colors.text,
  },
  messageInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
});
