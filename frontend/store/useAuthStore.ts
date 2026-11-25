
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { notificationService } from '../services/notificationService';

export interface UserProfile {
  _id: string;
  uniqueId: string;
  name: string;
  username: string;
  email: string;
  profilePhoto: string;
  twoFactorEnabled?: boolean;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  
  login: (token: string, user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUserProfile: (updatedFields: Partial<UserProfile>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,

  login: async (token: string, user: UserProfile) => {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ token, user });

    // Fire-and-forget: sync to MongoDB backend without blocking navigation
    Promise.resolve().then(async () => {
      try {
        const res = await api.post('/auth/sync', {
          uniqueId: user.uniqueId,
          name: user.name,
          username: user.username,
          email: user.email,
          profilePhoto: user.profilePhoto,
        });

        if (res.data?.user) {
          const syncedUser = { ...user, ...res.data.user };
          await AsyncStorage.setItem('user', JSON.stringify(syncedUser));
          if (res.data.token) {
            await AsyncStorage.setItem('token', res.data.token);
          }
          set({ user: syncedUser, token: res.data.token || token });
        }

        const pushToken = await notificationService.registerForPushNotificationsAsync();
        if (pushToken) {
          await api.post('/users/push-token', { token: pushToken });
        }
      } catch {
        // Background sync failed — user is already logged in locally, no action needed
      }
    });
  },

  logout: async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    set({ token: null, user: null });
  },

  updateUserProfile: async (updatedFields: Partial<UserProfile>) => {
    set((state) => {
      if (!state.user) return state;
      const newUser = { ...state.user, ...updatedFields };
      AsyncStorage.setItem('user', JSON.stringify(newUser));
      return { user: newUser };
    });

    try {
      const currentUser = get().user;
      if (currentUser) {
        await api.post('/auth/sync', currentUser);
      }
    } catch (e) {}
  },

  checkAuth: async () => {
    set({ isLoading: true });
    const token = await AsyncStorage.getItem('token');
    const userStr = await AsyncStorage.getItem('user');
    
    if (token && userStr) {
      try {
        const parsedUser: UserProfile = JSON.parse(userStr);

        // Auto-upgrade legacy IDs to exact 8-character rich format (2 Capitals, 2 Smalls, 2 Numbers, 2 Symbols)
        if (!parsedUser.uniqueId || parsedUser.uniqueId.length !== 8 || parsedUser.uniqueId.startsWith('FOCUS') || parsedUser.uniqueId.startsWith('EVENT')) {
          const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
          const lowers = 'abcdefghijkmnopqrstuvwxyz';
          const numbers = '23456789';
          const symbols = '!@#$%&*_-';
          const getRandom = (set: string) => set[Math.floor(Math.random() * set.length)];
          const chars = [
            getRandom(uppers), getRandom(lowers), getRandom(numbers), getRandom(symbols),
            getRandom(uppers), getRandom(lowers), getRandom(numbers), getRandom(symbols)
          ];
          for (let i = chars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
          }
          parsedUser.uniqueId = chars.join(''); // Exact 8 characters
          await AsyncStorage.setItem('user', JSON.stringify(parsedUser));
        }

        set({ token, user: parsedUser, isLoading: false });

        // Background sync to backend MongoDB
        try {
          const res = await api.post('/auth/sync', {
            uniqueId: parsedUser.uniqueId,
            name: parsedUser.name,
            username: parsedUser.username,
            email: parsedUser.email,
            profilePhoto: parsedUser.profilePhoto,
          });

          if (res.data?.user) {
            const syncedUser = { ...parsedUser, ...res.data.user };
            await AsyncStorage.setItem('user', JSON.stringify(syncedUser));
            if (res.data.token) {
              await AsyncStorage.setItem('token', res.data.token);
            }
            set({ user: syncedUser, token: res.data.token || token });
          }

          const pushToken = await notificationService.registerForPushNotificationsAsync();
          if (pushToken) {
            await api.post('/users/push-token', { token: pushToken });
          }
        } catch (e) {
          console.log('Background auth sync deferred');
        }
      } catch (err) {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        set({ token: null, user: null, isLoading: false });
      }
    } else {
      set({ token: null, user: null, isLoading: false });
    }
  }
}));
