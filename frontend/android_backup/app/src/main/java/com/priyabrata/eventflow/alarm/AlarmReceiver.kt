package com.priyabrata.eventflow.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.util.Log
import org.json.JSONArray

class AlarmReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "AlarmReceiver"
        private const val PREFS_NAME = "EventFlowAlarms"
        private const val KEY_SCHEDULED = "scheduled_alarms_json"

        @Volatile
        private var wakeLock: PowerManager.WakeLock? = null

        /**
         * Keeps the CPU awake from the moment an alarm broadcast arrives
         * until AlarmService starts foreground execution.
         */
        @Synchronized
        fun acquireWakeLock(context: Context) {
            try {
                if (wakeLock == null) {
                    val powerManager = context.applicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
                    wakeLock = powerManager.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                        "EventFlow::AlarmReceiverWakeLock"
                    ).apply {
                        setReferenceCounted(false)
                    }
                }
                wakeLock?.acquire(3 * 60 * 1000L) // 3-minute safety timeout
                Log.d(TAG, "WakeLock acquired for alarm delivery")
            } catch (e: Exception) {
                Log.w(TAG, "Failed to acquire WakeLock: ${e.message}")
            }
        }

        /**
         * Called by AlarmService once startForeground is active.
         */
        @Synchronized
        fun releaseWakeLock() {
            try {
                if (wakeLock?.isHeld == true) {
                    wakeLock?.release()
                    Log.d(TAG, "WakeLock safely released by AlarmService")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to release WakeLock: ${e.message}")
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        Log.d(TAG, "onReceive action=$action")

        when (action) {
            "com.priyabrata.eventflow.ALARM_FIRE" -> {
                val title = intent.getStringExtra("TITLE") ?: "Event Reminder"
                val body = intent.getStringExtra("BODY") ?: "Time to focus on your task!"
                val eventId = intent.getStringExtra("EVENT_ID") ?: ""
                val alarmId = intent.getStringExtra("ALARM_ID") ?: ""
                val isCritical = intent.getBooleanExtra("IS_CRITICAL", false)

                Log.d(TAG, "Alarm firing: title=$title, critical=$isCritical, alarmId=$alarmId")

                // Keep CPU awake until AlarmService starts foreground
                acquireWakeLock(context)

                val serviceIntent = Intent(context, AlarmService::class.java).apply {
                    putExtra("TITLE", title)
                    putExtra("BODY", body)
                    putExtra("EVENT_ID", eventId)
                    putExtra("ALARM_ID", alarmId)
                    putExtra("IS_CRITICAL", isCritical)
                }

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start AlarmService: ${e.message}", e)
                    releaseWakeLock()
                }
            }

            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            "com.htc.intent.action.QUICKBOOT_POWERON" -> {
                Log.d(TAG, "Device rebooted. Rescheduling active alarms from storage.")
                rescheduleAllAlarms(context)
            }
        }
    }

    private fun rescheduleAllAlarms(context: Context) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val jsonStr = prefs.getString(KEY_SCHEDULED, null) ?: return
            val array = JSONArray(jsonStr)
            val nowMs = System.currentTimeMillis()
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val updatedArray = JSONArray()

            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val alarmId = obj.getString("alarmId")
                val triggerMs = obj.getDouble("triggerMs").toLong()
                val title = obj.getString("title")
                val body = obj.getString("body")
                val eventId = obj.optString("eventId", "")
                val isCritical = obj.optBoolean("isCritical", false)

                if (triggerMs > nowMs) {
                    val intent = Intent(context, AlarmReceiver::class.java).apply {
                        action = "com.priyabrata.eventflow.ALARM_FIRE"
                        putExtra("ALARM_ID", alarmId)
                        putExtra("TITLE", title)
                        putExtra("BODY", body)
                        putExtra("EVENT_ID", eventId)
                        putExtra("IS_CRITICAL", isCritical)
                    }

                    val pendingIntent = PendingIntent.getBroadcast(
                        context,
                        alarmId.hashCode(),
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pendingIntent)
                    } else {
                        alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerMs, pendingIntent)
                    }

                    updatedArray.put(obj)
                    Log.d(TAG, "Rescheduled alarm $alarmId for ${triggerMs - nowMs}ms in the future")
                }
            }

            prefs.edit().putString(KEY_SCHEDULED, updatedArray.toString()).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to reschedule alarms on boot: ${e.message}", e)
        }
    }
}
