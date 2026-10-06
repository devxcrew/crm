# Mobile Call Log Permission

The administrator Call Logs page uses `READ_CALL_LOG`. Android classifies this permission as dangerous and hard restricted.

CRM shows a disclosure before it requests access. The app reads call history only after the administrator accepts the Android prompt.

CRM keeps call history on the device. The app sends one call record only after the administrator selects an enquiry and taps Attach.

## Google Play distribution

Google Play restricts Call Log permissions. A published build must meet one of these conditions:

1. Make the app the default Phone or Assistant handler and implement that full role.
2. Get approval for an eligible exception, such as an enterprise CRM use case.

Submit the SMS and Call Log Permissions Declaration in Play Console. Include a video that shows the disclosure, permission request, call list, and CRM attachment flow.

Do not publish a build with `READ_CALL_LOG` before Google approves the declaration.

## Managed device distribution

Use Android Enterprise or an approved mobile device management installer for internal devices. The installer must allowlist and grant `READ_CALL_LOG`.

A normal browser download or unknown-source installer might not allowlist this hard-restricted permission. The app cannot bypass this Android rule.

## Verification

Check the installed package state with Android Debug Bridge:

```powershell
adb shell dumpsys package in.techmedia.techmedia_flutter | Select-String READ_CALL_LOG -Context 1,3
adb shell appops get in.techmedia.techmedia_flutter READ_CALL_LOG
```

The package output must show `granted=true` and `RESTRICTION_INSTALLER_EXEMPT`. AppOps must show `allow`.

The mobile app supports Android API 24 through API 36. Devices without telephony can install the app, but the Call Logs page reports that call history is unavailable.

The current repository release build still uses the Android debug signing key. Do not publish this APK to production. Configure a stable private release key before production distribution.
