package com.priyabrata.eventflow.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {
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

            // Launch the full-screen Alarm Activity
            val alarmIntent = Intent(context, AlarmActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                putExtra("TITLE", title)
                putExtra("BODY", body)
                putExtra("EVENT_ID", eventId)
                putExtra("ALARM_ID", alarmId)
            }
            context.startActivity(alarmIntent)
            
            wakeLock.release()
        }
    }
}
