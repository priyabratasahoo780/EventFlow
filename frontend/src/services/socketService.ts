import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  private getApiUrl = () => {
    if (process.env.EXPO_PUBLIC_API_URL) {
      const url = process.env.EXPO_PUBLIC_API_URL;
      if (url.includes('192.168.1.97')) return url.replace('192.168.1.97', '192.168.1.73');
      const match = url.match(/(https?:\/\/[^\/]+)/);
      if (match) return match[1];
    }
    
    let hostIp = '192.168.1.73';
    const debuggerHost = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
    
    if (debuggerHost) {
      hostIp = debuggerHost.split(':')[0];
    } else if (Platform.OS === 'android') {
      hostIp = '10.0.2.2';
    }
    
    if (Platform.OS === 'android' && (hostIp === '127.0.0.1' || hostIp === 'localhost')) {
      hostIp = '10.0.2.2';
    }
    
    return `http://${hostIp}:5000`;
  };

  public async connect() {
    if (this.socket?.connected) return;

    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const socketUrl = this.getApiUrl();
    console.log('Connecting to Socket.IO at:', socketUrl);

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected successfully');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Socket connect error:', err.message);
    });

    this.socket.onAny((event, ...args) => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.forEach(cb => cb(...args));
      }
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback?: Function) {
    if (!callback) {
      this.listeners.delete(event);
    } else {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        this.listeners.set(event, callbacks.filter(cb => cb !== callback));
      }
    }
  }
}

export const socketService = new SocketService();
