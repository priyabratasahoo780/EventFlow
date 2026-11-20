package com.priyabrata.eventflow.alarm

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class AlarmActivity : AppCompatActivity() {

    private val animators = mutableListOf<ValueAnimator>()

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
        val body = intent.getStringExtra("BODY") ?: "It's time to focus on your task!"

        val topPill = findViewById<LinearLayout>(resources.getIdentifier("topPill", "id", packageName))
        val pulseRing1 = findViewById<View>(resources.getIdentifier("pulseRing1", "id", packageName))
        val pulseRing2 = findViewById<View>(resources.getIdentifier("pulseRing2", "id", packageName))
        val bellBadge = findViewById<FrameLayout>(resources.getIdentifier("bellBadge", "id", packageName))
        val bellIcon = findViewById<TextView>(resources.getIdentifier("bellIcon", "id", packageName))
        val infoCard = findViewById<LinearLayout>(resources.getIdentifier("infoCard", "id", packageName))
        val titleView = findViewById<TextView>(resources.getIdentifier("alarmTitle", "id", packageName))
        val bodyView = findViewById<TextView>(resources.getIdentifier("alarmBody", "id", packageName))
        val dismissBtn = findViewById<Button>(resources.getIdentifier("alarmDismiss", "id", packageName))

        titleView?.text = title
        bodyView?.text = body

        // --- 1. Style UI with modern gradients & glassmorphism programmatically ---
        applyModernStyles(topPill, pulseRing1, pulseRing2, bellBadge, infoCard, dismissBtn)

        // --- 2. Start Attractive Bell Swinging & Pulsing Animations ---
        startBellRingingAnimation(bellIcon, bellBadge)
        startRadarWaveAnimations(pulseRing1, pulseRing2)

        dismissBtn?.setOnClickListener {
            stopAlarmService()
            finish()
        }
    }

    private fun applyModernStyles(
        topPill: LinearLayout?,
        pulseRing1: View?,
        pulseRing2: View?,
        bellBadge: FrameLayout?,
        infoCard: LinearLayout?,
        dismissBtn: Button?
    ) {
        val density = resources.displayMetrics.density

        // Top Alert Capsule
        topPill?.background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 50f * density
            setColor(Color.parseColor("#25FF4D4D"))
            setStroke((1.5f * density).toInt(), Color.parseColor("#50FF4D4D"))
        }

        // Concentric Radar Rings
        pulseRing1?.background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.parseColor("#20FF7A00"))
            setStroke((2f * density).toInt(), Color.parseColor("#90FF7A00"))
        }

        pulseRing2?.background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.parseColor("#12FF3B30"))
            setStroke((1.5f * density).toInt(), Color.parseColor("#60FF3B30"))
        }

        // Bell Glowing Badge
        bellBadge?.background = GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            intArrayOf(Color.parseColor("#FF9500"), Color.parseColor("#FF3B30"))
        ).apply {
            shape = GradientDrawable.OVAL
        }
        bellBadge?.elevation = 16f * density

        // Info Glassmorphic Card
        infoCard?.background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 24f * density
            setColor(Color.parseColor("#151528"))
            setStroke((1.5f * density).toInt(), Color.parseColor("#2E2E4A"))
        }

        // Stop Alarm Button
        dismissBtn?.background = GradientDrawable(
            GradientDrawable.Orientation.LEFT_RIGHT,
            intArrayOf(Color.parseColor("#FF7A00"), Color.parseColor("#FF3B30"))
        ).apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 32f * density
        }
        dismissBtn?.elevation = 10f * density
    }

    private fun startBellRingingAnimation(bellIcon: TextView?, bellBadge: FrameLayout?) {
        // Bell Pendulum Swing (Hilna / Swinging effect)
        bellIcon?.post {
            // Anchor pivot at top-center of bell so it swings like a real pendulum
            bellIcon.pivotX = bellIcon.width / 2f
            bellIcon.pivotY = bellIcon.height * 0.12f

            val swing = ObjectAnimator.ofFloat(
                bellIcon,
                "rotation",
                0f, -28f, 28f, -24f, 24f, -16f, 16f, -8f, 8f, 0f
            ).apply {
                duration = 1000
                repeatCount = ValueAnimator.INFINITE
                repeatMode = ValueAnimator.RESTART
                interpolator = AccelerateDecelerateInterpolator()
            }
            animators.add(swing)
            swing.start()
        }

        // Bell Badge Pulse / Bounce
        bellBadge?.let { badge ->
            val scaleX = ObjectAnimator.ofFloat(badge, "scaleX", 1f, 1.07f, 1f).apply {
                duration = 1000
                repeatCount = ValueAnimator.INFINITE
                interpolator = AccelerateDecelerateInterpolator()
            }
            val scaleY = ObjectAnimator.ofFloat(badge, "scaleY", 1f, 1.07f, 1f).apply {
                duration = 1000
                repeatCount = ValueAnimator.INFINITE
                interpolator = AccelerateDecelerateInterpolator()
            }
            animators.add(scaleX)
            animators.add(scaleY)
            AnimatorSet().apply {
                playTogether(scaleX, scaleY)
                start()
            }
        }
    }

    private fun startRadarWaveAnimations(ring1: View?, ring2: View?) {
        startSinglePulse(ring1, 0)
        startSinglePulse(ring2, 600)
    }

    private fun startSinglePulse(view: View?, delayMs: Long) {
        if (view == null) return
        val scaleX = ObjectAnimator.ofFloat(view, "scaleX", 0.95f, 2.05f).apply {
            duration = 1800
            repeatCount = ValueAnimator.INFINITE
            interpolator = DecelerateInterpolator()
        }
        val scaleY = ObjectAnimator.ofFloat(view, "scaleY", 0.95f, 2.05f).apply {
            duration = 1800
            repeatCount = ValueAnimator.INFINITE
            interpolator = DecelerateInterpolator()
        }
        val alpha = ObjectAnimator.ofFloat(view, "alpha", 0.85f, 0f).apply {
            duration = 1800
            repeatCount = ValueAnimator.INFINITE
            interpolator = DecelerateInterpolator()
        }
        animators.add(scaleX)
        animators.add(scaleY)
        animators.add(alpha)

        AnimatorSet().apply {
            playTogether(scaleX, scaleY, alpha)
            startDelay = delayMs
            start()
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
        // Stop all animations to prevent memory leaks
        animators.forEach { it.cancel() }
        animators.clear()
        stopAlarmService()
    }
}
