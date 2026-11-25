
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getApiUrl = (): string => {
  // 1. Production APK: always use the env variable set in eas.json
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Dev fallback: try to detect Metro host
  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    const hostIp = debuggerHost.split(':')[0];
    return `http://${hostIp}:5000/api`;
  }

  // 3. Android emulator default
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }

  // 4. iOS simulator default
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
    const token = await AsyncStorage.getItem('token');
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
    if (error.response?.status === 401) {
      try {
        await AsyncStorage.multiRemove(['token', 'user']);
      } catch (e) {
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
