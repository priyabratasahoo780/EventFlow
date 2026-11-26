  // Authenticated Socket.IO real-time client using encrypted token storage.

import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAuthToken } from './secureStorage';

const PRODUCTION_SOCKET_URL = 'https://eventflow-ks7m.onrender.com';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private currentToken: string | null = null;
  private connectingPromise: Promise<void> | null = null;

  private getApiUrl = () => {
    if (process.env.EXPO_PUBLIC_API_URL) {
      const match = process.env.EXPO_PUBLIC_API_URL.match(/(https?:\/\/[^\/]+)/);
      if (match) return match[1];
    }

    if (!__DEV__) {
      return PRODUCTION_SOCKET_URL;
    }

    let hostIp = 'localhost';
    const debuggerHost =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest?.debuggerHost ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

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

  private notifyInternal(event: string, ...args: any[]) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(...args);
        } catch (err) {
          if (__DEV__) console.warn(`[Socket] Listener error for ${event}:`, err);
        }
      });
    }
  }

  public isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  public async connect() {
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = (async () => {
      try {
        const token = await getAuthToken();
        if (!token) {
          this.disconnect();
          return;
        }

        // If already connected or connecting with the same token, keep connection
        if (this.socket && this.currentToken === token) {
          if (!this.socket.connected) {
            this.socket.connect();
          }
          return;
        }

        // Token changed (new login or refreshed JWT): tear down old socket cleanly
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = null;
        }

        this.currentToken = token;
        const socketUrl = this.getApiUrl();
        if (__DEV__) {
          console.log('Connecting to Socket.IO at:', socketUrl);
        }

        let hadConnectedBefore = false;

        this.socket = io(socketUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10000,
          timeout: 20000,
        });

        this.socket.on('connect', () => {
          if (__DEV__) console.log('Socket connected successfully:', this.socket?.id);
          if (hadConnectedBefore) {
            this.notifyInternal('socket_reconnected');
          }
          hadConnectedBefore = true;
          this.notifyInternal('socket_connected');
        });

        this.socket.on('disconnect', (reason) => {
          if (__DEV__) console.log('Socket disconnected:', reason);
          this.notifyInternal('socket_disconnected', reason);
        });

        this.socket.on('connect_error', (err) => {
          if (__DEV__) console.warn('Socket connect error:', err.message);
        });

        this.socket.onAny((event, ...args) => {
          this.notifyInternal(event, ...args);
        });
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  public disconnect() {
    this.currentToken = null;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public emit(event: string, ...args: any[]) {
    if (this.socket?.connected) {
      this.socket.emit(event, ...args);
    }
  }

  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    const list = this.listeners.get(event)!;
    if (!list.includes(callback)) {
      list.push(callback);
    }
  }

  public off(event: string, callback?: Function) {
    if (!callback) {
      this.listeners.delete(event);
    } else {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        this.listeners.set(event, callbacks.filter((cb) => cb !== callback));
      }
    }
  }
}

export const socketService = new SocketService();
