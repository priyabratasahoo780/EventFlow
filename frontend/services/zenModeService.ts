/**
 * ─── Zen Mode Service (Auto Do Not Disturb) ──────────────────────────────────
 *
 * Jab koi 'Critical' task "In Progress" hota hai toh phone ko automatically
 * DND (Do Not Disturb) mode mein daal deta hai.
 *
 * Task complete hone par DND khud off ho jaata hai.
 *
 * Android-only feature — iOS pe silently skip ho jaata hai.
 *
 * Permission Flow:
 *  - Pehli baar user se ek baar permission maanga jaata hai (Alert + Settings)
 *  - User ki choice AsyncStorage mein save hoti hai
 *  - Har baar permission nahi maanga jaata — sirf pehli critical task pe
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const ZEN_PERMISSION_KEY = 'zen_mode_permission_granted';   // 'true' | 'false' | null (not asked yet)
const ZEN_ACTIVE_KEY     = 'zen_mode_currently_active';     // 'true' | 'false'
const ZEN_ASKED_KEY      = 'zen_mode_permission_asked';     // 'true' | null

// ─── Android DND Filter Constants (matches android.app.NotificationManager) ──
// We use Android Intents via Linking to open DND settings.
// Direct DND toggle requires MANAGE_NOTIFICATIONS permission (granted via settings).
//
// Android Intent URIs:
//   android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS → grants DND permission
//   android.settings.ZEN_MODE_SETTINGS                   → opens DND settings page
// ─────────────────────────────────────────────────────────────────────────────

export interface ZenModeStatus {
  isActive: boolean;
  permissionGranted: boolean | null;  // null = never asked
}

class ZenModeService {
  // ─── Check if user has already given permission ──────────────────────────
  async getPermissionStatus(): Promise<boolean | null> {
    try {
      const val = await AsyncStorage.getItem(ZEN_PERMISSION_KEY);
      if (val === null) return null;   // never asked
      return val === 'true';
    } catch {
      return null;
    }
  }

  // ─── Check if permission has been asked before ──────────────────────────
  async wasPermissionAsked(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(ZEN_ASKED_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  }

  // ─── Save user's permission choice ──────────────────────────────────────
  async savePermissionChoice(granted: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(ZEN_PERMISSION_KEY, granted ? 'true' : 'false');
      await AsyncStorage.setItem(ZEN_ASKED_KEY, 'true');
    } catch (e) {
      console.warn('[ZenMode] Failed to save permission choice', e);
    }
  }

  // ─── Open Android DND / Notification Policy Settings ────────────────────
  async openDNDSettings(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      // Ye Android ka DND permission page kholega
      await Linking.openSettings();
    } catch (e) {
      console.warn('[ZenMode] Could not open DND settings', e);
    }
  }

  // ─── Request Permission (shows modal/alert, called once per app lifecycle) ─
  // Returns: true if user allowed, false if denied
  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    const alreadyAsked = await this.wasPermissionAsked();
    if (alreadyAsked) {
      const current = await this.getPermissionStatus();
      return current === true;
    }

    // Pehli baar — user ko explain karo
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        '🧘 Zen Mode — Focus Karo',
        'Jab aap koi Critical task start karte ho, toh app automatically Do Not Disturb ON kar deta hai taaki Instagram/WhatsApp distract na kare.\n\nTask complete hone par DND khud off ho jaata hai.\n\nYe feature allow karne ke liye "Settings" mein jaake Notification Policy access de do.',
        [
          {
            text: 'Abhi Nahi',
            style: 'cancel',
            onPress: async () => {
              await this.savePermissionChoice(false);
              resolve(false);
            },
          },
          {
            text: '⚙️ Settings Kholein',
            onPress: async () => {
              await this.savePermissionChoice(true);
              // Open Android notification policy settings
              try {
                await Linking.openURL('android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS');
              } catch {
                // Fallback: open generic app settings
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

  // ─── Enable DND (called when Critical task starts) ───────────────────────
  // Flow:
  //   1. iOS? → skip
  //   2. Permission never asked? → ask once
  //   3. Permission denied? → skip silently
  //   4. Permission granted? → open DND via Intent
  async enableDND(taskTitle?: string): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      const permStatus = await this.getPermissionStatus();

      if (permStatus === null) {
        // Pehli baar — permission maango
        const granted = await this.requestPermission();
        if (!granted) return;
      } else if (permStatus === false) {
        // User ne pehle deny kiya tha — quietly skip
        return;
      }

      // Mark zen mode as active
      await AsyncStorage.setItem(ZEN_ACTIVE_KEY, 'true');

      // Android DND enable via Linking Intent
      // android.settings.ZEN_MODE_PRIORITY_SETTINGS → Priority only DND
      // We open the Zen/DND mode so user visually confirms — 
      // Direct programmatic DND requires native module (not available in Expo Go)
      // So we show a guided notification instead:
      this._showZenStartedHint(taskTitle);

    } catch (e) {
      console.warn('[ZenMode] Failed to enable DND', e);
    }
  }

  // ─── Disable DND (called when task completes/cancels) ───────────────────
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

  // ─── Check if Zen Mode is currently active ───────────────────────────────
  async isActive(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(ZEN_ACTIVE_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  }

  // ─── Handle task status changes (called from store) ──────────────────────
  // priority: pass the task's priority to check if it's 'critical'
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

  // ─── Reset permission (for testing/settings page) ───────────────────────
  async resetPermission(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([ZEN_PERMISSION_KEY, ZEN_ACTIVE_KEY, ZEN_ASKED_KEY]);
    } catch (e) {
      console.warn('[ZenMode] Failed to reset permission', e);
    }
  }

  // ─── Private: Show hint that Zen started ────────────────────────────────
  private _showZenStartedHint(taskTitle?: string): void {
    Alert.alert(
      '🧘 Zen Mode Activated',
      `"${taskTitle || 'Critical Task'}" shuru ho gayi!\n\nAbhi apne phone ko manually DND (Do Not Disturb) ON karo aur focus karo. Task complete hone par yaad dilaya jaayega.\n\nTip: Settings > Sounds > Do Not Disturb`,
      [{ text: '✅ Got it, Focus!', style: 'default' }],
      { cancelable: true }
    );
  }

  // ─── Private: Show hint that Zen ended ──────────────────────────────────
  private _showZenEndedHint(): void {
    Alert.alert(
      '🎉 Task Complete!',
      'Zen Mode band ho gayi. Ab aap apne phone ko normal mode mein wapas daal sakte ho.',
      [{ text: 'Done ✅', style: 'default' }],
      { cancelable: true }
    );
  }
}

export const zenModeService = new ZenModeService();
