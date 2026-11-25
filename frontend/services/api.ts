/**
 * api.ts
 * Axios API client with encrypted JWT injection and standardized 401 session cleanup.
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAuthToken, removeAuthToken } from './secureStorage';

const getApiUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    const hostIp = debuggerHost.split(':')[0];
    return `http://${hostIp}:5000/api`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }

  return 'http://localhost:5000/api';
};

const API_URL = getApiUrl();

if (__DEV__) {
  console.log('[API] Using URL:', API_URL);
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

api.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 and network errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestUrl = String(error.config?.url || '');
    const isAuthAttempt =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/2fa/') ||
      requestUrl.includes('/auth/forgot-password');

    if (error.response?.status === 401 && !isAuthAttempt) {
      try {
        await removeAuthToken();
        await AsyncStorage.removeItem('user');
      } catch {
        // Ignore storage cleanup errors
      }
    }

    if (!error.response && error.message === 'Network Error') {
      return Promise.reject(
        new Error('Unable to connect to the server. Please check your internet connection.')
      );
    }

    return Promise.reject(error);
  }
);

export default api;
