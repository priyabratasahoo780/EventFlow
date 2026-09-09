import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, Pressable, Modal, TextInput, ActivityIndicator, Image, ToastAndroid, Platform, Alert, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import api from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import { ArrowLeft, Star, MessageCircle, Send, X, Heart, Quote } from 'lucide-react-native';
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
    
    return (
      <View style={s.reviewCard}>
        <View style={s.reviewHeader}>
          <View style={s.avatarContainer}>
            <Image source={{ uri: avatar }} style={s.avatar} />
          </View>
          <View style={s.reviewMeta}>
            <Text style={s.reviewerName}>{name}</Text>
            {renderStars(item.rating)}
          </View>
          <View style={s.dateContainer}>
            <Text style={s.reviewDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
        <View style={s.quoteContainer}>
          <Quote color={colors.border} size={16} style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={s.reviewText}>{item.text}</Text>
        </View>
        <View style={s.cardFooter}>
          <Pressable 
            style={[s.likeBtn, (item.likes && currentUser && item.likes.includes(currentUser._id)) && s.likeBtnActive]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleLike(item._id);
            }}
          >
            <Heart 
              color={(item.likes && currentUser && item.likes.includes(currentUser._id)) ? '#EA580C' : colors.textSecondary} 
              fill={(item.likes && currentUser && item.likes.includes(currentUser._id)) ? '#EA580C' : 'transparent'}
              size={16} 
              strokeWidth={2} 
            />
            <Text style={[s.likeText, (item.likes && currentUser && item.likes.includes(currentUser._id)) && { color: '#EA580C' }]}>
              {item.likes ? item.likes.length : 0}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* ── HEADER ── */}
      <View style={s.header}>
        <Pressable 
          style={s.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <ArrowLeft color={colors.text} size={24} strokeWidth={2.5} />
        </Pressable>
        <View style={s.headerTextContainer}>
          <Text style={s.headerTitle}>Community Reviews</Text>
          <Text style={s.headerSub}>Real feedback from users</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <LoadingScreen fullScreen={false} message="Loading feedback..." />
      ) : (
        <FlatList
          data={reviews}
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 20,
    color: colors.text,
  },
  headerSub: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -2,
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
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.15)',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    backgroundColor: colors.background,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  reviewMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  reviewerName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 2,
  },
  starRow: {
    flexDirection: 'row',
    gap: 3,
  },
  quoteContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingRight: 16,
  },
  reviewText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.background,
    borderRadius: 12,
    gap: 6,
  },
  likeBtnActive: {
    backgroundColor: 'rgba(234, 88, 12, 0.1)',
  },
  likeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  reviewDate: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    opacity: 0.8,
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
