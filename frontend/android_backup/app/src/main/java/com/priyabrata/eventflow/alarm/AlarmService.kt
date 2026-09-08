package com.priyabrata.eventflow.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.tts.TextToSpeech
import androidx.core.app.NotificationCompat
import java.util.Locale

class AlarmService : Service(), TextToSpeech.OnInitListener {

    private var ringtone: Ringtone? = null
    private var vibrator: Vibrator? = null
    private var tts: TextToSpeech? = null
    private var alarmTitle: String = ""
    private var alarmBody: String = ""

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
            // Use QUEUE_ADD to not interrupt other TTS, but here we want to speak over alarm if needed
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
        val eventId = intent?.getStringExtra("EVENT_ID") ?: ""
        val alarmId = intent?.getStringExtra("ALARM_ID") ?: ""

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

        // Start foreground service with notification
        startForeground(1998, notification)
        
        // Start sound and vibration
        startAlarm()

        // Speak if TTS is already initialized
        if (tts != null) {
            speakAlarm()
        }

        return START_STICKY
    }

    private fun startAlarm() {
        if (ringtone?.isPlaying == true) return
        
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

        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 500, 500), 0))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(longArrayOf(0, 500, 500), 0)
        }
    }

    private fun stopAlarm() {
        ringtone?.takeIf { it.isPlaying }?.stop()
        vibrator?.cancel()
        tts?.stop()
    }

    override fun onDestroy() {
        super.onDestroy()
        stopAlarm()
        tts?.shutdown()
    }
}
