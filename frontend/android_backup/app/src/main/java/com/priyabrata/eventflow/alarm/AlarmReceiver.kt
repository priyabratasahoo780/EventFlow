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

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Create Notification Channel for Android O and above
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Channel for exact alarms that wake up the device"
                    setBypassDnd(true) // Bypass Do Not Disturb if possible
                }
                notificationManager.createNotificationChannel(channel)
            }

            // Create PendingIntent for the full-screen Alarm Activity
            val alarmIntent = Intent(context, AlarmActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                putExtra("TITLE", title)
                putExtra("BODY", body)
                putExtra("EVENT_ID", eventId)
                putExtra("ALARM_ID", alarmId)
            }

            val pendingIntent = PendingIntent.getActivity(
                context,
                alarmId.hashCode(),
                alarmIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Resolve the small icon resource id dynamically
            val iconResId = context.resources.getIdentifier(
                "ic_notification", "drawable", context.packageName
            ).takeIf { it != 0 } ?: context.applicationInfo.icon

            // Build the Notification with setFullScreenIntent
            val notification: Notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(iconResId)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setFullScreenIntent(pendingIntent, true) // <--- THIS IS THE MAGIC THAT BYPASSES ANDROID RESTRICTIONS
                .setAutoCancel(true)
                .build()

            // Fire the notification
            notificationManager.notify(alarmId.hashCode(), notification)
            
            wakeLock.release()
        }
    }
}
