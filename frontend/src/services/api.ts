import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    // If the old IP is still in the process.env due to lack of restart, override it
    const url = process.env.EXPO_PUBLIC_API_URL;
    if (url.includes('192.168.1.97')) return url.replace('192.168.1.97', '192.168.1.73');
    return url;
  }
  
  let hostIp = '192.168.1.73';
  const debuggerHost = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  
  if (debuggerHost) {
    hostIp = debuggerHost.split(':')[0];
  } else if (Platform.OS === 'android') {
    hostIp = '10.0.2.2'; // Default Android Emulator host IP
  }
  
  // If we got localhost/127.0.0.1 on Android, redirect to host
  if (Platform.OS === 'android' && (hostIp === '127.0.0.1' || hostIp === 'localhost')) {
    hostIp = '10.0.2.2';
  }
  
  return `http://${hostIp}:5000/api`;
};

const API_URL = getApiUrl();
console.log('Using API URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
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

export default api;
