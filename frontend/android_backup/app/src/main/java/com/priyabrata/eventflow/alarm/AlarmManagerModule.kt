package com.priyabrata.eventflow.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.*
import org.json.JSONArray
import org.json.JSONObject

class AlarmManagerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AlarmManagerModule"
        private const val PREFS_NAME = "EventFlowAlarms"
        private const val KEY_SCHEDULED = "scheduled_alarms_json"
    }

    override fun getName(): String {
        return "AlarmManagerModule"
    }

    @ReactMethod
    fun scheduleAlarm(alarmId: String, triggerMs: Double, title: String, body: String, eventId: String, promise: Promise) {
        scheduleAlarmInternal(alarmId, triggerMs, title, body, eventId, false, promise)
    }

    @ReactMethod
    fun scheduleAlarmCritical(alarmId: String, triggerMs: Double, title: String, body: String, eventId: String, isCritical: Boolean, promise: Promise) {
        scheduleAlarmInternal(alarmId, triggerMs, title, body, eventId, isCritical, promise)
    }

    private fun scheduleAlarmInternal(
        alarmId: String,
        triggerMs: Double,
        title: String,
        body: String,
        eventId: String,
        isCritical: Boolean,
        promise: Promise
    ) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

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

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                promise.reject("PERMISSION_DENIED", "Exact alarm permission is missing")
                return
            }

            val triggerTimeLong = triggerMs.toLong()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeLong, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTimeLong, pendingIntent)
            }

            // Persist alarm metadata in SharedPreferences for reboot recovery
            saveAlarmToStorage(context, alarmId, triggerMs, title, body, eventId, isCritical)

            Log.d(TAG, "Exact alarm scheduled successfully: id=$alarmId, triggerMs=$triggerTimeLong, critical=$isCritical")
            promise.resolve("Alarm Scheduled: $alarmId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule alarm: ${e.message}", e)
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun cancelAlarm(alarmId: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val intent = Intent(context, AlarmReceiver::class.java).apply {
                action = "com.priyabrata.eventflow.ALARM_FIRE"
            }

            val pendingIntent = PendingIntent.getBroadcast(
                context,
                alarmId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()

            // Remove from SharedPreferences
            removeAlarmFromStorage(context, alarmId)

            Log.d(TAG, "Alarm cancelled: $alarmId")
            promise.resolve("Alarm Cancelled: $alarmId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cancel alarm: ${e.message}", e)
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun canScheduleExactAlarms(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            promise.resolve(alarmManager.canScheduleExactAlarms())
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun openExactAlarmSettings(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve("Opened Settings")
        } else {
            promise.resolve("Not needed on this OS version")
        }
    }

    private fun saveAlarmToStorage(
        context: Context,
        alarmId: String,
        triggerMs: Double,
        title: String,
        body: String,
        eventId: String,
        isCritical: Boolean
    ) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val jsonStr = prefs.getString(KEY_SCHEDULED, "[]") ?: "[]"
            val array = JSONArray(jsonStr)

            // Remove existing entry with same alarmId if present
            val updated = JSONArray()
            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)
                if (item.optString("alarmId") != alarmId) {
                    updated.put(item)
                }
            }

            // Append new alarm
            val newObj = JSONObject().apply {
                put("alarmId", alarmId)
                put("triggerMs", triggerMs)
                put("title", title)
                put("body", body)
                put("eventId", eventId)
                put("isCritical", isCritical)
            }
            updated.put(newObj)

            prefs.edit().putString(KEY_SCHEDULED, updated.toString()).apply()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to persist alarm to storage: ${e.message}")
        }
    }

    private fun removeAlarmFromStorage(context: Context, alarmId: String) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val jsonStr = prefs.getString(KEY_SCHEDULED, "[]") ?: return
            val array = JSONArray(jsonStr)
            val updated = JSONArray()

            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)
                if (item.optString("alarmId") != alarmId) {
                    updated.put(item)
                }
            }

            prefs.edit().putString(KEY_SCHEDULED, updated.toString()).apply()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to remove alarm from storage: ${e.message}")
        }
    }
}
