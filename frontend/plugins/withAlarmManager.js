/**
 * withAlarmManager.js
 * Expo Config Plugin — ensures AlarmReceiver, AlarmActivity, and all
 * required permissions are in the generated AndroidManifest.xml when
 * running `npx expo run:android` or `eas build`.
 *
 * NOTE: The android_backup folder already contains these edits.
 * This plugin handles FRESH `npx expo prebuild` regeneration.
 */
const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

// --- 1. AndroidManifest entries -----------------------------------------------
const withAlarmManifest = (config) => {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    // Add AlarmReceiver
    const receivers = application.receiver || [];
    const hasReceiver = receivers.some(
      (r) => r.$?.["android:name"] === ".alarm.AlarmReceiver"
    );
    if (!hasReceiver) {
      receivers.push({
        $: {
          "android:name": ".alarm.AlarmReceiver",
          "android:exported": "true",
          "android:enabled": "true",
        },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "com.priyabrata.eventflow.ALARM_FIRE" } },
              { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
              { $: { "android:name": "android.intent.action.LOCKED_BOOT_COMPLETED" } },
            ],
          },
        ],
      });
    }

    // Add ActivityTransitionReceiver
    const hasTransitionReceiver = receivers.some(
      (r) => r.$?.["android:name"] === ".alarm.ActivityTransitionReceiver"
    );
    if (!hasTransitionReceiver) {
      receivers.push({
        $: {
          "android:name": ".alarm.ActivityTransitionReceiver",
          "android:exported": "false",
        },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "com.priyabrata.eventflow.ACTIVITY_TRANSITION" } },
            ],
          },
        ],
      });
    }

    application.receiver = receivers;

    // Add AlarmActivity
    const activities = application.activity || [];
    const hasAlarmActivity = activities.some(
      (a) => a.$?.["android:name"] === ".alarm.AlarmActivity"
    );
    if (!hasAlarmActivity) {
      activities.push({
        $: {
          "android:name": ".alarm.AlarmActivity",
          "android:exported": "false",
          "android:launchMode": "singleInstance",
          "android:showOnLockScreen": "true",
          "android:screenOrientation": "portrait",
          "android:theme": "@style/Theme.AppCompat.NoActionBar",
          "android:excludeFromRecents": "true",
          "android:taskAffinity": "com.priyabrata.eventflow.alarm",
        },
      });
    }
    application.activity = activities;

    // Add AlarmService
    const services = application.service || [];
    const hasAlarmService = services.some(
      (s) => s.$?.["android:name"] === ".alarm.AlarmService"
    );
    if (!hasAlarmService) {
      services.push({
        $: {
          "android:name": ".alarm.AlarmService",
          "android:exported": "false",
          "android:foregroundServiceType": "mediaPlayback",
        },
      });
    }
    application.service = services;

    return config;
  });
};

// --- 2. Copy Kotlin sources into generated android/ folder --------------------
const withAlarmKotlinFiles = (config) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const packagePath = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/java/com/priyabrata/eventflow/alarm"
      );
      fs.mkdirSync(packagePath, { recursive: true });

      const srcDir = path.join(__dirname, "..", "android_backup/app/src/main/java/com/priyabrata/eventflow/alarm");
      if (fs.existsSync(srcDir)) {
        for (const file of fs.readdirSync(srcDir)) {
          fs.copyFileSync(path.join(srcDir, file), path.join(packagePath, file));
        }
      }

      // Copy layout XML
      const layoutSrc = path.join(
        __dirname, "..", "android_backup/app/src/main/res/layout/activity_alarm.xml"
      );
      const layoutDst = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/layout"
      );
      fs.mkdirSync(layoutDst, { recursive: true });
      if (fs.existsSync(layoutSrc)) {
        fs.copyFileSync(layoutSrc, path.join(layoutDst, "activity_alarm.xml"));
      }

      // Patch MainApplication.kt to register AlarmManagerPackage
      const mainAppPath = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/java/com/priyabrata/eventflow/MainApplication.kt"
      );
      if (fs.existsSync(mainAppPath)) {
        let src = fs.readFileSync(mainAppPath, "utf8");
        if (!src.includes("AlarmManagerPackage")) {
          src = src.replace(
            "import expo.modules.ApplicationLifecycleDispatcher",
            "import com.priyabrata.eventflow.alarm.AlarmManagerPackage\nimport expo.modules.ApplicationLifecycleDispatcher"
          );
          src = src.replace(
            "PackageList(this).packages.apply {",
            "PackageList(this).packages.apply {\n              add(AlarmManagerPackage())"
          );
          fs.writeFileSync(mainAppPath, src, "utf8");
        }
      }

      return config;
    },
  ]);
};

module.exports = (config) => {
  config = withAlarmManifest(config);
  config = withAlarmKotlinFiles(config);
  return config;
};
