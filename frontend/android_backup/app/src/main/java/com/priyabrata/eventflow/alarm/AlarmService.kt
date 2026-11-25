package com.priyabrata.eventflow.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.Locale

class AlarmService : Service(), TextToSpeech.OnInitListener {

    companion object {
        private const val TAG = "AlarmService"
        private const val NOTIFICATION_ID = 1998
        private const val CHANNEL_ID = "ALARM_SERVICE_CHANNEL"
    }

    private var ringtone: Ringtone? = null
    private var vibrator: Vibrator? = null
    private var tts: TextToSpeech? = null
    private var alarmTitle: String = ""
    private var alarmBody: String = ""
    private var isCritical: Boolean = false

    private var originalAlarmVolume: Int = -1
    private var volumeOverridden: Boolean = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        try {
            tts = TextToSpeech(this, this)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to initialize TextToSpeech: ${e.message}")
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            try {
                tts?.language = Locale.getDefault()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    val audioAttributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                    tts?.setAudioAttributes(audioAttributes)
                }
                speakAlarm()
            } catch (e: Exception) {
                Log.w(TAG, "TTS configuration error: ${e.message}")
            }
        }
    }

    private fun speakAlarm() {
        try {
            if (alarmTitle.isNotEmpty() || alarmBody.isNotEmpty()) {
                val textToSpeak = "EventFlow reminder: $alarmTitle. $alarmBody"
                val params = Bundle().apply {
                    putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f)
                }
                tts?.speak(textToSpeak, TextToSpeech.QUEUE_FLUSH, params, "AlarmTTS")
            }
        } catch (e: Exception) {
            Log.w(TAG, "TTS speak failed: ${e.message}")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == "STOP_ALARM") {
            stopAlarm()
            stopForeground(true)
            stopSelf()
            return START_NOT_STICKY
        }

        alarmTitle = intent?.getStringExtra("TITLE") ?: "Event Reminder"
        alarmBody = intent?.getStringExtra("BODY") ?: "It's time to focus on your task!"
        isCritical = intent?.getBooleanExtra("IS_CRITICAL", false) ?: false
        val eventId = intent?.getStringExtra("EVENT_ID") ?: ""
        val alarmId = intent?.getStringExtra("ALARM_ID") ?: ""

        Log.d(TAG, "Starting foreground alarm service: title=$alarmTitle, critical=$isCritical, id=$alarmId")

        // 1. Setup high-priority Notification Channel with sound & vibration
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Event Alarms",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Urgent full-screen alarms and event reminders"
                setBypassDnd(true)
                enableVibration(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channel)
        }

        // 2. Prepare full-screen intent for AlarmActivity
        val alarmIntent = Intent(this, AlarmActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("TITLE", alarmTitle)
            putExtra("BODY", alarmBody)
            putExtra("EVENT_ID", eventId)
            putExtra("ALARM_ID", alarmId)
            putExtra("IS_CRITICAL", isCritical)
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            alarmId.hashCode(),
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Stop Action Pending Intent
        val stopIntent = Intent(this, AlarmService::class.java).apply {
            this.action = "STOP_ALARM"
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            alarmId.hashCode() + 1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val iconResId = resources.getIdentifier("ic_notification", "drawable", packageName)
            .takeIf { it != 0 } ?: applicationInfo.icon

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(iconResId)
            .setContentTitle(alarmTitle)
            .setContentText(alarmBody)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .addAction(0, "Dismiss Alarm", stopPendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .build()

        // 3. Start foreground with mediaPlayback type (Android 14+ compatible)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.e(TAG, "startForeground error, fallback to standard: ${e.message}")
            startForeground(NOTIFICATION_ID, notification)
        }

        // 4. Safely release WakeLock held by AlarmReceiver now that foreground service is running
        AlarmReceiver.releaseWakeLock()

        // 5. Attempt direct activity launch alongside full-screen intent
        try {
            startActivity(alarmIntent)
        } catch (e: Exception) {
            Log.d(TAG, "Direct startActivity deferred to full-screen notification: ${e.message}")
        }

        // 6. Audio and Volume handling
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (isCritical) {
            try {
                originalAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM)
                val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVolume, 0)
                volumeOverridden = true
                Log.d(TAG, "Critical task: volume boosted to max ($maxVolume)")
            } catch (e: Exception) {
                Log.w(TAG, "Could not override alarm volume: ${e.message}")
            }
        }

        // 7. Start physical audio ringtone and vibration
        startAudioAndVibration(isCritical)

        // 8. Announce reminder via TextToSpeech
        if (tts != null) {
            speakAlarm()
        }

        return START_STICKY
    }

    private fun startAudioAndVibration(aggressive: Boolean) {
        // --- Play Ringtone ---
        try {
            if (ringtone == null || ringtone?.isPlaying == false) {
                var alarmUri: Uri? = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                if (alarmUri == null) {
                    alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                }
                if (alarmUri == null) {
                    alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                }
                if (alarmUri == null) {
                    alarmUri = Settings.System.DEFAULT_ALARM_ALERT_URI
                }

                if (alarmUri != null) {
                    ringtone = RingtoneManager.getRingtone(applicationContext, alarmUri)?.apply {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            isLooping = true
                        }
                        audioAttributes = AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                        play()
                    }
                    Log.d(TAG, "Ringtone playback started using USAGE_ALARM")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error playing alarm ringtone: ${e.message}", e)
        }

        // --- Start Repeating Vibration Pattern ---
        try {
            vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            val pattern = if (aggressive) {
                // Critical: aggressive rapid repeating buzz
                longArrayOf(0, 800, 200, 800, 200, 800, 400)
            } else {
                // Standard: pulsing alarm vibration pattern (1s on, 800ms off)
                longArrayOf(0, 1000, 800, 1000, 800)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0)) // 0 = repeat from index 0
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Vibrator error: ${e.message}")
        }
    }

    private fun stopAlarm() {
        try {
            ringtone?.takeIf { it.isPlaying }?.stop()
            ringtone = null
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping ringtone: ${e.message}")
        }

        try {
            vibrator?.cancel()
        } catch (e: Exception) {
            Log.w(TAG, "Error cancelling vibrator: ${e.message}")
        }

        try {
            tts?.stop()
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping TTS: ${e.message}")
        }

        // Restore original stream volume if overridden
        if (volumeOverridden && originalAlarmVolume >= 0) {
            try {
                val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, originalAlarmVolume, 0)
                Log.d(TAG, "Restored original alarm volume to $originalAlarmVolume")
            } catch (e: Exception) {
                Log.w(TAG, "Failed to restore alarm volume: ${e.message}")
            } finally {
                volumeOverridden = false
                originalAlarmVolume = -1
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopAlarm()
        try {
            tts?.shutdown()
        } catch (e: Exception) {
            Log.w(TAG, "Error shutting down TTS: ${e.message}")
        }
    }
}
