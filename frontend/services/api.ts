// Axios API client with encrypted JWT injection, Render cold-start resilience, and standardized error parsing.

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAuthToken, removeAuthToken } from './secureStorage';

const PRODUCTION_API_URL = 'https://eventflow-ks7m.onrender.com/api';

const getApiUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (!__DEV__) {
    return PRODUCTION_API_URL;
  }

  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    const hostIp = debuggerHost.split(':')[0];
    if (hostIp.includes('exp.direct') || hostIp.includes('ngrok')) {
      return PRODUCTION_API_URL;
    }
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
  // 45s timeout so Render free-tier cold starts complete reliably without false timeout popups
  timeout: 45000,
});

let lastWarmupAt = 0;
let lastAuthenticatedAt = 0;
let sessionInvalidationHandler: (() => void) | null = null;

export const markAuthenticatedNow = (): void => {
  lastAuthenticatedAt = Date.now();
};

export const registerSessionInvalidationHandler = (handler: (() => void) | null): void => {
  sessionInvalidationHandler = handler;
};

/**
 * Silent background health ping to wake up Render server while the user enters credentials.
 */
export const warmUpBackend = (): void => {
  const now = Date.now();
  if (now - lastWarmupAt < 120000) return;
  lastWarmupAt = now;
  api.get('/health', { timeout: 30000 }).catch(() => {});
};

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

// Handle 401 and network errors cleanly
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestUrl = String(error.config?.url || '');
    const isAuthAttempt =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/google') ||
      requestUrl.includes('/auth/2fa/') ||
      requestUrl.includes('/auth/forgot-password');

    // Never invalidate an active session within 5 seconds of a fresh login/register,
    // or for non-critical background endpoints.
    const inFreshLoginGrace = Date.now() - lastAuthenticatedAt < 5000;

    if (error.response?.status === 401 && !isAuthAttempt && !inFreshLoginGrace) {
      try {
        await removeAuthToken();
        await AsyncStorage.removeItem('user');
        if (sessionInvalidationHandler) {
          sessionInvalidationHandler();
        }
      } catch {
        // Ignore storage cleanup errors
      }
    }

    if (!error.response && error.message === 'Network Error') {
      const netErr: any = new Error(
        'Unable to connect to the server. Please check your internet connection and try again.'
      );
      netErr.isNetworkError = true;
      return Promise.reject(netErr);
    }

    return Promise.reject(error);
  }
);

export interface ParsedApiError {
  title: string;
  message: string;
  code?: string;
  status?: number;
  field?: string;
  accountExists: boolean;
  accountNotFound: boolean;
  usernameTaken: boolean;
  accountBanned: boolean;
  isNetworkError: boolean;
  isTimeout: boolean;
  isRateLimited: boolean;
}

export function extractApiError(err: any, fallbackMessage = 'Something went wrong. Please try again.'): ParsedApiError {
  const status: number | undefined = err?.response?.status;
  const data = err?.response?.data || {};
  const code: string | undefined = data.code;
  const field: string | undefined = data.field;
  const rawServerMsg: string | undefined =
    typeof data.error === 'string'
      ? data.error
      : typeof data.message === 'string'
        ? data.message
        : undefined;

  const isTimeout =
    err?.code === 'ECONNABORTED' ||
    String(err?.message || '').toLowerCase().includes('timeout');
  const isNetworkError =
    Boolean(err?.isNetworkError) ||
    (!err?.response && !isTimeout);
  const isRateLimited = status === 429;

  const lowerMsg = String(rawServerMsg || err?.message || '').toLowerCase();
  const accountExists =
    code === 'EMAIL_EXISTS' ||
    Boolean(data.accountExists) ||
    (status === 409 && field !== 'username') ||
    (lowerMsg.includes('email') && (lowerMsg.includes('already') || lowerMsg.includes('exist')));

  const usernameTaken =
    code === 'USERNAME_TAKEN' ||
    Boolean(data.usernameTaken) ||
    (field === 'username' && (status === 409 || lowerMsg.includes('taken') || lowerMsg.includes('already')));

  const accountNotFound =
    code === 'ACCOUNT_NOT_FOUND' ||
    Boolean(data.accountNotFound) ||
    status === 404;

  const accountBanned =
    code === 'ACCOUNT_BANNED' ||
    Boolean(data.accountBanned) ||
    (status === 403 && lowerMsg.includes('suspend'));

  if (isTimeout) {
    return {
      title: 'Server Waking Up',
      message: 'The server took longer than expected to respond. Please wait a few seconds and tap again.',
      code: 'TIMEOUT',
      status,
      accountExists: false,
      accountNotFound: false,
      usernameTaken: false,
      accountBanned: false,
      isNetworkError: false,
      isTimeout: true,
      isRateLimited: false,
    };
  }

  if (isNetworkError) {
    return {
      title: 'No Internet Connection',
      message:
        rawServerMsg ||
        'Unable to reach EventFlow servers. Please check your Wi-Fi or mobile data and try again.',
      code: 'NETWORK_ERROR',
      status,
      accountExists: false,
      accountNotFound: false,
      usernameTaken: false,
      accountBanned: false,
      isNetworkError: true,
      isTimeout: false,
      isRateLimited: false,
    };
  }

  if (isRateLimited) {
    return {
      title: 'Too Many Attempts',
      message:
        rawServerMsg ||
        'You have made too many requests. Please wait a few minutes before trying again.',
      code: code || 'RATE_LIMITED',
      status,
      field,
      accountExists: false,
      accountNotFound: false,
      usernameTaken: false,
      accountBanned: false,
      isNetworkError: false,
      isTimeout: false,
      isRateLimited: true,
    };
  }

  if (status && status >= 502 && status <= 504) {
    return {
      title: 'Server Starting Up',
      message: 'EventFlow server is waking up or restarting. Please wait 10 seconds and try again.',
      code: 'SERVER_STARTING',
      status,
      accountExists: false,
      accountNotFound: false,
      usernameTaken: false,
      accountBanned: false,
      isNetworkError: false,
      isTimeout: false,
      isRateLimited: false,
    };
  }

  return {
    title: accountExists
      ? 'Account Already Exists'
      : usernameTaken
        ? 'Username Taken'
        : accountNotFound
          ? 'Account Not Found'
          : accountBanned
            ? 'Account Suspended'
            : 'Error',
    message: rawServerMsg || err?.message || fallbackMessage,
    code,
    status,
    field,
    accountExists,
    accountNotFound,
    usernameTaken,
    accountBanned,
    isNetworkError: false,
    isTimeout: false,
    isRateLimited: false,
  };
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('file://') ||
    url.startsWith('content://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || '';
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default api;
