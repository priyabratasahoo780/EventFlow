import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  UserCheck,
  UserX,
  AtSign,
  AlertTriangle,
  WifiOff,
  ShieldAlert,
  X,
} from 'lucide-react-native';
import * as Haptics from '../services/haptics';
import { useThemeStore } from '../store/useThemeStore';

export type AuthModalType =
  | 'account_exists'
  | 'account_not_found'
  | 'username_taken'
  | 'error'
  | 'network'
  | 'suspended'
  | 'warning';

export interface AuthModalAction {
  label: string;
  onPress: () => void;
}

export interface AuthModalConfig {
  visible: boolean;
  type: AuthModalType;
  title: string;
  message: string;
  highlightText?: string;
  primaryAction?: AuthModalAction;
  secondaryAction?: AuthModalAction;
}

interface Props {
  config: AuthModalConfig;
  onClose: () => void;
}

export default function AuthStatusModal({ config, onClose }: Props) {
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();
  const dark = isDark();

  if (!config.visible) return null;

  const getVisuals = () => {
    switch (config.type) {
      case 'account_exists':
        return {
          Icon: UserCheck,
          accent: colors.secondary,
          bg: colors.secondaryLight,
          gradient: ['#FF8E3C', '#FF6814'] as const,
        };
      case 'account_not_found':
        return {
          Icon: UserX,
          accent: colors.primary,
          bg: colors.primaryLight,
          gradient: [colors.primary, '#4F46E5'] as const,
        };
      case 'username_taken':
        return {
          Icon: AtSign,
          accent: '#F59E0B',
          bg: colors.warningLight,
          gradient: ['#F59E0B', '#D97706'] as const,
        };
      case 'network':
        return {
          Icon: WifiOff,
          accent: '#F59E0B',
          bg: colors.warningLight,
          gradient: ['#F59E0B', '#D97706'] as const,
        };
      case 'suspended':
        return {
          Icon: ShieldAlert,
          accent: colors.error,
          bg: colors.dangerLight,
          gradient: [colors.error, '#DC2626'] as const,
        };
      default:
        return {
          Icon: AlertTriangle,
          accent: colors.error,
          bg: colors.dangerLight,
          gradient: ['#EF4444', '#DC2626'] as const,
        };
    }
  };

  const { Icon, accent, bg, gradient } = getVisuals();

  return (
    <Modal
      visible={config.visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={ZoomIn.duration(220).springify()}
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: dark ? colors.border : '#EDE4DA',
            },
          ]}
        >
          <View style={styles.innerPressable}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onClose();
              }}
              hitSlop={12}
              style={[
                styles.closeBtn,
                { backgroundColor: dark ? colors.surface : '#F4F1EC' },
              ]}
            >
              <X color={colors.textSecondary} size={16} strokeWidth={2.4} />
            </Pressable>

            <Animated.View
              entering={FadeIn.delay(60).duration(220)}
              style={[styles.iconCircle, { backgroundColor: bg }]}
            >
              <Icon color={accent} size={30} strokeWidth={2.2} />
            </Animated.View>

            <Text style={[styles.title, { color: colors.text }]}>{config.title}</Text>

            {config.highlightText ? (
              <View
                style={[
                  styles.highlightPill,
                  {
                    backgroundColor: dark ? colors.surface : '#F8F5F0',
                    borderColor: dark ? colors.border : '#EAE0D5',
                  },
                ]}
              >
                <Text style={[styles.highlightText, { color: colors.text }]} numberOfLines={1}>
                  {config.highlightText}
                </Text>
              </View>
            ) : null}

            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {config.message}
            </Text>

            <View style={styles.actions}>
              {config.primaryAction ? (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    config.primaryAction?.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.primaryBtnWrap,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <LinearGradient
                    colors={gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtn}
                  >
                    <Text style={styles.primaryBtnText}>{config.primaryAction.label}</Text>
                  </LinearGradient>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  if (config.secondaryAction) {
                    config.secondaryAction.onPress();
                  } else {
                    onClose();
                  }
                }}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    backgroundColor: dark ? colors.surface : '#F5F2ED',
                    borderColor: dark ? colors.border : '#E6DDD2',
                  },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                  {config.secondaryAction?.label || (config.primaryAction ? 'Cancel' : 'Got It')}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  innerPressable: {
    padding: 24,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  highlightPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    maxWidth: '100%',
  },
  highlightText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },
  message: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 22,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  primaryBtnWrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14.5,
  },
});
