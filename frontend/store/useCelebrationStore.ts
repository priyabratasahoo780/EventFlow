import { create } from 'zustand';
import * as Haptics from '../services/haptics';

interface CelebrationState {
  isActive: boolean;
  message: string;
  triggerCelebration: (customMessage?: string) => void;
  stopCelebration: () => void;
}

const MOTIVATIONAL_QUOTES = [
  'Task Crushed! Keep the streak alive! 🔥',
  'Boom! One step closer to your goal! ✨',
  'Focus Level Up! +25 Focus XP 🎉',
  'Awesome work! Momentum is unstoppable! 🚀',
  'Done and dusted! You are on fire today! ⚡',
];

export const useCelebrationStore = create<CelebrationState>((set) => ({
  isActive: false,
  message: '',
  triggerCelebration: (customMessage) => {
    // 1. Satisfying Multi-Stage Haptic Feedback
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }, 90);
    } catch (_) {}

    // 2. Random motivational quote if not supplied
    const msg = customMessage || MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];

    set({ isActive: true, message: msg });
  },
  stopCelebration: () => {
    set({ isActive: false, message: '' });
  },
}));
