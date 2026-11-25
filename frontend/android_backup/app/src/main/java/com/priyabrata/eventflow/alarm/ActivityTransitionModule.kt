package com.priyabrata.eventflow.alarm

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

/**
 * ActivityTransitionModule.kt
 * Native module for Android Activity Recognition transitions.
 */
class ActivityTransitionModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "ActivityTransitionModule"
        const val TRANSITION_ACTION = "com.priyabrata.eventflow.ACTIVITY_TRANSITION"
        private const val TAG = "ActivityTransitionModule"
    }

    override fun getName(): String = MODULE_NAME

    /**
     * Start listening for IN_VEHICLE → ON_FOOT activity transitions.
     * Called from JS once the app is ready.
     */
    @ReactMethod
    fun startActivityTransitionUpdates(promise: Promise) {
        try {
            val transitions = listOf(
                ActivityTransition.Builder()
                    .setActivityType(DetectedActivity.IN_VEHICLE)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
                    .build(),
                ActivityTransition.Builder()
                    .setActivityType(DetectedActivity.ON_FOOT)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                    .build(),
                ActivityTransition.Builder()
                    .setActivityType(DetectedActivity.WALKING)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                    .build()
            )

            val request = ActivityTransitionRequest(transitions)

            val intent = Intent(reactContext, ActivityTransitionReceiver::class.java).apply {
                action = TRANSITION_ACTION
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            else
                PendingIntent.FLAG_UPDATE_CURRENT

            val pendingIntent = PendingIntent.getBroadcast(reactContext, 0, intent, flags)

            ActivityRecognition.getClient(reactContext)
                .requestActivityTransitionUpdates(request, pendingIntent)
                .addOnSuccessListener {
                    Log.d(TAG, "EC3: ✅ Activity transition updates registered.")
                    promise.resolve("Activity transitions registered")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "EC3: ❌ Failed to register activity transitions: ")
                    promise.reject("ERROR", e.message)
                }

        } catch (e: Exception) {
            Log.e(TAG, "EC3: Exception registering activity transitions: ")
            promise.reject("EXCEPTION", e.message)
        }
    }

    @ReactMethod
    fun stopActivityTransitionUpdates(promise: Promise) {
        try {
            val intent = Intent(reactContext, ActivityTransitionReceiver::class.java).apply {
                action = TRANSITION_ACTION
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            else
                PendingIntent.FLAG_UPDATE_CURRENT

            val pendingIntent = PendingIntent.getBroadcast(reactContext, 0, intent, flags)
            ActivityRecognition.getClient(reactContext)
                .removeActivityTransitionUpdates(pendingIntent)
                .addOnSuccessListener { promise.resolve("Stopped") }
                .addOnFailureListener { e -> promise.reject("ERROR", e.message) }
        } catch (e: Exception) {
            promise.reject("EXCEPTION", e.message)
        }
    }

    /**
     * Called by ActivityTransitionReceiver when IN_VEHICLE → WALKING transition fires.
     * Emits a React Native event to the JS layer.
     */
    fun emitVehicleToWalkingEvent() {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("ActivityTransition_VehicleToWalking", null)
            Log.d(TAG, "EC3: 📡 Emitted ActivityTransition_VehicleToWalking to JS layer")
        } catch (e: Exception) {
            Log.e(TAG, "EC3: Failed to emit transition event: ")
        }
    }

    // Required for NativeEventEmitter on JS side
    @ReactMethod
    fun addListener(eventName: String) { /* no-op */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* no-op */ }
}
