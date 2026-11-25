

import { Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage Keys
const ZEN_PERMISSION_KEY = 'zen_mode_permission_granted';
const ZEN_ACTIVE_KEY     = 'zen_mode_currently_active';
const ZEN_ASKED_KEY      = 'zen_mode_permission_asked';

export interface ZenModeStatus {
  isActive: boolean;
  permissionGranted: boolean | null;
}

class ZenModeService {
  async getPermissionStatus(): Promise<boolean | null> {
    try {
      const val = await AsyncStorage.getItem(ZEN_PERMISSION_KEY);
      if (val === null) return null;
      return val === 'true';
    } catch {
      return null;
    }
  }

  async wasPermissionAsked(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(ZEN_ASKED_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  }

  // Persist user's permission choice
  async savePermissionChoice(granted: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(ZEN_PERMISSION_KEY, granted ? 'true' : 'false');
      await AsyncStorage.setItem(ZEN_ASKED_KEY, 'true');
    } catch (e) {
      console.warn('[ZenMode] Failed to save permission choice', e);
    }
  }

  // Open Android DND / Notification Policy settings
  async openDNDSettings(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      await Linking.openSettings();
    } catch (e) {
      console.warn('[ZenMode] Could not open DND settings', e);
    }
  }

  // Request DND access permission
  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    const alreadyAsked = await this.wasPermissionAsked();
    if (alreadyAsked) {
      const current = await this.getPermissionStatus();
      return current === true;
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        '🧘 Zen Mode — Distraction-Free Focus',
        'When you start a Critical task, Zen Mode helps enable Do Not Disturb so social media and notifications won\'t distract you.\n\nTo enable this, please grant Notification Policy access in Settings.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: async () => {
              await this.savePermissionChoice(false);
              resolve(false);
            },
          },
          {
            text: 'Open Settings',
            onPress: async () => {
              await this.savePermissionChoice(true);
              try {
                await Linking.openURL('android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS');
              } catch {
                await Linking.openSettings();
              }
              resolve(true);
            },
          },
        ],
        { cancelable: false }
      );
    });
  }

  async enableDND(taskTitle?: string): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      const permStatus = await this.getPermissionStatus();

      if (permStatus === null) {
        const granted = await this.requestPermission();
        if (!granted) return;
      } else if (permStatus === false) {
        return;
      }

      await AsyncStorage.setItem(ZEN_ACTIVE_KEY, 'true');
      this._showZenStartedHint(taskTitle);
    } catch (e) {
      console.warn('[ZenMode] Failed to enable DND', e);
    }
  }

  async disableDND(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      const wasActive = await AsyncStorage.getItem(ZEN_ACTIVE_KEY);
      if (wasActive !== 'true') return;

      await AsyncStorage.setItem(ZEN_ACTIVE_KEY, 'false');
      this._showZenEndedHint();
    } catch (e) {
      console.warn('[ZenMode] Failed to disable DND', e);
    }
  }

  async isActive(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(ZEN_ACTIVE_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  }

  async onTaskStatusChanged(
    status: string,
    priority: string,
    taskTitle?: string
  ): Promise<void> {
    if (Platform.OS !== 'android') return;

    const isCritical = priority?.toLowerCase() === 'critical';

    if (status === 'in_progress' && isCritical) {
      await this.enableDND(taskTitle);
    } else if (status === 'completed' || status === 'late_completed' || status === 'cancelled') {
      await this.disableDND();
    }
  }

  async resetPermission(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([ZEN_PERMISSION_KEY, ZEN_ACTIVE_KEY, ZEN_ASKED_KEY]);
    } catch (e) {
      console.warn('[ZenMode] Failed to reset permission', e);
    }
  }

  private _showZenStartedHint(taskTitle?: string): void {
    Alert.alert(
      '🧘 Zen Mode Activated',
      `"${taskTitle || 'Critical Task'}" is now in progress.\n\nTurn on Do Not Disturb to minimize interruptions and maintain peak focus.\n\nTip: Settings > Sounds > Do Not Disturb`,
      [{ text: 'Got It', style: 'default' }],
      { cancelable: true }
    );
  }

  // Private notification hint when Zen ends
  private _showZenEndedHint(): void {
    Alert.alert(
      '🎉 Task Completed!',
      'Zen Mode concluded. You can now restore standard notification volume.',
      [{ text: 'Done', style: 'default' }],
      { cancelable: true }
    );
  }
}

export const zenModeService = new ZenModeService();
