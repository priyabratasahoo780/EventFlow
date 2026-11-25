
import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BellOff, Zap, ShieldCheck, X } from 'lucide-react-native';
import { useThemeStore } from '../store/useThemeStore';
import { ColorTheme } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ZenModePermissionModalProps {
  visible: boolean;
  taskTitle: string;
  onAllow: () => void;
  onDeny: () => void;
}

export default function ZenModePermissionModal({
  visible,
  taskTitle,
  onAllow,
  onDeny,
}: ZenModePermissionModalProps) {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 9,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  // Only show on Android — iOS me DND programmatic control nahi hota
  if (Platform.OS !== 'android') return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDeny}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* ── Icon Header ── */}
          <LinearGradient
            colors={['#6C5CE7', '#A78BFA']}
            style={styles.iconCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <BellOff color="#FFFFFF" size={32} strokeWidth={2.5} />
          </LinearGradient>

          {/* ── Title ── */}
          <Text style={styles.title}>🧘 Zen Mode</Text>
          <Text style={styles.subtitle}>Auto Do Not Disturb</Text>

          {/* ── Task name pill ── */}
          <View style={styles.taskPill}>
            <Zap color="#6C5CE7" size={13} strokeWidth={3} />
            <Text style={styles.taskPillText} numberOfLines={1}>
              {taskTitle}
            </Text>
          </View>

          {/* ── Description ── */}
          <Text style={styles.description}>
            Yeh <Text style={styles.boldText}>Critical task</Text> start hone par app{' '}
            <Text style={styles.boldText}>phone ka DND ON</Text> kar dega.
            Instagram, WhatsApp aur doosre notifications{' '}
            <Text style={styles.boldText}>silently block</Text> ho jaayenge.
          </Text>

          {/* ── Features list ── */}
          <View style={styles.featuresList}>
            <FeatureRow icon="🔕" text="Task start → DND auto ON" />
            <FeatureRow icon="✅" text="Task complete → DND auto OFF" />
            <FeatureRow icon="🔒" text="Sirf Critical tasks ke liye" />
            <FeatureRow icon="⚙️" text="Ek baar permission, sab ke liye" />
          </View>

          {/* ── Permission note ── */}
          <View style={styles.permissionNote}>
            <ShieldCheck color="#6C5CE7" size={14} strokeWidth={2.5} />
            <Text style={styles.permissionNoteText}>
              Settings mein "Notification Policy Access" dena hoga
            </Text>
          </View>

          {/* ── Buttons ── */}
          <View style={styles.buttonsRow}>
            <Pressable
              style={[styles.btn, styles.denyBtn]}
              onPress={onDeny}
              android_ripple={{ color: '#E5E7EB', borderless: false }}
            >
              <X color="#6B7280" size={16} strokeWidth={2.5} />
              <Text style={styles.denyBtnText}>Abhi Nahi</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.allowBtn]}
              onPress={onAllow}
              android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: false }}
            >
              <LinearGradient
                colors={['#6C5CE7', '#8B5CF6']}
                style={styles.allowBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <BellOff color="#FFFFFF" size={16} strokeWidth={2.5} />
                <Text style={styles.allowBtnText}>Allow Karo ✨</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* ── Fine print ── */}
          <Text style={styles.finePrint}>
            Aap kabhi bhi Settings {'>'} Zen Mode se disable kar sakte ho
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={featureStyles.row}>
      <Text style={featureStyles.icon}>{icon}</Text>
      <Text style={featureStyles.text}>{text}</Text>
    </View>
  );
}

const featureStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  icon: {
    fontSize: 14,
    width: 20,
  },
  text: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
});

const getStyles = (colors: ColorTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      padding: 24,
      width: Math.min(SCREEN_WIDTH - 40, 380),
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 12,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 22,
      color: '#111827',
      marginBottom: 2,
    },
    subtitle: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 13,
      color: '#6C5CE7',
      letterSpacing: 0.5,
      marginBottom: 16,
    },
    taskPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#EDE9FE',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#DDD6FE',
      marginBottom: 16,
      maxWidth: '90%',
    },
    taskPillText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      color: '#5B21B6',
      flex: 1,
    },
    description: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 14,
      color: '#4B5563',
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 18,
    },
    boldText: {
      fontFamily: 'Poppins_700Bold',
      color: '#111827',
    },
    featuresList: {
      width: '100%',
      backgroundColor: '#F9FAFB',
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: '#F3F4F6',
    },
    permissionNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#EDE9FE',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      marginBottom: 20,
      width: '100%',
    },
    permissionNoteText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 11.5,
      color: '#5B21B6',
      flex: 1,
      lineHeight: 16,
    },
    buttonsRow: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
      marginBottom: 12,
    },
    btn: {
      flex: 1,
      borderRadius: 12,
      overflow: 'hidden',
    },
    denyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      paddingHorizontal: 16,
      backgroundColor: '#F3F4F6',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    denyBtnText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 14,
      color: '#6B7280',
    },
    allowBtn: {
      flex: 1.4,
    },
    allowBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      paddingHorizontal: 16,
    },
    allowBtnText: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 14,
      color: '#FFFFFF',
    },
    finePrint: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 11,
      color: '#9CA3AF',
      textAlign: 'center',
    },
  });
