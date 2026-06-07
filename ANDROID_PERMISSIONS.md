# Android Permissions Setup

After running `npx cap add android`, you MUST add these permissions to:
  `android/app/src/main/AndroidManifest.xml`

Paste them INSIDE the `<manifest>` tag, BEFORE the `<application>` tag:

```xml
<!-- ── Location permissions ─────────────────────────────────────────── -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<!-- Required for background geofence auto check-in/out (Android 10+) -->
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- ── Notification permissions ─────────────────────────────────────── -->
<!-- Required on Android 13+ -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- ── Keep app alive for auto check-in/out ─────────────────────────── -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

Also add this INSIDE the `<application>` tag to register the boot receiver:

```xml
<receiver
    android:name="com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver"
    android:exported="false">
    <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED" />
    </intent-filter>
</receiver>
```

## Why these permissions?

| Permission | Why needed |
|---|---|
| `ACCESS_FINE_LOCATION` | Precise GPS for geofence matching |
| `ACCESS_COARSE_LOCATION` | Fallback for network-based location |
| `ACCESS_BACKGROUND_LOCATION` | Auto check-in/out when screen is off |
| `POST_NOTIFICATIONS` | Show check-in/out notifications (Android 13+) |
| `FOREGROUND_SERVICE` | Keep location running in background |
| `FOREGROUND_SERVICE_LOCATION` | Required subtype for Android 14+ |
| `WAKE_LOCK` | Prevent CPU sleep during location checks |
| `RECEIVE_BOOT_COMPLETED` | Restore scheduled notifications after reboot |
