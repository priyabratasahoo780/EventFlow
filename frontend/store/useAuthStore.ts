/**
 * useAuthStore.ts
 * Zustand authentication store backed by hardware-encrypted SecureStore tokens and Admin Vault sync.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { notificationService } from '../services/notificationService';
import {
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  generateSecureUniqueId,
} from '../services/secureStorage';
import { saveAdminVaultSession } from '../services/biometricAuth';

export interface UserProfile {
  _id: string;
  uniqueId: string;
  name: string;
  username: string;
  email: string;
  profilePhoto: string;
  twoFactorEnabled?: boolean;
  role?: 'user' | 'admin';
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  postLoginRoute: string | null;

  setPostLoginRoute: (route: string | null) => void;
  login: (token: string, user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUserProfile: (updatedFields: Partial<UserProfile>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  postLoginRoute: null,

  setPostLoginRoute: (route) => set({ postLoginRoute: route }),

  login: async (token: string, user: UserProfile) => {
    await setAuthToken(token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ token, user });

    if (user.role === 'admin') {
      await saveAdminVaultSession(token, user);
    }

    // Background sync to MongoDB backend without blocking navigation
    Promise.resolve().then(async () => {
      try {
        const res = await api.post('/auth/sync', {
          uniqueId: user.uniqueId,
          name: user.name,
          profilePhoto: user.profilePhoto,
        });

        if (res.data?.user) {
          const syncedUser = { ...user, ...res.data.user };
          await AsyncStorage.setItem('user', JSON.stringify(syncedUser));
          const finalToken = res.data.token || token;
          if (res.data.token) {
            await setAuthToken(res.data.token);
          }
          if (syncedUser.role === 'admin') {
            await saveAdminVaultSession(finalToken, syncedUser);
          }
          set({ user: syncedUser, token: finalToken });
        }

        const pushToken = await notificationService.registerForPushNotificationsAsync();
        if (pushToken) {
          await api.post('/users/push-token', { token: pushToken });
        }
      } catch {
        // Background sync failed — user is already logged in locally
      }
    });
  },

  logout: async () => {
    await removeAuthToken();
    await AsyncStorage.removeItem('user');
    set({ token: null, user: null, postLoginRoute: null });
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
        await api.post('/auth/sync', {
          uniqueId: currentUser.uniqueId,
          name: currentUser.name,
          profilePhoto: currentUser.profilePhoto,
        });
      }
    } catch {
      // Deferred sync
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    const token = await getAuthToken();
    const userStr = await AsyncStorage.getItem('user');

    if (token && userStr) {
      try {
        const parsedUser: UserProfile = JSON.parse(userStr);

        if (
          !parsedUser.uniqueId ||
          parsedUser.uniqueId.length !== 8 ||
          parsedUser.uniqueId.startsWith('FOCUS') ||
          parsedUser.uniqueId.startsWith('EVENT')
        ) {
          parsedUser.uniqueId = generateSecureUniqueId();
          await AsyncStorage.setItem('user', JSON.stringify(parsedUser));
        }

        set({ token, user: parsedUser, isLoading: false });

        try {
          const res = await api.post('/auth/sync', {
            uniqueId: parsedUser.uniqueId,
            name: parsedUser.name,
            profilePhoto: parsedUser.profilePhoto,
          });

          if (res.data?.user) {
            const syncedUser = { ...parsedUser, ...res.data.user };
            await AsyncStorage.setItem('user', JSON.stringify(syncedUser));
            const finalToken = res.data.token || token;
            if (res.data.token) {
              await setAuthToken(res.data.token);
            }
            if (syncedUser.role === 'admin') {
              await saveAdminVaultSession(finalToken, syncedUser);
            }
            set({ user: syncedUser, token: finalToken });
          }

          const pushToken = await notificationService.registerForPushNotificationsAsync();
          if (pushToken) {
            await api.post('/users/push-token', { token: pushToken });
          }
        } catch {
          // Background auth sync deferred
        }
      } catch {
        await removeAuthToken();
        await AsyncStorage.removeItem('user');
        set({ token: null, user: null, isLoading: false });
      }
    } else {
      set({ token: null, user: null, isLoading: false });
    }
  },
}));
