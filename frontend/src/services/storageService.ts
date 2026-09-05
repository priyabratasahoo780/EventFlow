import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event } from '../types/event.types';

const EVENTS_STORAGE_KEY = '@eventflow_events';

export const storageService = {
  async getEvents(): Promise<Event[]> {
    try {
      const data = await AsyncStorage.getItem(EVENTS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error fetching events from storage:', error);
      return [];
    }
  },

  async saveEvents(events: Event[]): Promise<void> {
    try {
      await AsyncStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
      console.error('Error saving events to storage:', error);
    }
  },

  async clearEvents(): Promise<void> {
    try {
      await AsyncStorage.removeItem(EVENTS_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing events:', error);
    }
  }
};
