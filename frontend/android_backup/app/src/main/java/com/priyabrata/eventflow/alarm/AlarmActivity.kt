package com.priyabrata.eventflow.alarm

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class AlarmActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Ensure this activity shows over the lock screen and turns the screen on
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }

        // Get the layout by name dynamically to avoid missing R.layout references during prebuild
        val layoutResId = resources.getIdentifier("activity_alarm", "layout", packageName)
        setContentView(layoutResId)

        val title = intent.getStringExtra("TITLE") ?: "Event Reminder"
        val body = intent.getStringExtra("BODY") ?: "It's time!"

        val titleView = findViewById<TextView>(resources.getIdentifier("alarmTitle", "id", packageName))
        val bodyView = findViewById<TextView>(resources.getIdentifier("alarmBody", "id", packageName))
        val dismissBtn = findViewById<Button>(resources.getIdentifier("alarmDismiss", "id", packageName))

        titleView?.text = title
        bodyView?.text = body

        dismissBtn?.setOnClickListener {
            stopAlarmService()
            finish()
        }
    }

    private fun stopAlarmService() {
        val stopIntent = Intent(this, AlarmService::class.java).apply {
            action = "STOP_ALARM"
        }
        startService(stopIntent)
    }

    override fun onDestroy() {
        super.onDestroy()
        // If the activity is destroyed (e.g. user swiped it away), we should ensure the alarm stops
        stopAlarmService()
    }
}
