import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const ALARM_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg';

class AlarmSoundService {
  private player: AudioPlayer | null = null;
  private isPlaying: boolean = false;
  private hapticInterval: ReturnType<typeof setInterval> | null = null;

  async playAlarmSound() {
    if (this.isPlaying || this.player) return;
    this.isPlaying = true;

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });

      const player = createAudioPlayer(ALARM_SOUND_URL);
      player.loop = true;
      player.volume = 1.0;

      if (!this.isPlaying) {
        player.release();
        return;
      }

      this.player = player;
      player.play();

      this.startVibration();
      console.log('🚨 LOUD ALARM SOUND STARTED PLAYING SUCCESSFULLY!');
    } catch (error) {
      console.warn('Alarm sound playback fallback trigger:', error);
      this.isPlaying = false;
      this.player = null;
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

    if (this.player) {
      try {
        this.player.pause();
        this.player.release();
      } catch (e) {
        console.log('Sound unload error:', e);
      }
      this.player = null;
    }
    this.isPlaying = false;
    console.log('🛑 ALARM SOUND STOPPED.');
  }
}

export const alarmSoundService = new AlarmSoundService();
