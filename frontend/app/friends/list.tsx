import { useEffect, useState, useMemo, useRef } from 'react';
import { 
  View, Text, StyleSheet, Pressable, Alert, FlatList, 
  TextInput, Image, Modal, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useThemeStore } from '../../store/useThemeStore';
import { useAuthStore } from '../../store/useAuthStore';
import { ColorTheme } from '../../constants/theme';
import { useResponsive } from '../../constants/responsive';
import api, { resolveMediaUrl } from '../../services/api';
import { socketService } from '../../services/socketService';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, Search, UserPlus, Users, Sparkles, 
  UserMinus, MessageSquare, Send, X, MapPin, Calendar,
  MoreVertical, ShieldCheck, HeartHandshake, ChevronRight
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
  const { getColors, isDark } = useThemeStore();
  const { containerStyle } = useResponsive();
  const colors = getColors();
  const isDarkMode = isDark();
  const styles = getStyles(colors, isDarkMode);
  const router = useRouter();

  const [friends, setFriends] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const chatScrollRef = useRef<any>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user: currentUser } = useAuthStore();

  const fetchFriends = async () => {
    try {
      const res = await api.get('/friends');
      const list = res.data || [];
      setFriends(list);
      if (list.length > 0) {
        socketService.emit(
          'check_online',
          list.map((f: any) => f._id),
          (statusMap: Record<string, boolean>) => {
            if (statusMap) setOnlineMap(statusMap);
          }
        );
      }
    } catch (err) {
      console.log('[FriendList Notice]: Network sync deferred or offline');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    socketService.connect();
    fetchFriends();

    const onUserStatus = ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineMap((prev) => ({ ...prev, [userId]: online }));
    };
    const onFriendAddedOrUpdated = () => {
      fetchFriends();
    };
    const onFriendRemoved = ({ friendId }: { friendId: string }) => {
      setFriends((prev) => prev.filter((f) => f._id !== friendId));
    };
    const onNewMessage = (msg: any) => {
      if (!msg) return;
      const activeFriendId = selectedFriend?._id;
      const senderId = String(msg.senderId?._id || msg.senderId || '');
      const receiverId = String(msg.receiverId?._id || msg.receiverId || '');
      if (activeFriendId && (senderId === activeFriendId || receiverId === activeFriendId)) {
        setFriendTyping(false);
        setChatMessages((prev) => {
          if (msg._id && prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 80);
      }
    };
    const onFriendTyping = ({ from }: { from: string }) => {
      if (selectedFriend?._id && from === selectedFriend._id) {
        setFriendTyping(true);
      }
    };
    const onFriendStopTyping = ({ from }: { from: string }) => {
      if (selectedFriend?._id && from === selectedFriend._id) {
        setFriendTyping(false);
      }
    };

    socketService.on('user_status', onUserStatus);
    socketService.on('friend_request_accepted', onFriendAddedOrUpdated);
    socketService.on('friend_list_updated', onFriendAddedOrUpdated);
    socketService.on('friend_removed', onFriendRemoved);
    socketService.on('new_message', onNewMessage);
    socketService.on('friend_typing', onFriendTyping);
    socketService.on('friend_stop_typing', onFriendStopTyping);

    return () => {
      socketService.off('user_status', onUserStatus);
      socketService.off('friend_request_accepted', onFriendAddedOrUpdated);
      socketService.off('friend_list_updated', onFriendAddedOrUpdated);
      socketService.off('friend_removed', onFriendRemoved);
      socketService.off('new_message', onNewMessage);
      socketService.off('friend_typing', onFriendTyping);
      socketService.off('friend_stop_typing', onFriendStopTyping);
    };
  }, [selectedFriend?._id]);

  const openChatModal = async (friend: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedFriend(friend);
    setFriendTyping(false);
    setShowMessageModal(true);
    setLoadingChat(true);
    try {
      const res = await api.get(`/friends/messages/${friend._id}`);
      setChatMessages(Array.isArray(res.data) ? res.data : []);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: false }), 80);
    } catch {
      setChatMessages([]);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFriends();
  };

  const handleRemove = async (friend: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.name} from your friends list?`,
      [
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
              Alert.alert('Error', 'Could not remove friend. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedFriend) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSendingMessage(true);
    socketService.emit('stop_typing', { to: selectedFriend._id });

    try {
      const res = await api.post('/friends/message', {
        receiverId: selectedFriend._id,
        text: messageText.trim(),
        type: 'message'
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (res.data?.data) {
        setChatMessages((prev) => [...prev, res.data.data]);
        setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 80);
      }
      setMessageText('');
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.error || 'Could not send message.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleTypingChange = (text: string) => {
    setMessageText(text);
    if (!selectedFriend?._id) return;
    socketService.emit('typing', { to: selectedFriend._id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketService.emit('stop_typing', { to: selectedFriend._id });
    }, 1500);
  };

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const q = searchQuery.toLowerCase().trim();
    return friends.filter(f => 
      f.name?.toLowerCase().includes(q) || 
      f.username?.toLowerCase().includes(q) ||
      f.city?.toLowerCase().includes(q)
    );
  }, [friends, searchQuery]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style={colors.text === '#FFFFFF' ? 'light' : 'dark'} />
        
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <Pressable 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }} 
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
          </Pressable>

          <View style={styles.headerTextContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>My Friends</Text>
              <View style={styles.countBadge}>
                <View style={styles.countBadgeDot} />
                <Text style={styles.countBadgeText}>{friends.length}</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>Collaborate and share productivity goals</Text>
          </View>

          <Pressable 
            style={({ pressed }) => [styles.addFriendHeaderBtn, pressed && { transform: [{ scale: 0.96 }] }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/friends/connect' as any);
            }}
          >
            <LinearGradient
              colors={[colors.secondary, '#E05500']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addFriendGrad}
            >
              <UserPlus color="#FFF" size={18} strokeWidth={2.5} />
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── SEARCH BAR ── */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search color={colors.textSecondary} size={18} strokeWidth={2.2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, username or city..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSearchQuery('');
                }} 
                hitSlop={8}
                style={styles.searchClearBtn}
              >
                <X color={colors.textSecondary} size={15} strokeWidth={2.5} />
              </Pressable>
            )}
          </View>
        </View>
        
        {/* ── FRIENDS LIST / EMPTY STATES ── */}
        {friends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <HeartHandshake color={colors.secondary} size={44} strokeWidth={2} />
            </View>
            <Text style={styles.emptyTitle}>No friends connected yet</Text>
            <Text style={styles.emptySub}>
              Share your unique ID or find colleagues to boost mutual focus and productivity!
            </Text>
            <Pressable 
              style={({ pressed }) => [styles.addBtn, pressed && { transform: [{ scale: 0.98 }] }]} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/friends/connect' as any);
              }}
            >
              <LinearGradient colors={[colors.secondary, '#E05500']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtnGrad}>
                <UserPlus color="#FFF" size={18} strokeWidth={2.5} />
                <Text style={styles.addBtnText}>ADD YOUR FIRST FRIEND</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : filteredFriends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Search color={colors.textSecondary} size={36} strokeWidth={2} />
            </View>
            <Text style={styles.emptyTitle}>No matching friends</Text>
            <Text style={styles.emptySub}>
              No friends found matching "{searchQuery}". Check the spelling or clear search.
            </Text>
            <Pressable 
              style={styles.clearSearchBtn}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearSearchText}>Clear Search Filter</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filteredFriends}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            keyExtractor={(item, index) => (item._id ? `${item._id}-${index}` : `friend-${index}`)}
            contentContainerStyle={[styles.list, containerStyle]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.friendCard}>
                {/* ── CARD TOP SECTION: AVATAR + DETAILS + DELETE ── */}
                <View style={styles.cardHeader}>
                  {/* Avatar */}
                  <View style={styles.avatarWrapper}>
                    {item.profilePhoto ? (
                      <Image source={{ uri: resolveMediaUrl(item.profilePhoto) }} style={styles.avatarImg} />
                    ) : (
                      <LinearGradient
                        colors={[colors.secondary, '#FF9500']}
                        style={styles.avatarGradient}
                      >
                        <Text style={styles.avatarText}>{item.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
                      </LinearGradient>
                    )}
                    <View style={[styles.onlineDot, { backgroundColor: onlineMap[item._id] ? '#10B981' : '#94A3B8' }]} />
                  </View>

                  {/* Name & Identity */}
                  <View style={styles.friendInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <ShieldCheck size={14} color={colors.secondary} strokeWidth={2.5} />
                    </View>

                    <Text style={styles.friendUsername} numberOfLines={1}>
                      @{item.username}
                    </Text>

                    {item.city ? (
                      <View style={styles.cityRow}>
                        <MapPin color={colors.textSecondary} size={11} strokeWidth={2} />
                        <Text style={styles.cityText} numberOfLines={1}>
                          {item.city}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Remove Friend Action */}
                  <Pressable 
                    style={({ pressed }) => [styles.removeFriendBtn, pressed && { opacity: 0.7 }]} 
                    onPress={() => handleRemove(item)}
                    hitSlop={10}
                  >
                    <UserMinus color={colors.error || '#EF4444'} size={17} strokeWidth={2.2} />
                  </Pressable>
                </View>

                {/* ── CARD BOTTOM SECTION: DEDICATED ACTION BUTTONS ── */}
                <View style={styles.cardActionsRow}>
                  {/* Cheer & Chat Button */}
                  <Pressable 
                    style={({ pressed }) => [styles.actionButton, styles.cheerActionBtn, pressed && { opacity: 0.85 }]} 
                    onPress={() => openChatModal(item)}
                  >
                    <MessageSquare color={colors.secondary} size={15} strokeWidth={2.4} />
                    <Text style={[styles.actionBtnText, { color: colors.secondary }]}>CHAT / CHEER</Text>
                  </Pressable>

                  {/* Schedule Button */}
                  <Pressable
                    style={({ pressed }) => [styles.actionButton, styles.scheduleActionBtn, pressed && { opacity: 0.85 }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push({ pathname: '/friends/groupSchedule' as any, params: { friendIds: item._id || item.id } });
                    }}
                  >
                    <Calendar color="#4B3FDC" size={15} strokeWidth={2.4} />
                    <Text style={[styles.actionBtnText, { color: '#4B3FDC' }]}>SCHEDULE</Text>
                  </Pressable>
                </View>
              </View>
            )}
          />
        )}

        {/* ── CHEER MODAL (BOTTOM SHEET) ── */}
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
            <Pressable style={styles.modalBackdrop} onPress={() => setShowMessageModal(false)} />
            
            <View style={[styles.modalCard, { maxHeight: '85%' }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Sparkles color={colors.secondary} size={20} strokeWidth={2.5} />
                  <View>
                    <Text style={styles.modalTitle}>CHAT • {selectedFriend?.name?.toUpperCase()}</Text>
                    <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: onlineMap[selectedFriend?._id] ? '#10B981' : colors.textSecondary }}>
                      {friendTyping ? 'typing...' : onlineMap[selectedFriend?._id] ? 'Online now' : 'Offline'}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => setShowMessageModal(false)} style={styles.closeBtn}>
                  <X color={colors.text} size={20} strokeWidth={2.5} />
                </Pressable>
              </View>

              {/* Real-Time Chat Thread */}
              <View style={{ height: 210, marginBottom: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 10 }}>
                {loadingChat ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={colors.secondary} />
                  </View>
                ) : chatMessages.length === 0 ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
                      No messages yet. Send a focus cheer or say hi! 👋
                    </Text>
                  </View>
                ) : (
                  <ScrollView ref={chatScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {chatMessages.map((msg, idx) => {
                      const isMe = String(msg.senderId?._id || msg.senderId) === String(currentUser?._id);
                      return (
                        <View
                          key={msg._id || idx}
                          style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '82%',
                            backgroundColor: isMe ? colors.secondary : colors.card,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 14,
                            borderWidth: isMe ? 0 : 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 13, color: isMe ? '#FFF' : colors.text }}>
                            {msg.text}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              <Text style={styles.quickLabel}>QUICK MOTIVATIONAL NUDGES</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nudgeScroll} contentContainerStyle={{ paddingRight: 10 }}>
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
                style={[styles.messageInput, { minHeight: 54 }]}
                placeholder="Write a message or focus cheer..."
                placeholderTextColor={colors.textSecondary}
                value={messageText}
                onChangeText={handleTypingChange}
                multiline
                numberOfLines={2}
              />

              <Pressable
                onPress={handleSendMessage}
                disabled={sendingMessage || !messageText.trim()}
                style={({ pressed }) => [
                  styles.sendBtn,
                  (!messageText.trim() || sendingMessage) && { opacity: 0.5 },
                  pressed && { transform: [{ scale: 0.98 }] }
                ]}
              >
                <LinearGradient
                  colors={[colors.secondary, '#E05500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sendBtnGradient}
                >
                  <Send color="#FFF" size={17} strokeWidth={2.5} />
                  <Text style={styles.sendBtnText}>
                    {sendingMessage ? 'SENDING...' : 'SEND MESSAGE'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const getStyles = (colors: ColorTheme, isDarkMode: boolean) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: isDarkMode ? '#0A0A16' : '#FAF8F5',
  },
  container: { 
    flex: 1, 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingTop: 10,
    paddingBottom: 14, 
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { 
    width: 42, 
    height: 42, 
    backgroundColor: colors.card, 
    borderRadius: 14, 
    borderWidth: 1.2,
    borderColor: colors.border,
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { 
    fontFamily: 'Poppins_700Bold', 
    fontSize: 20, 
    color: colors.text,
    letterSpacing: 0.2,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.secondary + '40',
  },
  countBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.secondary,
  },
  countBadgeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: colors.secondary,
  },
  subtitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  addFriendHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  addFriendGrad: {
    flex: 1,
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
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: colors.text,
    marginLeft: 10,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 6,
  },
  list: { 
    paddingHorizontal: 16, 
    paddingBottom: 40,
    gap: 14,
  },

  // ── Modern Spacious Friend Card ──
  friendCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImg: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  avatarGradient: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 20,
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: colors.card,
  },
  friendInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  friendName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15.5,
    color: colors.text,
    letterSpacing: -0.2,
  },
  friendUsername: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  cityText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
  },
  removeFriendBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Two Dedicated Action Buttons ──
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  cheerActionBtn: {
    backgroundColor: isDarkMode ? 'rgba(255, 122, 0, 0.12)' : 'rgba(255, 122, 0, 0.08)',
    borderColor: isDarkMode ? 'rgba(255, 122, 0, 0.3)' : 'rgba(255, 122, 0, 0.22)',
  },
  scheduleActionBtn: {
    backgroundColor: isDarkMode ? 'rgba(75, 63, 220, 0.12)' : 'rgba(75, 63, 220, 0.07)',
    borderColor: isDarkMode ? 'rgba(75, 63, 220, 0.3)' : 'rgba(75, 63, 220, 0.2)',
  },
  actionBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    letterSpacing: 0.8,
  },

  // ── Empty States ──
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 32,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  emptyTitle: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 20, 
    color: colors.text, 
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: { 
    fontFamily: 'Poppins_500Medium', 
    fontSize: 13, 
    color: colors.textSecondary, 
    textAlign: 'center', 
    marginBottom: 24,
    lineHeight: 20,
  },
  addBtn: { 
    width: '100%',
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  addBtnGrad: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  addBtnText: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 14, 
    color: '#FFF',
    letterSpacing: 0.5,
  },
  clearSearchBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearSearchText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: colors.secondary,
  },

  // ── Cheer Modal Sheet ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
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
    fontSize: 15,
    color: colors.text,
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  quickLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10.5,
    color: colors.textSecondary,
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  nudgeScroll: {
    marginBottom: 14,
  },
  nudgeChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
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
    borderRadius: 14,
    padding: 14,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13.5,
    color: colors.text,
    minHeight: 85,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  sendBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  sendBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 15,
  },
  sendBtnText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 14,
    color: '#FFF',
    letterSpacing: 0.8,
  },
});
