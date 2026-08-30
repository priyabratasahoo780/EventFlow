import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import React, { useState } from 'react';
import { 
  View, Text, TextInput, StyleSheet, Alert, Pressable, 
  ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrutalButton from '../../components/BrutalButton';
import BrutalCard from '../../components/BrutalCard';
import { Colors } from '../../constants/Colors';
import api from '../../services/api';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, Search, CheckCircle2, Clock, 
  Inbox, Send, MessageSquare, Sparkles, X, Heart 
} from 'lucide-react-native';

const QUICK_NUDGES = [
  "🚀 Let's crush today's tasks together!",
  "⚡ Time to focus and lock in!",
  "🎯 How's your current sprint going?",
  "☕ Don't forget to take a breather!",
  "🔥 Keep the momentum going!"
];

export default function ConnectFriendScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const s = styles;
  const [uniqueId, setUniqueId] = useState('');
  const [friend, setFriend] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const router = useRouter();

  const handleSearch = async () => {
    if (!uniqueId.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearching(true);

    try {
      const res = await api.post('/friends/search', { uniqueId: uniqueId.trim() });
      setFriend(res.data);
    } catch (err: any) {
      setFriend(null);
      Alert.alert('Not Found', err.response?.data?.error || 'User not found with this Unique ID.');
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
      Alert.alert('Request Sent', `Friend request sent to ${friend.name}!`);
      setFriend({
        ...friend,
        relationshipStatus: 'request_sent'
      });
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.error || 'Could not send request.');
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
      Alert.alert('Sent! ✨', `Message delivered to ${friend.name}!`);
      setMessageText('');
      setShowMessageModal(false);
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.error || 'Could not send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#000" size={26} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.title}>ADD FRIEND</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.label}>ENTER UNIQUE ID</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={uniqueId}
            onChangeText={setUniqueId}
            placeholder="e.g. FF#7aK$9x"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleSearch}
          />
          <Pressable style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
            {searching ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Search color="#FFF" size={22} strokeWidth={2.5} />
            )}
          </Pressable>
        </View>

        {friend && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>USER FOUND</Text>
            <BrutalCard shadowOffset={4} style={styles.friendCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{friend.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
              </View>
              <Text style={styles.friendName}>{friend.name}</Text>
              <Text style={styles.friendUsername}>@{friend.username}</Text>
              {friend.city ? <Text style={styles.friendCity}>📍 {friend.city}</Text> : null}
              
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
                  <Inbox color="#4F46E5" size={16} strokeWidth={2.5} />
                  <Text style={styles.inboxText}>SENT YOU A FRIEND REQUEST</Text>
                </View>
              ) : null}

              {/* Action Button */}
              <View style={styles.mt20}>
                {friend.isAlreadyFriend || friend.relationshipStatus === 'already_friends' ? (
                  <BrutalButton 
                    title="SEND MESSAGE / NUDGE" 
                    color={Colors.light.primary} 
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowMessageModal(true);
                    }} 
                  >
                    <MessageSquare color="#000" size={18} strokeWidth={2.5} />
                  </BrutalButton>
                ) : friend.relationshipStatus === 'request_sent' ? (
                  <Pressable style={styles.disabledPendingBtn} disabled>
                    <Clock color="#B45309" size={18} strokeWidth={2.5} />
                    <Text style={styles.disabledPendingText}>REQUEST SENT</Text>
                  </Pressable>
                ) : friend.relationshipStatus === 'request_received' ? (
                  <BrutalButton 
                    title="VIEW & ACCEPT REQUEST" 
                    color="#6366F1" 
                    onPress={() => router.push('/friends/requests' as any)} 
                  />
                ) : (
                  <BrutalButton 
                    title={sending ? "SENDING..." : "SEND REQUEST"} 
                    color={Colors.light.success} 
                    onPress={sendRequest} 
                  />
                )}
              </View>
            </BrutalCard>
          </View>
        )}
      </View>

      {/* Interactive Message / Cheer Modal */}
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
                <MessageSquare color="#6366F1" size={22} strokeWidth={2.5} />
                <Text style={styles.modalTitle}>MESSAGE {friend?.name?.toUpperCase()}</Text>
              </View>
              <Pressable onPress={() => setShowMessageModal(false)} style={styles.closeBtn}>
                <X color="#000" size={20} strokeWidth={2.5} />
              </Pressable>
            </View>

            <Text style={styles.quickLabel}>QUICK FOCUS CHEERS</Text>
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
              placeholder="Write a motivating note or ask about their tasks..."
              placeholderTextColor="#94A3B8"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              numberOfLines={3}
            />

            <BrutalButton 
              title={sendingMessage ? "SENDING..." : "SEND TO FRIEND"} 
              color={Colors.light.primary} 
              onPress={handleSendMessage} 
              disabled={sendingMessage || !messageText.trim()}
            >
              <Send color="#000" size={18} strokeWidth={2.5} />
            </BrutalButton>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 3, 
    borderBottomColor: '#000', 
    backgroundColor: Colors.light.primary 
  },
  backBtn: { 
    width: 44, 
    height: 44, 
    backgroundColor: '#FFF', 
    borderRadius: 22, 
    borderWidth: 2, 
    borderColor: '#000', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 14 
  },
  title: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 22, 
    color: '#000',
    letterSpacing: 0.5,
  },
  content: { padding: 20 },
  label: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 13, 
    color: '#000', 
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  searchRow: { 
    flexDirection: 'row', 
    gap: 10, 
    marginBottom: 20 
  },
  input: { 
    flex: 1, 
    backgroundColor: '#FFF', 
    borderWidth: 2, 
    borderColor: '#000', 
    borderRadius: 10, 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 16, 
    color: '#000' 
  },
  searchBtn: { 
    width: 54, 
    backgroundColor: '#000', 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  resultContainer: { marginTop: 8 },
  resultTitle: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 14, 
    color: '#000', 
    marginBottom: 12, 
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  friendCard: { 
    padding: 24, 
    alignItems: 'center', 
    backgroundColor: '#FFF' 
  },
  avatar: { 
    width: 76, 
    height: 76, 
    borderRadius: 26, 
    backgroundColor: Colors.light.accent, 
    borderWidth: 2.5, 
    borderColor: '#000', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 12 
  },
  avatarText: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 34, 
    color: '#000' 
  },
  friendName: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 20, 
    color: '#000' 
  },
  friendUsername: { 
    fontFamily: 'Poppins_600SemiBold', 
    fontSize: 13, 
    color: '#64748B',
    marginTop: 1,
  },
  friendCity: { 
    fontFamily: 'Poppins_600SemiBold', 
    fontSize: 13, 
    color: '#334155', 
    marginTop: 6 
  },
  alreadyFriendsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successLight,
    borderWidth: 1.5,
    borderColor: colors.success,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 12,
  },
  alreadyFriendsText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 11,
    color: '#15803D',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#D97706',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 12,
  },
  pendingText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 11,
    color: '#B45309',
  },
  inboxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 12,
  },
  inboxText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 11,
    color: '#4338CA',
  },
  mt20: { 
    marginTop: 20, 
    width: '100%' 
  },
  disabledPendingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#D97706',
    borderRadius: 10,
    paddingVertical: 14,
    width: '100%',
  },
  disabledPendingText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 14,
    color: '#B45309',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 32,
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#000',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 14,
    color: '#000',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  quickLabel: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  nudgeScroll: {
    marginBottom: 14,
  },
  nudgeChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  nudgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: '#000',
  },
  messageInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    padding: 14,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#000',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
});
