package com.priyabrata.eventflow.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.tts.TextToSpeech
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.Locale

class AlarmService : Service(), TextToSpeech.OnInitListener {

    private var ringtone: Ringtone? = null
    private var vibrator: Vibrator? = null
    private var tts: TextToSpeech? = null
    private var alarmTitle: String = ""
    private var alarmBody: String = ""
    private var isCritical: Boolean = false

    // EC5: Cache original volume so we can restore it after the alarm stops
    private var originalAlarmVolume: Int = -1
    private var volumeOverridden: Boolean = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        tts = TextToSpeech(this, this)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts?.language = Locale.getDefault()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
                tts?.setAudioAttributes(audioAttributes)
            }
            speakAlarm()
        }
    }

    private fun speakAlarm() {
        if (alarmTitle.isNotEmpty() || alarmBody.isNotEmpty()) {
            val textToSpeak = "Alarm: $alarmTitle. $alarmBody"
            val params = Bundle()
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f)
            tts?.speak(textToSpeak, TextToSpeech.QUEUE_FLUSH, params, "AlarmTTS")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == "STOP_ALARM") {
            stopAlarm()
            stopSelf()
            return START_NOT_STICKY
        }

        alarmTitle = intent?.getStringExtra("TITLE") ?: "Event Reminder"
        alarmBody = intent?.getStringExtra("BODY") ?: "It's time!"
        isCritical = intent?.getBooleanExtra("IS_CRITICAL", false) ?: false
        val eventId = intent?.getStringExtra("EVENT_ID") ?: ""
        val alarmId = intent?.getStringExtra("ALARM_ID") ?: ""

        Log.d("AlarmService", "Alarm starting: $alarmTitle | critical=$isCritical")

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "ALARM_SERVICE_CHANNEL"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Exact Alarms",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Channel for exact alarms"
                setBypassDnd(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val alarmIntent = Intent(this, AlarmActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            putExtra("TITLE", alarmTitle)
            putExtra("BODY", alarmBody)
            putExtra("EVENT_ID", eventId)
            putExtra("ALARM_ID", alarmId)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            alarmId.hashCode(),
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

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

        val notification: Notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(iconResId)
            .setContentTitle(alarmTitle)
            .setContentText(alarmBody)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(pendingIntent, true)
            .addAction(0, "Dismiss", stopPendingIntent)
            .setOngoing(true)
            .build()

        startForeground(1998, notification)

        // ==== EC5: Critical Volume Override ====
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val ringerMode = audioManager.ringerMode

        if (isCritical && ringerMode != AudioManager.RINGER_MODE_NORMAL) {
            // Critical task + phone is silent or vibrate â†’ OVERRIDE volume to max
            try {
                originalAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM)
                audioManager.setStreamVolume(
                    AudioManager.STREAM_ALARM,
                    audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM),
                    0 // No UI flag â€” silent override
                )
                volumeOverridden = true
                Log.d("AlarmService", "EC5: ðŸ”Š Critical alarm â€” volume overridden to MAX (was $originalAlarmVolume)")
            } catch (e: SecurityException) {
                Log.w("AlarmService", "EC5: Volume override failed (SecurityException). Proceeding without it.")
            }
            startAlarm(aggressive = true)
        } else if (!isCritical && ringerMode == AudioManager.RINGER_MODE_SILENT) {
            // Routine task + phone is fully silent â†’ silent push only (no ringtone, no TTS)
            // Just a gentle single vibration to avoid interrupting meetings
            Log.d("AlarmService", "EC5: ðŸ¤« Routine task on silent phone â€” using silent vibration only.")
            startAlarm(aggressive = false)
            return START_STICKY
        } else {
            // Normal behaviour (phone is not silent, OR phone is vibrate-only for a routine task)
            startAlarm(aggressive = false)
        }
        // =======================================

        // Speak if TTS is already initialized (may also be called from onInit)
        if (tts != null) {
            speakAlarm()
        }

        return START_STICKY
    }

    /**
     * @param aggressive If true, uses violent/looping vibration pattern for critical tasks.
     *                   If false, uses a single short pulse (or skips audio for truly silent phones).
     */
    private fun startAlarm(aggressive: Boolean) {
        if (ringtone?.isPlaying == true) return

        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val ringerMode = audioManager.ringerMode

        // Only play ringtone if not completely silent (or if critical override already bumped volume)
        val shouldPlayRingtone = volumeOverridden || ringerMode == AudioManager.RINGER_MODE_NORMAL

        if (shouldPlayRingtone) {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ringtone = RingtoneManager.getRingtone(applicationContext, uri)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ringtone?.isLooping = true
            }
            ringtone?.audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            ringtone?.play()
        }

        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (aggressive) {
            // Critical: long, intense repeating pattern
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 800, 200, 800, 200, 800), 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(longArrayOf(0, 800, 200, 800, 200, 800), 0)
            }
        } else {
            // Routine or silent: single short buzz
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(300, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(300)
            }
        }
    }

    private fun stopAlarm() {
        ringtone?.takeIf { it.isPlaying }?.stop()
        vibrator?.cancel()
        tts?.stop()

        // EC5: Restore original volume if we overrode it
        if (volumeOverridden && originalAlarmVolume >= 0) {
            try {
                val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, originalAlarmVolume, 0)
                Log.d("AlarmService", "EC5: ðŸ”‰ Volume restored to $originalAlarmVolume")
            } catch (e: SecurityException) {
                Log.w("AlarmService", "EC5: Volume restore failed.")
            } finally {
                volumeOverridden = false
                originalAlarmVolume = -1
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopAlarm()
        tts?.shutdown()
    }
}
