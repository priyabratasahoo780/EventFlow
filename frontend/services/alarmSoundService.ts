import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// High pitch alarm chime sound URL
const ALARM_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg';

class AlarmSoundService {
  private soundObject: Audio.Sound | null = null;
  private isPlaying: boolean = false;
  private hapticInterval: ReturnType<typeof setInterval> | null = null;

  async playAlarmSound() {
    if (this.isPlaying || this.soundObject) return;
    this.isPlaying = true;

    try {
      // Configure audio mode to override silent switches & play loudly
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: ALARM_SOUND_URL },
        { shouldPlay: false, isLooping: true, volume: 1.0 } // Don't play immediately here
      );

      // If stopAlarmSound was called while we were downloading, abort!
      if (!this.isPlaying) {
        await sound.unloadAsync();
        return;
      }

      this.soundObject = sound;
      await sound.playAsync();

      // Start continuous heavy vibration pattern
      this.startVibration();
      console.log('🚨 LOUD ALARM SOUND STARTED PLAYING SUCCESSFULLY!');
    } catch (error) {
      console.warn('Alarm sound playback fallback trigger:', error);
      this.isPlaying = false;
      this.soundObject = null;
      this.startVibration();
    }
  }

  startVibration() {
    if (this.hapticInterval) clearInterval(this.hapticInterval);
    this.hapticInterval = setInterval(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }, 1000);
  }

  async stopAlarmSound() {
    if (this.hapticInterval) {
      clearInterval(this.hapticInterval);
      this.hapticInterval = null;
    }

    if (this.soundObject) {
      try {
        await this.soundObject.stopAsync();
        await this.soundObject.unloadAsync();
      } catch (e) {
        console.log('Sound unload error:', e);
      }
      this.soundObject = null;
    }
    this.isPlaying = false;
    console.log('🛑 ALARM SOUND STOPPED.');
  }
}

export const alarmSoundService = new AlarmSoundService();
