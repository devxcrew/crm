# CRM Mobile App

Flutter is the only CRM mobile client. It communicates through the existing
CRM HTTP and WebSocket API contracts.

## Run on Android

The root `.env` is required for every mobile build. Set the client-specific
`APP_BRAND_NAME`, `MOBILE_APP_BRAND_NAME`, `MOBILE_API_URL`, `MOBILE_RELEASE_BASE_URL`,
`MOBILE_RELEASE_MANIFEST_URL`, `ANDROID_APPLICATION_ID`, and
`MOBILE_RELEASE_FILE_PREFIX`, `MOBILE_LOGO_ASSET`, and
`MOBILE_ANDROID_BRAND_ASSET` before building. Each client needs a separate `.env`.

Run the Flutter app on an Android emulator or connected device:

```powershell
npm.cmd run dev:mobile -- -d emulator-5554
```

The Flutter client receives its API and update URLs only from the root `.env`.

For a client-specific APK, keep the root `.env` for the active deployment and select a checked-in
mobile profile. Profiles override only mobile branding and endpoint values.

```powershell
node tools/flutter-mobile.mjs build-release --mobile-profile=techmedia
node tools/flutter-mobile.mjs build-release --mobile-profile=rainbow
```

## Build and release

```powershell
npm.cmd run mobile:apk:debug
npm.cmd run mobile:apk:release
npm.cmd run mobile:release
```

Set `FLUTTER_BIN` when `flutter` is not available on `PATH`.

## Current slice

- Native Flutter sign-in UI using `POST /auth/login`.
- Encrypted Android session storage backed by the Android Keystore.
- A 4 digit local PIN and optional biometric unlock.
- A 10-day inactivity limit before the app requires the full password again.
- A PIN that remains saved until the user resets it or signs out.
- Server session validation after each PIN or biometric unlock.
- Password confirmation before a user can reset the PIN.
- Live CRM, job, notification, and messaging API flows.
- Separate Android application identity from `ANDROID_APPLICATION_ID`.

The app never stores the account password. It stores only the access token, PIN verifier,
account email, biometric preference, and last activity time in encrypted device storage.

See [Mobile Call Log Permission](../../assist/documentation/mobile-call-log-permission.md) before distributing an administrator build that reads device call history.
