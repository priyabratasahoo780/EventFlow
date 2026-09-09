package com.priyabrata.eventflow.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

/**
 * ActivityTransitionReceiver.kt
 * EC3 — Receives activity transition broadcast from ActivityRecognition API.
 * Inspects the transition result and emits a React Native event
 * (via ActivityTransitionModule) when IN_VEHICLE -> ON_FOOT/WALKING is detected.
 */
class ActivityTransitionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (!ActivityTransitionResult.hasResult(intent)) return

        val result = ActivityTransitionResult.extractResult(intent) ?: return

        for (event in result.transitionEvents) {
            Log.d("ActivityTransitionReceiver",
                "EC3: Activity event — type=, transition=")

            // We care about the user exiting IN_VEHICLE (i.e. they just parked)
            val isVehicleExit = event.activityType == DetectedActivity.IN_VEHICLE &&
                    event.transitionType == com.google.android.gms.location.ActivityTransition.ACTIVITY_TRANSITION_EXIT

            if (isVehicleExit) {
                Log.d("ActivityTransitionReceiver",
                    "EC3: 🅿️ Vehicle EXIT detected — triggering network-based geofence check")

                // Find the ActivityTransitionModule instance via the ReactNativeHost
                try {
                    val app = context.applicationContext
                    val reactNativeHost = (app as? com.facebook.react.ReactApplication)?.reactNativeHost
                    val reactInstanceManager = reactNativeHost?.reactInstanceManager
                    val catalystInstance = reactInstanceManager?.currentReactContext?.catalystInstance

                    if (catalystInstance != null) {
                        val module = reactInstanceManager.currentReactContext
                            ?.getNativeModule(ActivityTransitionModule::class.java)
                        module?.emitVehicleToWalkingEvent()
                    } else {
                        Log.w("ActivityTransitionReceiver", "EC3: React context not available — app may be in background")
                    }
                } catch (e: Exception) {
                    Log.e("ActivityTransitionReceiver", "EC3: Error emitting event: ")
                }
            }
        }
    }
}
