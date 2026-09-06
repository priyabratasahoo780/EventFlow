package com.priyabrata.eventflow.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

class AlarmReceiver : BroadcastReceiver() {
    companion object {
        private const val CHANNEL_ID = "ALARM_CHANNEL_ID"
        private const val CHANNEL_NAME = "Exact Alarms"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "com.priyabrata.eventflow.ALARM_FIRE") {
            val title = intent.getStringExtra("TITLE") ?: "Alarm"
            val body = intent.getStringExtra("BODY") ?: "Time to focus!"
            val eventId = intent.getStringExtra("EVENT_ID") ?: ""
            val alarmId = intent.getStringExtra("ALARM_ID") ?: ""

            Log.d("AlarmReceiver", "Alarm fired for: $title")

            // Acquire WakeLock to wake up device from sleep
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            val wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "EventFlow::AlarmWakeLock"
            )
            wakeLock.acquire(10 * 60 * 1000L /*10 minutes*/)

            // Start the Foreground Service to handle the alarm (sound, vibration, notification)
            val serviceIntent = Intent(context, AlarmService::class.java).apply {
                putExtra("TITLE", title)
                putExtra("BODY", body)
                putExtra("EVENT_ID", eventId)
                putExtra("ALARM_ID", alarmId)
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            
            wakeLock.release()
        }
    }
}
