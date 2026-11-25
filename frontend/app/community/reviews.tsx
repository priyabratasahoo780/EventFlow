import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, Pressable, Modal, TextInput, ActivityIndicator, Image, ToastAndroid, Platform, Alert, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import api from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import { ArrowLeft, Star, MessageCircle, Send, X, Heart, Quote, CheckCircle2, Sparkles, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export default function CommunityReviewsScreen() {
  const router = useRouter();
  const { getColors } = useThemeStore();
  const { user: currentUser } = useAuthStore();
  const colors = getColors();
  const s = getStyles(colors);
  const insets = useSafeAreaInsets();

  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await api.get('/reviews');
      setReviews(res.data);
    } catch (e) {
      console.log('Failed to fetch reviews:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating.');
      return;
    }
    if (!text.trim()) {
      Alert.alert('Review Required', 'Please write a short review.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/reviews', { rating, text: text.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (Platform.OS === 'android') ToastAndroid.show('Review submitted!', ToastAndroid.SHORT);
      setModalVisible(false);
      setRating(0);
      setText('');
      fetchReviews();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (reviewId: string) => {
    // Optimistic UI update
    setReviews(prev => prev.map(r => {
      if (r._id === reviewId) {
        const isLiked = r.likes && r.likes.includes(currentUser?._id);
        const newLikes = isLiked 
          ? r.likes.filter((id: string) => id !== currentUser?._id)
          : [...(r.likes || []), currentUser?._id];
        return { ...r, likes: newLikes };
      }
      return r;
    }));

    try {
      await api.post(`/reviews/${reviewId}/like`);
    } catch (e) {
      console.log('Failed to toggle like');
      fetchReviews(); // Revert on failure
    }
  };

  const handleAdminDeleteReview = (reviewId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete Review',
      'Remove this comment from Community Reviews permanently?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/reviews/${reviewId}`);
              setReviews((prev) => prev.filter((r) => r._id !== reviewId));
              if (Platform.OS === 'android') {
                ToastAndroid.show('Comment deleted by Admin', ToastAndroid.SHORT);
              }
            } catch {
              Alert.alert('Error', 'Could not delete this review.');
            }
          },
        },
      ]
    );
  };

  const renderStars = (count: number, size = 16) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          color={i <= count ? '#F59E0B' : colors.border}
          fill={i <= count ? '#F59E0B' : 'transparent'}
          size={size}
          strokeWidth={i <= count ? 2 : 1.5}
        />
      );
    }
    return <View style={s.starRow}>{stars}</View>;
  };

  const renderReview = ({ item }: { item: any }) => {
    const defaultAvatar = "https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=200&auto=format&fit=crop";
    const avatar = item.user?.profilePhoto && !item.user.profilePhoto.includes('unsplash.com') 
      ? item.user.profilePhoto 
      : defaultAvatar;
    const name = item.user?.name || 'Anonymous';
    const isLiked = item.likes && currentUser && item.likes.includes(currentUser._id);
    const likeCount = item.likes ? item.likes.length : 0;
    const formattedDate = (() => {
      try {
        const d = new Date(item.createdAt);
        return isNaN(d.getTime()) ? 'Recently' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch {
        return 'Recently';
      }
    })();
    
    return (
      <View style={s.reviewCard}>
        {/* Card Header: Avatar, Name, Rating & Date */}
        <View style={s.reviewHeader}>
          <View style={s.avatarContainer}>
            <Image source={{ uri: avatar }} style={s.avatar} />
          </View>
          <View style={s.reviewMeta}>
            <View style={s.reviewerNameRow}>
              <Text style={s.reviewerName}>{name}</Text>
              <CheckCircle2 color={colors.success} size={13} strokeWidth={2.4} />
            </View>
            <View style={s.ratingRow}>
              {renderStars(item.rating, 14)}
              <View style={s.ratingScoreBadge}>
                <Text style={s.ratingScoreText}>{Number(item.rating || 5).toFixed(1)}</Text>
              </View>
            </View>
          </View>
          <View style={s.dateContainer}>
            <Text style={s.reviewDate}>{formattedDate}</Text>
          </View>
        </View>

        {/* Card Body: Quote / Review Text */}
        <View style={s.quoteContainer}>
          <Quote color={colors.secondary} size={15} style={s.quoteIcon} />
          <Text style={s.reviewText}>{item.text}</Text>
        </View>

        {/* Card Footer: Likes & Verified Tag */}
        <View style={s.cardFooter}>
          <Pressable 
            style={({ pressed }) => [
              s.likeBtn, 
              isLiked && s.likeBtnActive,
              pressed && { transform: [{ scale: 0.95 }] }
            ]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleLike(item._id);
            }}
          >
            <Heart 
              color={isLiked ? '#EA580C' : colors.textSecondary} 
              fill={isLiked ? '#EA580C' : 'transparent'}
              size={15} 
              strokeWidth={2.2} 
            />
            <Text style={[s.likeText, isLiked && s.likeTextActive]}>
              {likeCount > 0 ? `${likeCount} Helpful` : 'Helpful'}
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {currentUser?.role === 'admin' && (
              <Pressable
                onPress={() => handleAdminDeleteReview(item._id)}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: colors.dangerLight,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Trash2 color={colors.error} size={13} strokeWidth={2.3} />
                <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 11, color: colors.error }}>
                  Delete
                </Text>
              </Pressable>
            )}
            <View style={s.communityTag}>
              <Sparkles color={colors.secondary} size={12} strokeWidth={2.2} />
              <Text style={s.communityTagText}>Verified Review</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar style={colors.text === '#FFFFFF' ? 'light' : 'dark'} />

      {/* ── HEADER ── */}
      <View style={s.header}>
        <Pressable 
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <ArrowLeft color={colors.text} size={20} strokeWidth={2.4} />
        </Pressable>
        <View style={s.headerTextContainer}>
          <Text style={s.headerTitle}>Community Reviews</Text>
          <Text style={s.headerSub}>Real feedback from users</Text>
        </View>
        <View style={{ width: 42 }} />
      </View>

      {loading ? (
        <LoadingScreen fullScreen={false} message="Loading feedback..." />
      ) : (
        <FlatList
          data={reviews}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={[s.listContent, { paddingBottom: 120 + Math.max(insets.bottom, 16) }]}
          renderItem={renderReview}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <MessageCircle color={colors.textSecondary} size={48} strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No Reviews Yet</Text>
              <Text style={s.emptySub}>Be the first to share your thoughts!</Text>
            </View>
          }
        />
      )}

      {/* ── FLOATING WRITE BUTTON ── */}
      <Pressable 
        style={({pressed}) => [s.fab, { bottom: 30 + Math.max(insets.bottom, 0) }, pressed && { transform: [{ scale: 0.95 }] }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setModalVisible(true);
        }}
      >
        <LinearGradient colors={['#F59E0B', '#EA580C']} style={s.fabGrad}>
          <MessageCircle color="#FFF" fill="#FFF" size={26} strokeWidth={2.5} style={{ marginTop: -3 }} />
        </LinearGradient>
      </Pressable>

      {/* ── WRITE REVIEW MODAL ── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={s.modalOverlay} onPress={() => setModalVisible(false)}>
            <Pressable onPress={() => {}} style={{ width: '100%' }}>
              <View style={[s.modalContent, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}>
                {/* Drag handle */}
                <View style={s.dragHandle} />

                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Write a Review</Text>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setModalVisible(false); }}
                    style={s.closeBtn}
                    hitSlop={12}
                  >
                    <X color={colors.text} size={20} strokeWidth={2.5} />
                  </Pressable>
                </View>

                <Text style={s.modalLabel}>Tap a star to rate</Text>
                <View style={s.ratingInteractiveRow}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <Pressable
                      key={i}
                      onPress={() => { Haptics.selectionAsync(); setRating(i); }}
                      style={({ pressed }) => [s.starBtn, pressed && { transform: [{ scale: 1.2 }] }]}
                    >
                      <Star
                        color={i <= rating ? '#F59E0B' : colors.border}
                        fill={i <= rating ? '#F59E0B' : 'transparent'}
                        size={38}
                        strokeWidth={i <= rating ? 2 : 1.5}
                      />
                    </Pressable>
                  ))}
                </View>

                {rating > 0 && (
                  <Text style={s.ratingLabel}>
                    {['', 'Poor 😕', 'Fair 😐', 'Good 😊', 'Great 😄', 'Excellent 🤩'][rating]}
                  </Text>
                )}

                <Text style={[s.modalLabel, { marginTop: 20 }]}>Share your experience</Text>
                <TextInput
                  style={s.textArea}
                  placeholder="How is EventFlow helping you stay productive?"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  textAlignVertical="top"
                  value={text}
                  onChangeText={setText}
                  maxLength={500}
                />
                <Text style={s.charCount}>{text.length}/500</Text>

                <Pressable
                  style={({ pressed }) => [s.submitBtn, pressed && { transform: [{ scale: 0.98 }] }, submitting && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  <LinearGradient colors={['#F59E0B', '#EA580C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.submitGrad}>
                    {submitting ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <Send color="#FFF" size={18} strokeWidth={2.5} />
                        <Text style={s.submitText}>Submit Review</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    borderRadius: 14,
    backgroundColor: colors.card,
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
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 19,
    color: colors.text,
    letterSpacing: 0.2,
  },
  headerSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 22,
    color: colors.text,
    marginTop: 20,
  },
  emptySub: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.6,
    borderColor: '#D4C7B8',
    borderStyle: 'dashed',
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  reviewMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  reviewerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  reviewerName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: colors.text,
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingScoreBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  ratingScoreText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10.5,
    color: '#D97706',
  },
  starRow: {
    flexDirection: 'row',
    gap: 2.5,
  },
  dateContainer: {
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  reviewDate: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11.5,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  quoteContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quoteIcon: {
    marginTop: 2,
    opacity: 0.8,
  },
  reviewText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14.5,
    color: colors.text,
    lineHeight: 22,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
    paddingTop: 12,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  likeBtnActive: {
    backgroundColor: colors.secondaryLight,
    borderColor: colors.secondary,
  },
  likeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  likeTextActive: {
    color: '#EA580C',
    fontFamily: 'Poppins_700Bold',
  },
  communityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.secondaryLight,
  },
  communityTagText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: colors.secondary,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  fabGrad: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 22,
    color: colors.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: '#F59E0B',
    textAlign: 'center',
    marginTop: -16,
    marginBottom: 8,
  },
  modalLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratingInteractiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  starBtn: {
    padding: 8,
  },
  textArea: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    color: colors.text,
    minHeight: 110,
    maxHeight: 160,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 6,
  },
  charCount: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: 20,
  },
  submitBtn: {
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  submitText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: '#FFF',
  },
});
