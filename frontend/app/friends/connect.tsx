import { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, StyleSheet, Alert, Pressable, 
  ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView, Share, Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import BrutalButton from '../../components/BrutalButton';
import BrutalCard from '../../components/BrutalCard';
import api from '../../services/api';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, ArrowRight, Search, CheckCircle2, Clock, 
  Inbox, Send, MessageSquare, Sparkles, X, 
  Copy, Share2, Users, UserPlus, ClipboardPaste, 
  ShieldCheck, MapPin, Zap, Check
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

export default function ConnectFriendScreen() {
  const { user } = useAuthStore();
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [friend, setFriend] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [copiedId, setCopiedId] = useState(false);

  // Message / Cheer modal states
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Fetch pending friend requests count on mount
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const res = await api.get('/friends/requests');
        if (res.data && Array.isArray(res.data)) {
          setPendingRequestsCount(res.data.length);
        }
      } catch (e) {
        // Silent catch for offline or non-blocking UI
      }
    };
    fetchPendingCount();
  }, []);

  const handleCopyMyId = async () => {
    if (!user?.uniqueId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(user.uniqueId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleShareMyId = async () => {
    if (!user?.uniqueId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        title: 'Connect on EventFlow',
        message: `Add me on EventFlow using my Unique ID: ${user.uniqueId} 🚀`,
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  const handlePaste = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      if (clipboardContent && clipboardContent.trim()) {
        setQuery(clipboardContent.trim());
      }
    } catch (e) {
      console.log('Paste error:', e);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearching(true);
    setFriend(null);

    try {
      const res = await api.post('/friends/search', { uniqueId: query.trim() });
      setFriend(res.data);
    } catch (err: any) {
      setFriend(null);
      Alert.alert(
        'User Not Found',
        err.response?.data?.error || 'No user found with this Unique ID, username, or email.'
      );
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async () => {
    if (!friend) return;

    if (friend.isAlreadyFriend || friend.relationshipStatus === 'already_friends') {
      setShowMessageModal(true);
      return;
    }

    if (friend.relationshipStatus === 'request_sent') {
      Alert.alert('Pending Request', `You have already sent a friend request to ${friend.name}.`);
      return;
    }

    if (friend.relationshipStatus === 'request_received') {
      router.push('/friends/requests' as any);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSending(true);

    try {
      await api.post('/friends/request', { receiverId: friend._id });
      Alert.alert('Request Sent ✨', `Friend request sent to ${friend.name}!`);
      setFriend({
        ...friend,
        relationshipStatus: 'request_sent'
      });
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.error || 'Could not send friend request.');
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !friend) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSendingMessage(true);

    try {
      await api.post('/friends/message', {
        receiverId: friend._id,
        text: messageText.trim(),
        type: 'message'
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Delivered! ✨', `Cheer delivered to ${friend.name}!`);
      setMessageText('');
      setShowMessageModal(false);
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.error || 'Could not send message.');
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={colors.text === '#FFFFFF' ? 'light' : 'dark'} />
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

        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>Add Friends</Text>
          <Text style={styles.subtitle}>Connect & collaborate on shared tasks</Text>
        </View>

        {/* Quick Requests Link */}
        <Pressable 
          style={styles.requestsBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/friends/requests' as any);
          }}
        >
          <Inbox color={colors.secondary} size={20} strokeWidth={2.2} />
          {pendingRequestsCount > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeText}>{pendingRequestsCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* HERO: MY SHAREABLE ID CARD */}
        {user?.uniqueId && (
          <View style={styles.myIdSection}>
            <LinearGradient
              colors={[colors.card, colors.surface]}
              style={styles.myIdCard}
            >
              <View style={styles.myIdHeader}>
                <View style={styles.myAvatar}>
                  {user.profilePhoto ? (
                    <Image source={{ uri: user.profilePhoto }} style={styles.myAvatarImg} />
                  ) : (
                    <Text style={styles.myAvatarText}>
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myIdLabel}>YOUR SHAREABLE FRIEND CODE</Text>
                  <Text style={styles.myIdValue} numberOfLines={1} selectable>
                    {user.uniqueId}
                  </Text>
                </View>
              </View>

              <View style={styles.myIdActionsRow}>
                <Pressable 
                  style={[styles.idActionBtn, copiedId && styles.idActionBtnActive]} 
                  onPress={handleCopyMyId}
                >
                  {copiedId ? (
                    <>
                      <Check color={colors.success} size={16} strokeWidth={2.5} />
                      <Text style={[styles.idActionText, { color: colors.success }]}>COPIED!</Text>
                    </>
                  ) : (
                    <>
                      <Copy color={colors.text} size={16} strokeWidth={2.2} />
                      <Text style={styles.idActionText}>COPY ID</Text>
                    </>
                  )}
                </Pressable>

                <Pressable style={styles.idActionBtn} onPress={handleShareMyId}>
                  <Share2 color={colors.secondary} size={16} strokeWidth={2.2} />
                  <Text style={[styles.idActionText, { color: colors.secondary }]}>SHARE INVITE</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* SEARCH INPUT BOX */}
        <View style={styles.searchSection}>
          <Text style={styles.sectionLabel}>FIND FRIEND BY ID, USERNAME, OR EMAIL</Text>

          <View style={styles.searchBox}>
            <Search color={colors.textSecondary} size={20} strokeWidth={2.2} style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Friend ID, @username, or email"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />

            {query.length > 0 ? (
              <Pressable 
                onPress={() => setQuery('')} 
                style={styles.clearBtn}
                hitSlop={8}
              >
                <X color={colors.textSecondary} size={18} strokeWidth={2.5} />
              </Pressable>
            ) : (
              <Pressable 
                onPress={handlePaste} 
                style={styles.pasteBtn}
              >
                <ClipboardPaste color={colors.secondary} size={16} strokeWidth={2.2} />
                <Text style={styles.pasteText}>PASTE</Text>
              </Pressable>
            )}

            <Pressable 
              style={[styles.searchBtn, searching && styles.searchBtnDisabled]} 
              onPress={handleSearch} 
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <ArrowRight color="#FFF" size={20} strokeWidth={2.5} />
              )}
            </Pressable>
          </View>
        </View>

        {/* SEARCH RESULT USER CARD */}
        {friend && (
          <View style={styles.resultContainer}>
            <Text style={styles.sectionLabel}>SEARCH RESULT</Text>
            
            <BrutalCard shadowOffset={4} style={styles.friendCard}>
              <View style={styles.avatarContainer}>
                {friend.profilePhoto ? (
                  <Image source={{ uri: friend.profilePhoto }} style={styles.userPhoto} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>
                      {friend.name?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
                <View style={styles.onlinePill}>
                  <Zap color="#FFF" size={10} strokeWidth={3} />
                </View>
              </View>

              <Text style={styles.friendName}>{friend.name}</Text>
              <Text style={styles.friendUsername}>@{friend.username}</Text>
              
              {friend.city ? (
                <View style={styles.cityRow}>
                  <MapPin color={colors.textSecondary} size={13} strokeWidth={2} />
                  <Text style={styles.friendCity}>{friend.city}</Text>
                </View>
              ) : null}

              {/* Status Badges */}
              {friend.isAlreadyFriend || friend.relationshipStatus === 'already_friends' ? (
                <View style={styles.alreadyFriendsBadge}>
                  <CheckCircle2 color={colors.success} size={16} strokeWidth={2.5} />
                  <Text style={styles.alreadyFriendsText}>ALREADY CONNECTED AS FRIENDS</Text>
                </View>
              ) : friend.relationshipStatus === 'request_sent' ? (
                <View style={styles.pendingBadge}>
                  <Clock color="#D97706" size={16} strokeWidth={2.5} />
                  <Text style={styles.pendingText}>FRIEND REQUEST PENDING</Text>
                </View>
              ) : friend.relationshipStatus === 'request_received' ? (
                <View style={styles.inboxBadge}>
                  <Inbox color={colors.secondary} size={16} strokeWidth={2.5} />
                  <Text style={styles.inboxText}>SENT YOU A FRIEND REQUEST</Text>
                </View>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.cardActionsWrap}>
                {friend.isAlreadyFriend || friend.relationshipStatus === 'already_friends' ? (
                  <BrutalButton 
                    title="SEND FOCUS CHEER" 
                    color={colors.secondary} 
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowMessageModal(true);
                    }} 
                  >
                    <MessageSquare color="#FFF" size={18} strokeWidth={2.5} />
                  </BrutalButton>
                ) : friend.relationshipStatus === 'request_sent' ? (
                  <View style={styles.disabledPendingBtn}>
                    <Clock color="#B45309" size={18} strokeWidth={2.5} />
                    <Text style={styles.disabledPendingText}>REQUEST SENT (AWAITING)</Text>
                  </View>
                ) : friend.relationshipStatus === 'request_received' ? (
                  <BrutalButton 
                    title="VIEW & ACCEPT REQUEST" 
                    color={colors.secondary} 
                    onPress={() => router.push('/friends/requests' as any)} 
                  >
                    <ShieldCheck color="#FFF" size={18} strokeWidth={2.5} />
                  </BrutalButton>
                ) : (
                  <BrutalButton 
                    title={sending ? "SENDING REQUEST..." : "SEND FRIEND REQUEST"} 
                    color={colors.success} 
                    onPress={sendRequest} 
                    disabled={sending}
                  >
                    <UserPlus color="#FFF" size={18} strokeWidth={2.5} />
                  </BrutalButton>
                )}
              </View>
            </BrutalCard>
          </View>
        )}

        {/* QUICK NAVIGATION SHORTCUTS */}
        <View style={styles.quickNavSection}>
          <Text style={styles.sectionLabel}>QUICK SHORTCUTS</Text>
          <View style={styles.shortcutsRow}>
            <Pressable 
              style={styles.shortcutCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/friends/list' as any);
              }}
            >
              <View style={[styles.shortcutIconCircle, { backgroundColor: colors.secondaryLight }]}>
                <Users color={colors.secondary} size={22} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shortcutTitle}>My Friends</Text>
                <Text style={styles.shortcutDesc}>View and manage your friend connections</Text>
              </View>
            </Pressable>

            <Pressable 
              style={styles.shortcutCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/friends/requests' as any);
              }}
            >
              <View style={[styles.shortcutIconCircle, { backgroundColor: colors.primaryLight || '#EEF2FF' }]}>
                <Inbox color={colors.primary} size={22} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shortcutTitle}>Pending Requests</Text>
                <Text style={styles.shortcutDesc}>Accept or decline incoming invites</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* INTERACTIVE FOCUS CHEER / MESSAGE MODAL */}
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
                <Text style={styles.modalTitle}>CHEER {friend?.name?.toUpperCase()}</Text>
              </View>
              <Pressable onPress={() => setShowMessageModal(false)} style={styles.closeBtn}>
                <X color={colors.text} size={20} strokeWidth={2.5} />
              </Pressable>
            </View>

            <Text style={styles.quickLabel}>PICK A QUICK MOTIVATION NUDGE</Text>
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
              placeholder="Write a motivating note or encourage them on their sprint..."
              placeholderTextColor={colors.textSecondary}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              numberOfLines={3}
            />

            <BrutalButton 
              title={sendingMessage ? "SENDING CHEER..." : "SEND FOCUS CHEER"} 
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
    paddingTop: 10,
    paddingBottom: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border, 
    backgroundColor: colors.background,
    gap: 12,
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
  headerTitleWrap: {
    flex: 1,
  },
  title: { 
    fontFamily: 'Poppins_700Bold', 
    fontSize: 20, 
    color: colors.text,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  requestsBtn: {
    width: 42,
    height: 42,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  badgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error || '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  badgeText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 10,
    color: '#FFF',
  },
  scroll: {
    flex: 1,
  },
  content: { 
    padding: 16,
    paddingBottom: 40,
    gap: 20,
  },
  myIdSection: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  myIdCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  myIdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  myAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  myAvatarImg: {
    width: '100%',
    height: '100%',
  },
  myAvatarText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 20,
    color: colors.secondary,
  },
  myIdLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  myIdValue: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 18,
    color: colors.text,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  myIdActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  idActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  idActionBtnActive: {
    backgroundColor: colors.successLight || '#DCFCE7',
    borderColor: colors.success,
  },
  idActionText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    color: colors.text,
  },
  searchSection: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginLeft: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 6,
    height: 54,
    shadowColor: colors.text,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: colors.text,
    height: '100%',
  },
  clearBtn: {
    padding: 6,
    marginRight: 4,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6,
  },
  pasteText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    color: colors.secondary,
  },
  searchBtn: {
    width: 42,
    height: 42,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnDisabled: {
    opacity: 0.7,
  },
  resultContainer: {
    gap: 8,
  },
  friendCard: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  userPhoto: {
    width: 76,
    height: 76,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.secondaryLight,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 32,
    color: colors.secondary,
  },
  onlinePill: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.success,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  friendName: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 19,
    color: colors.text,
  },
  friendUsername: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  friendCity: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  alreadyFriendsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successLight || '#DCFCE7',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 12,
  },
  alreadyFriendsText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: colors.success,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#D97706',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 12,
  },
  pendingText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: '#B45309',
  },
  inboxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.secondaryLight,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 12,
  },
  inboxText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: colors.secondary,
  },
  cardActionsWrap: {
    marginTop: 18,
    width: '100%',
  },
  disabledPendingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#D97706',
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
  },
  disabledPendingText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: '#B45309',
  },
  quickNavSection: {
    gap: 10,
    marginTop: 10,
  },
  shortcutsRow: {
    gap: 12,
  },
  shortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  shortcutDesc: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
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
