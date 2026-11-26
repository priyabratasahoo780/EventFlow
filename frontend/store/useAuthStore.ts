  // Zustand authentication store backed by hardware-encrypted SecureStore tokens and Admin Vault sync.
 
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
import { socketService } from '../services/socketService';

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
    socketService.connect().catch(() => {});

    if (user.role === 'admin') {
      await saveAdminVaultSession(token, user);
    }

    // Background sync to MongoDB backend without blocking navigation
    Promise.resolve().then(async () => {
      try {
        const res = await api.post('/auth/sync', {
          uniqueId: user.uniqueId,
          name: user.name,
          profilePhoto: user.profilePhoto?.startsWith('file://') ? undefined : user.profilePhoto,
        });

        if (res.data?.user) {
          const localPhotoKey = `local_profile_photo_${user._id || user.email}`;
          const savedLocalPhoto = await AsyncStorage.getItem(localPhotoKey);
          const mergedPhoto =
            savedLocalPhoto ||
            (user.profilePhoto?.startsWith('file://') ? user.profilePhoto : res.data.user.profilePhoto);
          const syncedUser = { ...user, ...res.data.user, profilePhoto: mergedPhoto };
          await AsyncStorage.setItem('user', JSON.stringify(syncedUser));
          const finalToken = res.data.token || token;
          if (res.data.token) {
            await setAuthToken(res.data.token);
            socketService.connect().catch(() => {});
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
      } catch (syncErr: any) {
        const status = syncErr?.response?.status;
        if (status === 401 || status === 403) {
          await removeAuthToken();
          await AsyncStorage.removeItem('user');
          set({ token: null, user: null });
        }
      }
    });
  },

  logout: async () => {
    socketService.disconnect();
    await removeAuthToken();
    await AsyncStorage.removeItem('user');
    set({ token: null, user: null, postLoginRoute: null });
  },

  updateUserProfile: async (updatedFields: Partial<UserProfile>) => {
    const prevUser = get().user;
    set((state) => {
      if (!state.user) return state;
      const newUser = { ...state.user, ...updatedFields };
      AsyncStorage.setItem('user', JSON.stringify(newUser));
      return { user: newUser };
    });

    const currentUser = get().user || prevUser;
    if (currentUser && Object.prototype.hasOwnProperty.call(updatedFields, 'profilePhoto')) {
      const localPhotoKey = `local_profile_photo_${currentUser._id || currentUser.email}`;
      if (updatedFields.profilePhoto && updatedFields.profilePhoto.startsWith('file://')) {
        await AsyncStorage.setItem(localPhotoKey, updatedFields.profilePhoto);
      } else if (updatedFields.profilePhoto === '') {
        await AsyncStorage.removeItem(localPhotoKey);
      }
    }

    try {
      if (currentUser) {
        const serverPhoto =
          currentUser.profilePhoto?.startsWith('file://') ? '' : currentUser.profilePhoto;
        await api.post('/auth/sync', {
          uniqueId: currentUser.uniqueId,
          name: currentUser.name,
          profilePhoto: serverPhoto,
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
            profilePhoto: parsedUser.profilePhoto?.startsWith('file://') ? '' : parsedUser.profilePhoto,
          });

          if (res.data?.user) {
            const localPhotoKey = `local_profile_photo_${parsedUser._id || parsedUser.email}`;
            const savedLocalPhoto = await AsyncStorage.getItem(localPhotoKey);
            const mergedPhoto =
              savedLocalPhoto ||
              (parsedUser.profilePhoto?.startsWith('file://')
                ? parsedUser.profilePhoto
                : res.data.user.profilePhoto);
            const syncedUser = { ...parsedUser, ...res.data.user, profilePhoto: mergedPhoto };
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
        } catch (syncErr: any) {
          const status = syncErr?.response?.status;
          if (status === 401 || status === 403) {
            await removeAuthToken();
            await AsyncStorage.removeItem('user');
            set({ token: null, user: null });
          }
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
