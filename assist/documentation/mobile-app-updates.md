# Flutter Android App Updates

The Flutter Android app checks this public API endpoint after a user signs in:

`/api/platform/mobile/release/latest.json`

The API serves the release data from `storage/mobile/release`. The directory is runtime storage and
must be mounted persistently on the production host. It is not committed to Git.

The container stack mounts this path through the `techmedia-mobile-releases` named volume. After a
deployment, copy the prepared release directory into the API container's
`/workspace/techmedia/storage/mobile/release` path, then verify the manifest through the public
API endpoint before announcing the update.

## Prepare a portal update

Build the APK and copy it into portal storage with its checksum manifest:

```powershell
C:\Users\sunda\development\flutter\bin\flutter.bat build apk --release --dart-define=API_URL=https://crm.example.com/api/platform --dart-define=APP_VERSION=1.0.49
npm.cmd run flutter:release:portal -- --base-url=https://app.techmedia.in/api/platform
```

The app validates the manifest SHA-256 before opening Android's system installer. Android always
requires the user to approve the install. iOS and desktop releases continue through their signed
distribution channels.
