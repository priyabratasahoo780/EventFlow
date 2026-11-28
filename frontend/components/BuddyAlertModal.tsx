import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput,
  ScrollView, Animated, Easing, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../store/useThemeStore';
import { BuddyAlertPayload, useEventStore } from '../store/useEventStore';
import {
  MapPin, ShoppingCart, Plus, Check, X, Send,
} from 'lucide-react-native';
import * as Haptics from '../services/haptics';
import api from '../services/api';

interface Props {
  alert: BuddyAlertPayload;
  onDismiss: () => void;
}

export default function BuddyAlertModal({ alert, onDismiss }: Props) {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const { events, updateEvent } = useEventStore();

  const [newItem, setNewItem] = useState('');
  const [checklist, setChecklist] = useState<Array<{ id: string; text: string; completed: boolean }>>(alert.taskChecklist || []);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Animations
  const slideAnim = useRef(new Animated.Value(700)).current;
  const scrimAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, damping: 18, stiffness: 160, useNativeDriver: true }),
      Animated.timing(scrimAnim, { toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();

    // Pulse the green "near" ping dot
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 750, useNativeDriver: true }),
      ])
    ).start();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const animateDismiss = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 700, duration: 220, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(scrimAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(cb);
  };

  const handleDismiss = () => animateDismiss(onDismiss);

  const handleAddItem = () => {
    const text = newItem.trim();
    if (!text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const item = { id: `buddy_${Date.now()}`, text, completed: false };
    setChecklist(prev => [...prev, item]);
    setNewItem('');
  };

  const handleSend = async () => {
    if (isSending || sentSuccess) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSending(true);
    try {
      const targetEvent = events.find(e => e.id === alert.taskId || e._id === alert.taskId);
      if (targetEvent) {
        await updateEvent({ ...targetEvent, checklist } as any);
      } else {
        await api.put(`/tasks/${alert.taskId}`, { checklist });
      }
      setSentSuccess(true);
      setTimeout(() => animateDismiss(onDismiss), 1300);
    } catch (err) {
      console.warn('[BuddyAlert] Failed to update checklist:', err);
    } finally {
      setIsSending(false);
    }
  };

  const initials = alert.friendName
    ? alert.friendName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent>
      <Animated.View style={[styles.scrim, { opacity: scrimAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.kvWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <Animated.View
          style={[styles.sheet, { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Handle */}
          <View style={styles.handleBar} />

          {/* Gradient header */}
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.bannerGrad}
          >
            <Pressable style={styles.dismissXBtn} onPress={handleDismiss}>
              <X color="rgba(255,255,255,0.75)" size={18} strokeWidth={2.5} />
            </Pressable>

            {/* Avatar + ping */}
            <View style={styles.avatarWrap}>
              {alert.friendPhoto ? (
                <Image source={{ uri: alert.friendPhoto }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <Animated.View style={[styles.pingDot, { transform: [{ scale: pulseAnim }] }]} />
            </View>

            <Text style={styles.bannerTitle}>🛒 {alert.friendName} is nearby!</Text>

            <View style={styles.locationPill}>
              <MapPin color="rgba(255,255,255,0.7)" size={12} strokeWidth={2} />
              <Text style={styles.locationPillText} numberOfLines={1}>{alert.taskLocation}</Text>
            </View>

            <Text style={styles.bannerSub}>
              Want to add anything to{' '}
              <Text style={styles.taskHighlight}>"{alert.taskTitle}"</Text>
              {' '}before they leave?
            </Text>
          </LinearGradient>

          {/* Body */}
          <View style={styles.body}>
            {/* Current Checklist */}
            {checklist.length > 0 && (
              <>
                <View style={styles.sectionRow}>
                  <ShoppingCart color={colors.secondary} size={14} strokeWidth={2.5} />
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>
                    Current List ({checklist.length})
                  </Text>
                </View>
                <ScrollView style={styles.checkScroll} showsVerticalScrollIndicator={false}>
                  {checklist.map(item => (
                    <View key={item.id} style={[styles.checkRow, { borderColor: colors.border }]}>
                      <View style={[styles.checkCircle, { borderColor: colors.border }, item.completed && { backgroundColor: colors.success, borderColor: colors.success }]}>
                        {item.completed && <Check color="#FFF" size={9} strokeWidth={3} />}
                      </View>
                      <Text
                        style={[styles.checkText, { color: item.completed ? colors.textSecondary : colors.text }, item.completed && styles.strikeText]}
                        numberOfLines={1}
                      >
                        {item.text}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Quick Add */}
            <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 16, marginBottom: 10 }]}>
              ✏️  Add an item
            </Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="e.g., Extra milk, bread, tomatoes..."
                placeholderTextColor={colors.textSecondary}
                value={newItem}
                onChangeText={setNewItem}
                onSubmitEditing={handleAddItem}
                returnKeyType="done"
              />
              {newItem.trim().length > 0 && (
                <Pressable style={styles.addChip} onPress={handleAddItem}>
                  <Plus color="#FFF" size={14} strokeWidth={3} />
                </Pressable>
              )}
            </View>

            {/* CTA Buttons */}
            <Pressable
              style={[styles.sendBtn, { opacity: isSending ? 0.7 : 1 }]}
              onPress={handleSend}
              disabled={isSending || sentSuccess}
            >
              <LinearGradient
                colors={sentSuccess ? ['#16A34A', '#15803D'] : ['#7C3AED', '#4F46E5']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.sendBtnGrad}
              >
                {sentSuccess ? (
                  <>
                    <Check color="#FFF" size={17} strokeWidth={3} />
                    <Text style={styles.sendBtnText}>Sent to {alert.friendName}! ✅</Text>
                  </>
                ) : (
                  <>
                    <Send color="#FFF" size={15} strokeWidth={2.5} />
                    <Text style={styles.sendBtnText}>
                      {isSending ? 'Sending...' : `Send to ${alert.friendName}`}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.skipBtn} onPress={handleDismiss}>
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>Nothing to add right now</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  kvWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 26,
    elevation: 22,
    maxHeight: '92%',
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: -6,
    zIndex: 10,
  },
  bannerGrad: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    alignItems: 'center',
  },
  dismissXBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    padding: 6,
    zIndex: 10,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFF',
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
  },
  pingDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#4F46E5',
  },
  bannerTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 20,
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  locationPillText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
  },
  bannerSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    lineHeight: 20,
  },
  taskHighlight: {
    fontFamily: 'Poppins_700Bold',
    color: '#FFF',
  },
  body: {
    padding: 20,
    paddingBottom: 36,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
  },
  checkScroll: {
    maxHeight: 140,
    marginBottom: 4,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    flex: 1,
  },
  strikeText: {
    textDecorationLine: 'line-through',
    opacity: 0.55,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    paddingVertical: 0,
  },
  addChip: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  sendBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 24,
  },
  sendBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },
});
