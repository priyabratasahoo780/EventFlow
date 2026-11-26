// Zustand authentication store backed by hardware-encrypted SecureStore tokens and Admin Vault sync.

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { markAuthenticatedNow, registerSessionInvalidationHandler } from '../services/api';
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
    if (!token || typeof token !== 'string' || !user || !user._id) {
      throw new Error('Invalid login session returned by server. Please try again.');
    }

    // Mark fresh authentication window before writing state or firing network calls
    markAuthenticatedNow();

    await setAuthToken(token);
    await AsyncStorage.setItem('user', JSON.stringify(user)).catch(() => {});

    if (user.role === 'admin') {
      await saveAdminVaultSession(token, user).catch(() => {});
    }

    set({ token, user, isLoading: false });
    socketService.connect().catch(() => {});

    // Non-blocking push token registration ONLY for regular users (admins don't use /users/push-token).
    // Never invalidate or clear the active session if push registration is unavailable.
    if (user.role !== 'admin') {
      Promise.resolve().then(async () => {
        try {
          const pushToken = await notificationService.registerForPushNotificationsAsync();
          if (pushToken) {
            await api.post('/users/push-token', { token: pushToken });
          }
        } catch {
          // Push registration is best-effort and must never log the user out
        }
      });
    }
  },

  logout: async () => {
    socketService.disconnect();
    await removeAuthToken();
    await AsyncStorage.removeItem('user').catch(() => {});
    set({ token: null, user: null, postLoginRoute: null, isLoading: false });
  },

  updateUserProfile: async (updatedFields: Partial<UserProfile>) => {
    const prevUser = get().user;
    set((state) => {
      if (!state.user) return state;
      const newUser = { ...state.user, ...updatedFields };
      AsyncStorage.setItem('user', JSON.stringify(newUser)).catch(() => {});
      return { user: newUser };
    });

    const currentUser = get().user || prevUser;
    if (currentUser && Object.prototype.hasOwnProperty.call(updatedFields, 'profilePhoto')) {
      const localPhotoKey = `local_profile_photo_${currentUser._id || currentUser.email}`;
      if (updatedFields.profilePhoto && updatedFields.profilePhoto.startsWith('file://')) {
        await AsyncStorage.setItem(localPhotoKey, updatedFields.profilePhoto).catch(() => {});
      } else if (updatedFields.profilePhoto === '') {
        await AsyncStorage.removeItem(localPhotoKey).catch(() => {});
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
    const userStr = await AsyncStorage.getItem('user').catch(() => null);

    if (token && userStr) {
      try {
        const parsedUser: UserProfile = JSON.parse(userStr);
        if (!parsedUser || !parsedUser._id) {
          throw new Error('Corrupt stored user profile');
        }

        if (
          !parsedUser.uniqueId ||
          parsedUser.uniqueId.length !== 8 ||
          parsedUser.uniqueId.startsWith('FOCUS') ||
          parsedUser.uniqueId.startsWith('EVENT')
        ) {
          parsedUser.uniqueId = generateSecureUniqueId();
          await AsyncStorage.setItem('user', JSON.stringify(parsedUser)).catch(() => {});
        }

        set({ token, user: parsedUser, isLoading: false });

        try {
          const res = await api.post('/auth/sync', {
            uniqueId: parsedUser.uniqueId,
            name: parsedUser.name,
            profilePhoto: parsedUser.profilePhoto?.startsWith('file://') ? '' : parsedUser.profilePhoto,
          });

          if (res.data?.user && get().token === token) {
            const localPhotoKey = `local_profile_photo_${parsedUser._id || parsedUser.email}`;
            const savedLocalPhoto = await AsyncStorage.getItem(localPhotoKey).catch(() => null);
            const mergedPhoto =
              savedLocalPhoto ||
              (parsedUser.profilePhoto?.startsWith('file://')
                ? parsedUser.profilePhoto
                : res.data.user.profilePhoto);
            const syncedUser = { ...parsedUser, ...res.data.user, profilePhoto: mergedPhoto };
            await AsyncStorage.setItem('user', JSON.stringify(syncedUser)).catch(() => {});
            const finalToken = res.data.token || token;
            if (res.data.token) {
              await setAuthToken(res.data.token);
            }
            if (syncedUser.role === 'admin') {
              await saveAdminVaultSession(finalToken, syncedUser).catch(() => {});
            }
            set({ user: syncedUser, token: finalToken });
          }

          if (parsedUser.role !== 'admin' && get().token === token) {
            const pushToken = await notificationService.registerForPushNotificationsAsync();
            if (pushToken) {
              await api.post('/users/push-token', { token: pushToken }).catch(() => {});
            }
          }
        } catch (syncErr: any) {
          const status = syncErr?.response?.status;
          // Only clear session if no newer login/signup has replaced the token
          if ((status === 401 || status === 403) && get().token === token) {
            await removeAuthToken();
            await AsyncStorage.removeItem('user').catch(() => {});
            set({ token: null, user: null });
          }
        }
      } catch {
        await removeAuthToken();
        await AsyncStorage.removeItem('user').catch(() => {});
        set({ token: null, user: null, isLoading: false });
      }
    } else {
      set({ token: null, user: null, isLoading: false });
    }
  },
}));

registerSessionInvalidationHandler(() => {
  const { token } = useAuthStore.getState();
  if (token) {
    socketService.disconnect();
    useAuthStore.setState({ token: null, user: null, postLoginRoute: null });
  }
});
