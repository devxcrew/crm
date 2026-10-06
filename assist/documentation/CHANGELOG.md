# Changelog

## Version State

Current version: 1.0.119

Release tag: v-1.0.119

Changelog label: v 1.0.119

This changelog starts with TechMedia as an independent application composed from
`framework + ui + core + platform`. Source-project release history is not TechMedia release history.

New entries must keep database-facing work and application code work separate.

## Unreleased

## v-1.0.119

### [v 1.0.119] 2026-09-22 4:59 pm - Database-backed Frappe connection

#### Database Changes

- Database update: Yes. Run the standard application migration to create `frappe_connection_settings`.

#### App Codebase Changes

- Bumped repository version to 1.0.119.
- Added the database-owned Frappe application-connection record; its credentials are encrypted before storage and are never returned by the API.
- Persisted Frappe verification results in that same record so the live/offline badge survives a browser refresh.
- Changed fresh-install defaults to create `admin@admin.com` as the protected `super-admin` when `INITIAL_ADMIN_PASSWORD` is supplied.
- Updated TechMedia and Rainbow deployment templates to use the same protected administrator account default.

## v-1.0.118

### [v 1.0.118] 2026-09-22 3:48 pm - Docker installation reliability

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.118.
- Replaced Docker's global npm self-update with a temporary npm 12 execution so builds do not stall while replacing npm itself.
- Reused the completed build stage for the API runtime to avoid a second package-manager installation during each client build.
- Consolidated TechMedia and Rainbow Docker configuration around one private `.env` file and one tracked `.env.example` file per client.
- Updated web, API, Flutter mobile, and both client deployment image-version references to 1.0.118.

## v-1.0.117

### [v 1.0.117] 2026-09-22 12:20 pm - Rainbow mobile branding and live profile

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository and Flutter mobile versions to 1.0.117.
- Added environment-driven mobile display branding, Android native branding profiles, and image-format-aware Flutter logo rendering.
- Configured the Rainbow profile for the live `rgm.tmnext.in` platform and mobile-update domains.
- Added the Rainbow CRM launcher and splash branding, using the supplied circular mark.
- Added isolated `techmedia` and `rainbow` mobile profiles so their package IDs, API and update domains, display brands, and logo assets cannot cross during a profile build.
- Added separate Tech Media and Rainbow Docker deployment folders with isolated Compose resources and setup/update scripts.

## v-1.0.116

### [v 1.0.116] 2026-09-22 10:42 am - Generic client mobile environment keys

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.116.
- Renamed all client-facing mobile profile keys and Dart build defines to generic names without the `TECHMEDIA_` prefix.
- Kept internal deployment safety and database guard variables unchanged.

## v-1.0.115

### [v 1.0.115] 2026-09-22 10:34 am - Environment-driven client mobile profile

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.115.
- Made Flutter brand, API URL, update URLs, Android application ID, native channel prefix, and release filename derive from the root `.env`.
- Removed fixed client branding and endpoint fallbacks from the Flutter build and runtime configuration.
- Required each client profile to define its own mobile values before build or release.
- Removed client brand fallbacks from the API and web build, and made mobile release publishing use the profile-defined filename and release notes.

## v-1.0.114

### [v 1.0.114] 2026-09-22 10:12 am - Focused app launcher

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.114.
- Removed the Account tile from the app launcher.
- Kept account and profile access available through the user menu.

## v-1.0.113

### [v 1.0.113] 2026-09-22 10:08 am - Synchronized app branding environment

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.113.
- Updated App branding saves to synchronize `APP_BRAND_NAME` and `APP_BRAND_TAGLINE` to the runtime `.env` file.
- Updated the in-process runtime values immediately, preserving the chosen brand through API restarts and Docker deployments.
- Reused one queued, allowlisted runtime environment writer for Branding and Frappe settings.

## v-1.0.112

### [v 1.0.112] 2026-09-22 10:00 am - Super-admin app branding

#### Database Changes

- Added the singleton `app_branding_settings` table.
- Added the forward `app.branding.settings-v1` migration and repeatable default seed.

#### App Codebase Changes

- Bumped repository version to 1.0.112.
- Added a super-admin-only App branding setting directly below Identity in the side menu.
- Connected the persisted title and tagline to the login layouts and application sidebar.
- Kept `.env` branding values as first-install defaults without overwriting saved client branding.

## v-1.0.111

### [v 1.0.111] 2026-09-22 9:44 am - Hide Messages navigation

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.111.
- Removed Messages from all web side-menu layouts.
- Kept messaging routes and direct-link access unchanged.

## v-1.0.110

### [v 1.0.110] 2026-09-22 9:43 am - Hide TEMA and Docs navigation

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.110.
- Removed TEMA AI and Docs from the web side menu.
- Disabled the shared web TEMA pet for all users.
- Kept the hidden routes and their permissions unchanged.

## v-1.0.109

### [v 1.0.109] 2026-09-22 9:41 am - Focused app picker

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.109.
- Removed Messaging, Docs, iShop, and TEMA from the application picker.
- Kept the existing routes, permissions, and side-menu access unchanged.

## v-1.0.108

### [v 1.0.108] 2026-09-22 9:36 am - Schedule date property edit

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.108.
- Added a Schedule date editor to enquiry properties for users with CRM update permission.
- Saved the selected Schedule date through the live enquiry update contract.
- Renamed the enquiry detail label from Schedules to Schedule date.

## v-1.0.107

### [v 1.0.107] 2026-09-20 9:30 pm - Client branding and TMApp diagnostic

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.107.
- Added `APP_BRAND_NAME` to the root environment configuration and example file.
- Applied the configured brand to web login surfaces, sidebar branding, browser titles, Flutter authentication text, and Android launcher labels.
- Removed Frappe wording from the login page.
- Changed the diagnostic Android package to `in.techmedia.tmapp` so it can install beside TechMedia.
- Removed Firebase Core, Firebase Messaging, FCM token registration, and the Google Services build plugin.
- Kept local notifications, live messaging, and API polling available without Firebase.

## v-1.0.106

### [v 1.0.106] 2026-09-03 10:48 pm - CRM enquiry status edit fix

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.106.
- Updated the Flutter application version to 1.0.106+106.
- Fixed enquiry property saves when existing comments are blank or exceed new-comment limits.
- Kept comment history out of property update requests and preserved existing status details.
- Added regression tests for New-to-Closed edits, large comment histories, and live status values.

## v-1.0.105

### [v 1.0.105] 2026-09-03 12:26 am - Ascending chat order and notification fallback

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.105.
- Rendered mobile conversation messages from oldest to newest.
- Marked the newest loaded message as read.
- Kept local unread-chat notification fallback active while WebSocket reconnects.

## v-1.0.104

### [v 1.0.104] 2026-09-03 12:18 am - Centered dock badges and chat notification fallback

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.104.
- Kept each dock icon centered when a notification badge is visible.
- Replaced the Material badge layout with a positioned badge overlay.
- Added a 20-second unread-chat refresh fallback when the WebSocket is unavailable.
- Kept FCM foreground chat alerts and Android notification permission support enabled.

## v-1.0.103

### [v 1.0.103] 2026-09-03 12:11 am - Light mobile dock separator

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.103.
- Removed the dock Material shadow and surface tint.
- Changed the dock separator to a near-background light color.

## v-1.0.102

### [v 1.0.102] 2026-09-02 11:59 pm - Notification delivery database and WebSocket fix

#### Database Changes

- Changed `notifications.uuid` from `VARCHAR(32)` to `VARCHAR(36)`.
- Added a forward migration key for the notification UUID correction.

#### App Codebase Changes

- Bumped repository version to 1.0.102.
- Added a dedicated WebSocket proxy for `/api/platform/ws/messaging`.
- Forwarded WebSocket upgrade headers and increased the WebSocket read timeout.

## v-1.0.101

### [v 1.0.101] 2026-09-02 11:25 pm - Firebase device-token registration fix

#### Database Changes

- Changed `notification_device_tokens.uuid` from `VARCHAR(32)` to `VARCHAR(36)`.
- Added a forward migration key for the UUID column correction.

#### App Codebase Changes

- Bumped repository version to 1.0.101.
- Recorded the live device-token registration failure without storing an FCM device token in the changelog.
- Retried device registration after a saved session is restored.

## v-1.0.100

### [v 1.0.100] 2026-09-02 9:57 pm - Firebase cloud notifications

#### Database Changes

- Added device-token storage for authenticated mobile users.
- Added a forward migration for Firebase Cloud Messaging token registration.

#### App Codebase Changes

- Bumped repository version to 1.0.100.
- Registered Firebase device tokens after mobile sign-in and token refresh.
- Added cloud FCM delivery for assigned enquiries and new chat messages.
- Removed expired FCM device tokens after Firebase rejects them.
- Added the protected `FIREBASE_SERVICE_ACCOUNT_JSON` cloud setting and deployment guidance.

## v-1.0.99

### [v 1.0.99] 2026-09-02 9:31 pm - Firebase mobile notifications

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.99.
- Added the Firebase Android configuration for the TechMedia app package.
- Added Firebase Core and Firebase Messaging startup and background-message initialization.
- Added Android notification permission handling and a high-priority TechMedia notification channel.
- Show foreground system notifications for live chat messages and unread job assignments.
- Show unread Job and Chat counts in the persistent mobile dock.
- Retained API notification polling as the current assignment source while server-side FCM delivery is prepared.

## v-1.0.98

### [v 1.0.98] 2026-09-02 8:53 pm - Mobile party lookup and optional customer mapping

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.98.
- Removed the required Customer field from the unified mobile enquiry form.
- Added an optional exact-mobile lookup that searches live ERPNext Customer and Supplier records.
- Show every matching party in the mobile selection drawer with its Customer or Supplier type.
- Save a selected Customer to the ERPNext enquiry Customer field.
- Show a selected Supplier in the preview without writing it to the Customer-only ERPNext field.
- Replaced the Contact-based lookup API with the live CRM party-by-mobile contract.
- Updated the Flutter fallback version so the lock screen and account menu report the current release.

## v-1.0.97

### [v 1.0.97] 2026-09-02 3:17 pm - Mobile contact lookup and enquiry refinements

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.97.
- Added a session-only preview visibility toggle and a dark Save action with white text to the shared mobile enquiry form.
- Added a contact drawer that shows loading, an exact-number match with a Use customer action, or a clear no-contact result.
- Added the live CRM customer-by-mobile API contract, resolving ERPNext Contact.mobile_no through its linked Customer record.
- Displayed the configured app version in both the account menu and subtly at the bottom of the mobile unlock screen.

## v-1.0.96

### [v 1.0.96] 2026-09-02 2:32 pm - Unified mobile enquiry form

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.96.
- Routed Home, My Enquiries, Call Log, and Call Notes creation actions to one New Enquiry form.
- Added a bordered Save control in the top-right app bar and removed the duplicate bottom creation action.
- Standardized the form order as preview, phone number, customer, list, allocated employee, and message.
- Prefilled call-derived phone number, contact name, and rough call note text in the shared form.

## v-1.0.95

### [v 1.0.95] 2026-09-02 2:17 pm - Mobile enquiry workflow and persistent dock

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.95.
- Made the Home, Job, Chat, and Menu dock persistent across authenticated mobile pages and return each destination to its main workspace.
- Hide the dock only while the Android keyboard is open, so it never covers message or form entry.
- Moved the call-based enquiry Save action to the top app bar and ordered List, Allocated, preview, then Message.
- Added Home and My Enquiries creation entry points, list filtering, and creator-only enquiry browsing.
- Corrected My Enquiries refresh state handling so it does not pass asynchronous work to `setState`.

## v-1.0.94

### [v 1.0.94] 2026-09-02 10:01 am - Live mobile home statistics

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.94.
- Replaced the Home Actions placeholder with live My Enquiries and Duty counts.
- Added a My Enquiries page that uses the CRM created view for the signed-in employee only.
- Added direct enquiry creation from compact Call Log cards and Call Notes.
- Refined Call Log cards with clear borders and fixed-size circular action buttons.
- Removed the enquiry message placeholder and focus the message field when the form opens.

## v-1.0.93

### [v 1.0.93] 2026-08-31 11:56 pm - Mobile enquiry preview card

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.93.
- Added a live enquiry preview above the mobile call-enquiry message field.
- Generate a single-line enquiry title from the first 44 characters of the message while retaining the complete message for the enquiry body.
- Added selected list and allocated-person details to the preview card, using the same allocation language as the Jobs cards.
- Removed the manual title input and kept the post action fixed at the bottom of the form.
- Added a medium-rounded, full outline to the message field for clearer data entry.

## v-1.0.92

### [v 1.0.92] 2026-08-31 11:15 pm - Direct mobile startup updates

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.92.

## v-1.0.91

### [v 1.0.91] 2026-08-31 8:19 pm - Mobile SOP duties

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.91.

## v-1.0.90

### [v 1.0.90] 2026-08-31 8:36 am - Mobile call notes and enquiry conversion

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.90.
- Replaced call-log shortcut actions with a focused admin-only call-notes workflow.
- Saved rough call comments in encrypted, account-scoped device storage until an administrator converts one to an enquiry.
- Added a message-first enquiry form with live Frappe lists and employee allocation choices.
- Removed a converted local note only after its live enquiry post succeeds.
- Kept mobile call-enquiry API compatibility for earlier installed clients while enforcing administrator access for new posts.

## v-1.0.89

### [v 1.0.89] 2026-08-30 10:02 pm - Durable mobile job starts and faster refresh

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.89.
- Stored a pending 90-second job-start deadline in encrypted device storage and restored it after an app resume or restart.
- Sent restored starts through the existing live API, then refreshed the shared Home and Jobs snapshot so timers and controls remain aligned.
- Batched live Frappe job-execution hydration for the Jobs refresh, replacing one request per enquiry with bounded bulk requests.
- Added automated coverage for device-stored pending start deadlines while preserving the existing mobile card, detail, and action-sheet UI.

## v-1.0.88

### [v 1.0.88] 2026-08-30 2:41 pm - Mobile permission and job detail refinements

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped the repository and Flutter application version to 1.0.88, build 88.
- Added duration badges for completed job executions.
- Showed detailed compact timestamps such as 1d 5h.
- Sent the Frappe activity author to the mobile work feed.
- Replaced generic message activity text with the related comment text when available.
- Simplified the mobile job show card with one job number, status, enquiry list, and creator details.
- Removed the unnecessary assignee row from the job show card.
- Changed the comment composer label to Write a comment only.
- Saved successful call-log consent on the device and skipped the repeated disclosure screen.
- Opened the four-digit PIN keyboard when the unlock screen opens or biometric unlock does not complete.

## v-1.0.87

### [v 1.0.87] 2026-08-30 1:15 pm - Mobile job feed and guarded start

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped the repository and Flutter application version to 1.0.87, build 87.
- Added four-digit PIN setup and unlock fields with automatic focus and automatic submit.
- Kept the mobile Messenger composer visible above the Android keyboard.
- Replaced job tabs with one time-ordered work feed for comments, job executions, and activity.
- Added floating job actions for photo, document scanning, location, completion, charges, and collected amounts.
- Calculated job duration from recorded start and stop times with second, minute, and hour labels.
- Added a 90-second cancellable job-start countdown that continues after its dialog is hidden.
- Kept the card switch active during the countdown so the user can cancel before Frappe records the job.

## v-1.0.86

### [v 1.0.86] 2026-08-29 11:03 pm - Android call log compatibility

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped the repository and Flutter application version to 1.0.86, build 86.
- Added an administrator-only mobile Call Logs page.
- Added search and incoming, outgoing, and missed call filters.
- Added call, SMS, WhatsApp, copy, and enquiry attachment actions.
- Registered selected call details as live Frappe enquiry comments.
- Added a clear call-history disclosure before the Android permission request.
- Added recovery for denied, restricted, and unsupported-device permission states.
- Marked telephony as optional for tablets and other compatible Android devices.
- Added Android 11 and later compatibility for external Phone, SMS, WhatsApp, Maps, and Camera actions.
- Used the supported Android call-log limit parameter for recent history queries.
- Documented Google Play and managed-device rules for the hard-restricted `READ_CALL_LOG` permission.
- Removed the Home message shortcut, Next action section, and Today activity list.

## v-1.0.85

### [v 1.0.85] 2026-08-29 6:45 pm - Mobile jobs, chat, and actions

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped the repository and Flutter application version to 1.0.85, build 85.
- Redesigned the My Jobs cards for a compact mobile workflow.
- Added live job start and stop switches with light inactive borders.
- Added native call, WhatsApp, location, document scan, and photo actions.
- Added a WhatsApp message with the selected job details.
- Added the live Messenger to the mobile dock as Chat.
- Moved Actions from the dock to the account menu.
- Added an Actions scaffold with an embossed quick-action button.
- Added live enquiry action posting and job check-in controls.
- Removed the My Jobs helper quote and reduced unused page content.

## v-1.0.53

### [v 1.0.53] 2026-08-28 6:17 pm - Flutter secure local unlock

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.53.
- Added encrypted Android storage for minimal Flutter session data.
- Added PIN setup after the first full login.
- Added PIN and optional biometric unlock for a valid API session.
- Kept the PIN until the user resets it or signs out.
- Required a full email and password login after 10 inactive days.
- Made the web API session endpoint the authority for token validity.
- Validated the stored access token after local unlock and application resume.
- Added password confirmation and PIN reset to the mobile account menu.
- Kept account passwords out of local storage.
- Aligned the Flutter application with version 1.0.53 and build number 53.

## v-1.0.52

### [v 1.0.52] 2026-08-28 5:11 pm - Flutter-only mobile release

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.52.
- Confirmed that Flutter is the only TechMedia mobile client and release workflow.
- Removed the remaining Ionic, Capacitor, and Kotlin Multiplatform files and package references.
- Removed obsolete mobile build tools and workspace commands.
- Updated the Flutter runtime version labels and Android build number to 52.
- Added root Flutter commands for development, APK builds, and portal releases.
- Added automatic `techmedia-v<version>.apk` output for Flutter release builds.
- Verified the Node, React, API, and Flutter build boundaries after the cleanup.

## v-1.0.51

### [v 1.0.51] 2026-08-28 4:40 pm - CRM comment time and mobile updates

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.51.
- Changed CRM comment timestamps to a live relative-time format with the exact local time on hover.
- Reloaded Frappe enquiry messages with their child creation and owner metadata after each write.
- Kept Flutter as the only TechMedia mobile application.
- Removed the Ionic, Capacitor, and Kotlin Multiplatform mobile clients.
- Removed obsolete Ionic, Capacitor, and Kotlin mobile build commands and dependencies.
- Added root Flutter commands for development, Android APK builds, and portal releases.
- Aligned the Flutter application with version 1.0.51 and build number 51.
- Moved the Flutter release check after login and added a manual check to the account menu.
- Kept the Flutter portal updater, SHA-256 verification, and Android system installer flow.

## v-1.0.50

### [v 1.0.50] 2026-08-28 3:51 pm - Flutter CRM and live Messenger

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.50.
- Aligned the Flutter Android application version with the repository at 1.0.50, build 50.
- Fixed mobile enquiry comments to use live Frappe records instead of sample content.
- Added mobile comment posting and plain-text display for Frappe rich-text messages.
- Added live Frappe job execution details, job start and stop actions, and enquiry activities.
- Connected Frappe activities and job executions to the mobile Actions screen.
- Removed the Flutter local API override and fixed the API origin to `app.techmedia.in`.
- Replaced the sample Messenger badge with authenticated unread totals and live WebSocket updates.
- Added Messenger read updates, reconnect behavior, and production WebSocket deployment instructions.

## v-1.0.49

### [v 1.0.49] 2026-08-28 9:43 am - Flutter mobile portal updates

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.49.
- Aligned the Flutter Android application version with the repository at 1.0.49, build 49.
- Added a portal-managed Flutter Android update manifest and APK endpoint.
- Added startup version checks, SHA-256 verification, and the Android system installer approval flow.
- Added `storage/mobile/release` as the runtime location for the latest Flutter APK and `latest.json`.
- Added a persistent `techmedia-mobile-releases` container volume for portal release files.
- Added `npm.cmd run flutter:release:portal -- --base-url=https://app.techmedia.in/api/platform`.
- Added API route tests for the release manifest and APK download endpoints.
- Production release endpoints require an API deployment before `app.techmedia.in` can serve the update.

## v-1.0.48

### [v 1.0.48] 2026-08-25 6:27 pm - CRM navigation order

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.48.
- Kept CRM first in the application menu and moved Enquiries to the second position.
- Moved Messages to the third position and kept the remaining menu sections in their existing order.

## v-1.0.47

### [v 1.0.47] 2026-08-24 8:38 am - Docs module and changelog renderer

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped the repository and Android application version to 1.0.47.
- Added an authenticated Docs module with an index, an MDX article renderer, and application navigation.
- Added the first MDX guide for daily CRM enquiry work.
- Added a Changelog page that reads `assist/documentation/CHANGELOG.md` directly.
- Fixed Changelog loading so plain Markdown remains text while MDX guides compile as components.

## v-1.0.46

### [v 1.0.46] 2026-08-22 7:19 pm - Mobile CRM gateway and delivery updates

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository and Android application version to 1.0.46.
- Added the authenticated mobile CRM gateway so mobile calls TechMedia Node APIs, never Frappe directly.
- Added the My Jobs mobile workspace with assigned-job filters, live activity, comments, and job start or stop actions.
- Improved mobile message receipt synchronization and read-status presentation.
- Simplified mobile workspace headers and reserved a stable system-status inset to prevent top-content overlap.
- Deferred the Blog and File Manager package integrations; removed their runtime routes, desk entries,
  environment requirements, and container storage volume from this release.

## v-1.0.45

### [v 1.0.45] 2026-08-22 6:36 pm - Mobile messenger and storage fixes

#### Database Changes

- Database update: Yes.
- Added local message-media storage.

#### App Codebase Changes

- Bumped repository version to 1.0.45.
- Added persisted messaging attachments with protected media download routes.
- Fixed inline attachment loading without creating oversized API requests.
- Fixed mobile reaction updates to use the persisted message state.
- Fixed development WebSocket cleanup noise and local Vite header handling.
- Synced the mobile Capacitor bundle and aligned the Android application version.

## v-1.0.44

### [v 1.0.44] 2026-08-20 11:13 am - Realtime business messaging

#### Database Changes

- Database update: Yes.
- Added persisted conversations, conversation members, messages, read cursors, delivery status, and message metadata.
- Added repeatable messaging schema migration support for existing TechMedia databases.

#### App Codebase Changes

- Bumped repository version to 1.0.44.
- Added authenticated realtime messaging with WebSocket delivery and REST fallback.
- Added a full-height messaging workspace with conversation search, unread counts, and local timestamps.
- Added active-user contact search and direct conversation reuse.
- Added message delivery and read marks, date separators, thread search, reactions, and contextual message actions.
- Added multiline message composition, attachment drop, file upload, voice recording, and voice-to-text input.
- Added task messages, group mentions, and direct realtime copies for mentioned users.
- Removed mention labels from the direct copy while retaining them in the source conversation.

## v-1.0.43

### [v 1.0.43] 2026-08-19 7:59 am - GitHub mobile updates

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.43.
- Added a startup check for a newer Android release on GitHub Releases.
- Added verified APK download and Android installer handoff for GitHub releases.
- Added the mobile GitHub release command for APK, manifest, version tag, and release upload.
- Kept Android installation approval required for GitHub APK updates.

## v-1.0.42

### [v 1.0.42] 2026-08-18 10:07 am - Comfortable mobile release

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.42.
- Released the mobile app with the Comfortable display layout.
- Kept the mobile Display settings control and Compact option removed.
- Prepared the signed Android release APK for version 1.0.42.

## v-1.0.41

### [v 1.0.41] 2026-08-18 10:05 am - Comfortable mobile display

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.41.
- Removed the floating mobile Display settings control.
- Locked the mobile interface to Comfortable density at every application startup.
- Removed the Compact density option and its obsolete styles.
- Verified the Comfortable layout without the floating control in the Android emulator.

## v-1.0.40

### [v 1.0.40] 2026-08-18 10:03 am - Mobile detail navigation and compact header

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.40.
- Added a mobile-only Back button to enquiry detail pages.
- Removed global search from the mobile top menu.
- Compacted and constrained mobile top-menu controls to prevent horizontal overflow.
- Verified the compact header and Back-to-list navigation in the Android emulator.

## v-1.0.39

### [v 1.0.39] 2026-08-18 9:58 am - Mobile CRM double-tap cards

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.39.
- Removed the visible Open action from mobile CRM cards.
- Added double-tap navigation from the plain card surface to the enquiry detail page.
- Verified plain-card rendering and double-tap detail navigation in the Android emulator.

## v-1.0.38

### [v 1.0.38] 2026-08-18 9:54 am - Mobile CRM open action

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.38.
- Removed the icon from mobile CRM Open actions.
- Kept Open as a clear text tap target that loads the existing enquiry detail page.
- Verified the text-only Open action and live enquiry detail navigation in the Android emulator.

## v-1.0.37

### [v 1.0.37] 2026-08-18 9:52 am - Ionic mobile CRM cards

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.37.
- Added Ionic React to the Capacitor mobile workspace without changing the desktop UI framework.
- Added a registered mobile presentation adapter for shared CRM enquiry lists.
- Replaced CRM tables with touch-friendly Ionic cards in the mobile application.
- Kept shared CRM queries, permissions, filters, sorting, pagination, and record actions.
- Added mobile card states for loading, API errors, empty results, new calls, status, and priority.
- Verified My Calls cards with live production data in the Android emulator.

## v-1.0.36

### [v 1.0.36] 2026-08-18 9:29 am - Mobile application and TEMA controls

#### Database Changes

- Database update: Yes.
- Added persisted TEMA pet visibility settings for the web and mobile applications.
- Added repeatable default records that keep both TEMA pets visible after migration.

#### App Codebase Changes

- Bumped repository version to 1.0.36.
- Added the Capacitor mobile application while keeping feature modules in the shared web application.
- Added secure native session storage, native API transport, Android back handling, keyboard support,
  system bars, and splash-screen control.
- Added Android and iOS icons, splash screens, and loading screens generated from the TechMedia logo.
- Added signed Android release builds and produced the installable TechMedia 1.0.36 APK.
- Added system-administrator controls for TEMA pet visibility on web and mobile.
- Kept each user's TEMA pet preference separate from the system-wide platform controls.
- Added stable CRM column widths and horizontal scrolling for narrow screens.

## v-1.0.35

### [v 1.0.35] 2026-08-17 5:28 pm - HR Staff Requests

#### Database Changes

- Database update: Yes.
- Added the HR request permissions and assigned defaults for Admin and User roles.
- Kept Staff Request records and approval comments in Frappe. No local HR business table was added.

#### App Codebase Changes

- Bumped repository version to 1.0.35.
- Added the live-Frappe HR Staff Request module with My requests and an Admin-only All requests view.
- Added server-side ownership checks for Staff Requests and Admin-only approval comments.
- Kept CRM and HR visible together in the desk menu.
- Removed request-page refresh actions. Only My requests can create a new request.

## v-1.0.34

### [v 1.0.34] 2026-08-17 4:44 pm - CRM report drill-down filters

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.34.
- Made report count cells open All Enquiries with the exact status, List-In or owner, and date-range filters.
- Added clear drill-down labels so each count explains the destination before the user opens it.
- Applied report date ranges to the live Frappe enquiry list and showed the active report scope on All Enquiries.
- Restored priority forwarding in the CRM list route so priority drill-down filters reach the live enquiry query.

## v-1.0.33

### [v 1.0.33] 2026-08-14 11:14 am - CRM navigation and table polish

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.33.
- Added a permission-aware New enquiry button above the CRM sidebar menu. The button opens the
  dedicated enquiry page.
- Added a slight hover lift and smooth shadow transition to the New enquiry sidebar button. The
  button stays static when the user enables reduced motion.
- Removed the Desktop alerts toggle from CRM list pages. Desktop notification controls remain in
  Settings under Desktop notifications.
- Hid the redundant User column and its visibility option from My Calls. Other CRM lists keep the
  User column.
- Changed the New status badge to a light gray tone with readable dark text and icon colors.
- Added a slightly darker gray hover and a short color transition to workspace table rows.

## v-1.0.32

### [v 1.0.32] 2026-08-14 11:00 am - CRM enquiry workflow and reports

#### Database Changes

- Database update: Yes.
- Added the repeatable `crm.enquiry.all.view` permission and assigned it to the Admin role.
- Added no CRM business tables. Live Frappe remains the CRM source of truth.

#### App Codebase Changes

- Bumped repository version to 1.0.32.
- Added a dedicated My Calls New enquiry page with mobile-first lookup, a latest-enquiry reference,
  an existing Customer lookup, and a focused create form.
- Added signed-in-user session history for recent mobile searches. The list supports partial-match
  suggestions, clear, newest-first order, descending serial numbers, and a fixed slim-scroll area.
- Added a green confirmation ring for valid 10-digit mobile numbers.
- Added direct Open and Edit routes from the latest-enquiry card. Edit is available only when the
  signed-in employee created the latest enquiry and no follow-up comment exists.
- Added an Admin-only All Enquiries workspace with complete live Frappe pagination and report
  drill-down filters for Status, List in, assigned employee, and unassigned enquiries.
- Aligned CRM Status and List in as independent live Frappe fields. Status exposes the live status
  values, while List in separately exposes Follow and LogicX.
- Made CRM Reports navigation and direct route access depend on the signed-in role's
  `crm.report.view` permission. Role changes take effect after a new sign-in.
- Made My Job and My Calls rows open enquiry details while keeping row actions independent.
- Removed Back and Next from My Job and My Calls details. Open Enquiry keeps these controls, and
  WhatsApp opens its web conversation in a separate tab.
- Refined enquiry comments with compact rows and non-destructive suspension of the latest message.
- Restricted the immutable system-user guard to user ID 1. Administrators can edit and reassign
  roles for other administrator accounts.
- Reconciled the root workspace lockfile so the Inter font resolves during development and builds.

## v-1.0.31

### [v 1.0.31] 2026-08-14 5:15 am - Improve live enquiry follow-up context

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.31.
- Added live Frappe mobile history to the New Enquiry form, with newest-first matching enquiries,
  a dedicated scrollable drawer, and direct opening of an existing conversation.
- Added creator and relative-age context below enquiry summary badges.
- Resolved live Frappe Customer names in My Job and My Calls while preserving Customer IDs for
  enquiry updates.

## v-1.0.30

### [v 1.0.30] 2026-08-14 4:19 am - Preserve complete Frappe API responses

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.30.
- Made the shared Frappe transport parse complete API responses. This keeps large live lists from
  becoming empty after a 64 KB JSON truncation.
- Added Frappe request handling documentation with transport and empty-list troubleshooting rules.

## v-1.0.29

### [v 1.0.29] 2026-08-13 2:01 am - TEMA chat archive and activity summary

#### Database Changes

- Database update: Yes.
- Added an archive timestamp to persisted TEMA conversation records.

#### App Codebase Changes

- Bumped repository version to 1.0.29.
- Kept TEMA chat history scoped to the signed-in user and added conversation, prompt, and reply counts.
- Added a hover Archive action to each side-panel chat history item.

## v-1.0.28

### [v 1.0.28] 2026-08-12 12:26 pm - Preserve enquiry ownership on edit

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.28.
- Preserved the original Frappe `user_employee` when a staff member edits an enquiry. New
  enquiries still set the creator as the owner, while later edits no longer add the enquiry to the
  editor's My Calls list.

## v-1.0.27

### [v 1.0.27] 2026-08-11 4:56 pm - Internal notifications and mobile validation

#### Database Changes

- Database update: Yes.

#### App Codebase Changes

- Bumped repository version to 1.0.27.

## v-1.0.26

### [v 1.0.26] 2026-08-11 10:44 am - CRM notifications and India time

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.26.
- Aligned `github:now` with the CXApp release flow. It now shows a release review, offers a patch
  bump before the title prompt, lets users review the commit message, and fetches before pulling.

## v-1.0.25

### [v 1.0.25] 2026-08-11 12:39 am - Version update

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.25.
- Set the container runtime and CRM date displays to Asia/Kolkata. Frappe timestamps without an
  offset now read as India Standard Time.
- Truncated long enquiry titles in the page heading and kept the full title in the enquiry summary
  card.
- Added browser notification settings with enable, disable, reset, refresh, and test controls.
- Synced browser permission changes to the My Calls listener without requiring a second click.
- Added My Calls assignment, status, reply, and test alerts to the in-app notification tray.
- Gave each Windows alert a unique browser tag so repeated alerts do not replace an earlier alert.

## v-1.0.24

### [v 1.0.24] 2026-08-07 6:45 pm - Access controls and session recovery

#### Database Changes

- Database update: Yes.
- Updated repeatable Identity seeds to use only SuperAdmin, Admin, and User.
- Set `admin@admin.com` as the protected SuperAdmin. The seed reads its password from `.env`.
- Kept one active role assignment for each user.
- Made force delete remove a user's role assignments and user record in one transaction.

#### App Codebase Changes

- Bumped repository version to 1.0.24.
- Added role access controls with CRM report access, Select all, Clear all, and horizontally scrollable permission groups.
- Restored Roles and Permissions in the Identity menu. User Roles remain part of the User form.
- Added `/sa/refresh` to clear session storage, query cache, and browser cache before a new login.
- Removed Add user from the profile menu and routed sign out through the session refresh page.
- Added pointer cursors for enabled buttons and links.

## v-1.0.23

### [v 1.0.23] 2026-08-07 4:39 pm - CRM reports and enquiry workflow refinements

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.23.
- Added an Administrator-only CRM reports workspace that reads the live Frappe List-In and Owner
  status reports through the signed-in user's verified Frappe connection.
- Added report date, employee, and List-In filters with searchable live lookups, sorting, reset,
  Excel-style borders, totals, serial numbers, and readable zero-value styling.
- Updated enquiry entry and detail behavior with automatic short titles, responsive mobile layout,
  current Frappe statuses, compact comments, and a static Reply action for the latest comment.

## v-1.0.22

### [v 1.0.22] 2026-08-05 9:15 am - CRM comment quality and navigation

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.22.

## v-1.0.21

### [v 1.0.21] 2026-08-01 1:37 pm - CRM workspace navigation and guarded live updates

#### Database Changes

- Database update: Yes.
- Added the repeatable `crm.job.manage` permission for Manager and granted the protected
  `crm.enquiry.create` permission to Manager, Staff, and User so every standard role can create an
  enquiry from My Calls; no schema or business tables were added.

#### App Codebase Changes

- Bumped repository version to 1.0.21.
- Added supervisor-managed Job Execution creation and editing through live Frappe, retained
  Estimate editing, replaced free-text customers with a validated live-Customer lookup, and made
  assigned role labels searchable in the Users list.
- Added WhatsApp actions to My Job and My Calls enquiry details using the `wa.me` message format,
  with Windows app launch first and a timed WhatsApp Web fallback.
- Restricted Open Enquiry navigation and API permission exposure to Administrator, while making
  New enquiry available to every standard role in My Calls.
- Reworked the application shell with the Shadcn stone/Inter default theme, a fixed global header,
  global CRM search, compact sidebar/workspace spacing, bright app and user menus, an Account app,
  Administrator-only Add user, and a dismissible welcome notification with a pulsing unread dot.
- Removed the CRM overview hero; made statistic cards hoverable and link to their filtered lists;
  added live muted count badges to My Job and My Calls; reset open detail/upsert state on every
  sidebar selection; and added theme-aware enquiry row hover highlighting.
- Hardened Docker updates with committed-source enforcement and an explicit dirty override,
  source/image/migration-compatible version locking, an exclusive host lock, backup and Docker
  disk-space preflight, SHA-256 backup verification and retention, and per-attempt deployment JSON.
- Preserved existing credentials, topology, MariaDB data, and Frappe mappings during updates;
  replacement failures restore prior API/Web images without claiming to reverse applied database
  migrations or repeatable seeds.

## v-1.0.20

### [v 1.0.20] 2026-07-31 10:30 am - Enquiry detail visibility controls

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.20.
- Made CRM Overview the landing page after sign-in for every role, while retaining the
  Administrator-only Application workspace in the workspace switcher.
- Simplified enquiry detail for operational roles by removing Reply and creation metadata, hiding
  Quotation, Tasks, and Attachments tabs, limiting Activity to Administrator, and hiding Properties
  for User and Manager.

## v-1.0.19

### [v 1.0.19] 2026-07-31 9:53 am - CRM action controls and role permissions

#### Database Changes

- Database update: Yes.
- Updated repeatable role-permission seeds so Auditor receives the live CRM list/create access,
  while Manager, Staff, and User no longer receive the seeded `crm.enquiry.create` permission.

#### App Codebase Changes

- Bumped repository version to 1.0.19.
- Expanded all CRM enquiry-list searches to match enquiry ID, enquiry details, phone number, and
  customer name, including multi-word filters within the signed-in user's permitted live list.
- Renamed the assigned and created CRM views to My Job and My Calls, and limited New enquiry to
  the My Calls view.
- Restricted the CRM Refresh and New enquiry controls to Administrator and Auditor in the desk UI.

## v-1.0.18

### [v 1.0.18] 2026-07-31 9:27 am - Version update

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.18.
- Made the application Frappe connection persist safely to the configured root `.env`, creating it
  from `.env.example` when a first-time installation has not created it yet, and refreshing the
  running API configuration after a successful save.
- Improved the Frappe settings error when the mounted runtime `.env` is not writable by the API
  process.
- Allowed the protected administrator to save and verify its own Frappe credentials without
  changing its protected role assignment.

## v-1.0.17

### [v 1.0.17] 2026-07-31 5:44 am - Version update

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.17.

## v-1.0.16

### [v 1.0.16] 2026-07-30 6:54 pm - Personal CRM overview and status filters

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.16.
- Reworked the CRM overview around the signed-in user's enquiries: My enquiries, Created by me,
  In progress, and Closed by me. Removed the cross-user enquiry leaderboard and its API payload.
- Added a live API-backed CRM status filter. Enquiry lists now show active Open, Follow, and
  Escalation records by default, while Won and Lost records are available only when selected from
  the existing Filters menu.

## v-1.0.15

### [v 1.0.15] 2026-07-30 11:00 am - Complete enquiry commercial workflow and interactive deployment

#### Database Changes

- Database update: Yes.
- Added repeatable Quotation permission seeds and default role-permission assignments for auditor,
  manager, staff, and user roles.
- Kept the MariaDB schema limited to Identity and migration-history tables; this release adds no
  business tables or destructive migration.

#### App Codebase Changes

- Bumped repository version to 1.0.15.
- Converted TechMedia into a self-contained npm monorepo with repository-owned Framework and UI
  workspaces, one root `node_modules`, and one root `dist`.
- Removed parent-folder package installation, build, TypeScript, Vite, and container-context
  dependencies, including the obsolete Core image dependency.
- Added repository-boundary, artifact-layout, module-boundary, database-lifecycle, Framework
  package, and built-runtime smoke verification.
- Enabled the application desk and navigation for the initial administrator, corrected lazy module
  loading, and enforced login redirection when a local JWT expires or an authenticated request is
  rejected.
- Added enquiry-owned Estimate and Quotation tabs with live-Frappe list and upsert workflows,
  automatic enquiry and signed-in-user context, and responsive single-row Estimate inputs.
- Removed the Emails, Calls, and Notes tabs from the enquiry show page while retaining Comments,
  Jobs, Estimate, Quotation, Tasks, Attachments, and Activity.
- Refined the CRM overview presentation and removed the Frappe connection header card.
- Expanded the standalone `setup.sh` into a fully interactive Docker installer covering resource
  names, ports, database identity, administrator credentials, public URLs, Frappe configuration,
  secret retention, shared or dedicated MariaDB, and safe database reuse or recreation.
- Added an explicit path to reuse a named running MariaDB container and existing Docker network;
  reused networks are external to Compose and existing infrastructure is never disconnected,
  stopped, removed, or recreated by setup.
- Simplified setup to create the root `.env` from `.env.example` when absent, read application URLs,
  encryption, and Frappe connection values from that file without prompts, and always enable the
  live Frappe integration.
- Kept internal Framework and UI workspace dependency versions aligned during repository version
  bumps so container `npm ci` resolves local workspaces instead of requesting unpublished packages.
- Added occupied-port detection before image builds and documented the Git Bash invocation required
  on Windows systems where `bash.exe` resolves to an unconfigured WSL installation.
- Verified a live local Docker deployment with healthy MariaDB, API, and web containers, eight
  applied migrations, administrator login and session recovery, web-to-API proxying, clean
  container logs, and persisted authentication after an API restart.

## v-1.0.14

### [v 1.0.14] 2026-07-29 5:23 pm - Harden standalone shared-infrastructure deployment

#### Database Changes

- Database update: No.
- Kept the Identity schema and migration history unchanged while allowing setup to reconcile the
  dedicated `techmedia` account and `techmedia_db` on either shared or dedicated MariaDB.

#### App Codebase Changes

- Bumped repository version to 1.0.14.
- Added an explicit deployment choice between existing shared infrastructure and a dedicated
  TechMedia MariaDB; shared Redis and Media are detected and left untouched because TechMedia does
  not consume them.
- Removed the redundant TechMedia MariaDB container when shared reuse is selected while preserving
  its named volume for recovery, and added clean network switching for future dedicated installs.
- Removed the Compose-level `DB_HOST=mariadb` override so the protected runtime environment remains
  authoritative when connecting to `cxapp-mariadb`.
- Added separate production `.container/.env.example` and `deploy.env.example` contracts with the
  live non-secret administrator, database, Frappe endpoint, and shared-container defaults while
  keeping passwords, JWT values, root credentials, and API secrets generated or prompted.
- Verified the shared deployment live with healthy API/Web containers, administrator login,
  Identity-only tables, eight migrations, and successful login after an API restart.

## v-1.0.13

### [v 1.0.13] 2026-07-29 11:47 am - Complete standalone deployment and public login

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped repository version to 1.0.13.
- Added the standalone TechMedia container deployment, interactive setup flow, environment
  contract, and shared-service integration used by the CXApp TechMedia stack.
- Reworked the public login into a responsive TechMedia landing experience while preserving
  authenticated return paths and application routing.
- Corrected browser API URL normalization and authentication gating for loopback development and
  container deployment.
- Updated Recharts to the supported 3.x line, reviewed install scripts, and produced clean audit
  and production build results.

## v-1.0.12

### [v 1.0.12] 2026-07-29 12:15 am - Complete standalone TechMedia CRM and Estimate

#### Database Changes

- Database update: Yes.
- Configured one `DB_NAME`-selected TechMedia database and limited the
  local schema to users, roles, permissions, user-role assignments, role-permission assignments,
  and schema migration history.
- Removed obsolete platform modules and local CRM persistence from the TechMedia runtime.
- Kept Settings, CRM, and Estimate free of local business tables: the application connection is
  stored in `.env`, per-user Frappe credentials remain on Identity users, and business records are
  read and written directly through live Frappe contracts.

#### App Codebase Changes

- Converted TechMedia into a standalone application with one login, one desk, and one database
  lifecycle.
- Retained only Identity administration, Frappe Settings, CRM enquiries, and Estimate workflows,
  with CRM visible to every authenticated user and Identity/Settings gated to the Administrator
  role in both the frontend routes and API authorization boundary.
- Added the live-Frappe Estimate module with list, search, filters, configurable columns,
  pagination, bounded reference lookups, and dedicated create/update pages.
- Refined CRM enquiry navigation and lists with consistent workspace widths, initial-load spinners,
  completed empty states, removal of the separate Enquiry ID selector, and cleaned Frappe labels.
- Added Frappe connection save and verification state, user import before credential verification,
  administrator-only theme selection, simplified breadcrumbs, and consistent CRM/Settings desks.
- Standardized Estimate and enquiry layouts with shared list gutters, centered responsive forms,
  compact controls, and matching live-loading feedback.
- Bumped the repository, Platform API, Platform Web, and lockfile versions to 1.0.12.

## v-1.0.11

### [v 1.0.11] 2026-07-27 10:10 am - Refine live CRM enquiry workspace

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Added inline show-page editing for List in, Priority, Assigned to, and Status, with updates saved
  directly to Frappe and refreshed job data returned with the enquiry response.
- Reworked the comments presentation around message-first rows, compact right-aligned timestamps and
  author identity, and clearer threaded replies.
- Refined every enquiry list with Mobile hidden by default, behaviour-specific status icons and
  colours, a compact colour-only Priority indicator with accessible hover tooltips, and matching
  bright priority swatches in the upsert and show-page selectors.
- Bumped the repository, Platform API, Platform Web, and lockfile versions to 1.0.11.

## v-1.0.10

### [v 1.0.10] 2026-07-26 3:08 pm - Complete TechMedia CRM and TMApp deployment

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Expanded CRM enquiries with priority, rich threaded messages, employee assignment, and live
  Frappe job-execution time and cost tracking.
- Aligned the CRM API, Frappe gateway, frontend contracts, forms, lists, show views, and workspace
  behavior around the same persisted enquiry model.
- Replaced the previous container layout with the TMApp deployment, safe setup/update scripts,
  shared CXApp networks, and Cloudflare routing.
- Split large TechMedia Web production bundles by dependency owner.
- Deduplicated TanStack Query across the composed TechMedia and Core frontend bundle so hooks and
  the application provider share one Query Client context.
- Bumped repository version to 1.0.10.

## v-1.0.9

### [v 1.0.9] 2026-07-25 9:17 am - Standardize repository LF line endings

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Standardized detected repository text files on LF through a repository-owned `.gitattributes`
  policy, preventing Windows Git from repeatedly warning about LF-to-CRLF conversion.
- Bumped repository version to 1.0.9.

## v-1.0.8

### [v 1.0.8] 2026-07-24 5:47 pm - Prevent repository text encoding corruption

#### Database Changes

- Database update: Yes.
- Preserved the protected Super Admin role assignment and kept it out of public Identity responses.

#### App Codebase Changes

- Replaced the former legacy administrator role with one hidden, non-assignable Super Admin and a
  visible Administrator role for normal administration.
- Kept the protected Super Admin identity and role behavior out of user, role, assignment, and
  permission management responses while retaining its internal authorization path.
- Added focused administrator-role E2E coverage for protected application access and role assignments.
- Added a repository-local text encoding gate that scans source, configuration, documentation, and
  environment files for invalid UTF-8 and common mojibake sequences.
- Required environment comments to remain ASCII and environment files to remain BOM-free so
  decorative separators cannot be silently corrupted by Windows encoding conversions.
- Repaired legacy mojibake in the module-boundary, design-system, and governance documentation.
- Wired the encoding gate into the normal TechMedia repository check while retaining a focused
  environment check alias for maintenance workflows.
- Bumped the repository, Platform API, Platform Web, and lockfile versions to 1.0.8.

## v-1.0.7

### [v 1.0.7] 2026-07-24 5:28 pm - Run CRM directly on live Frappe

#### Database Changes

- Database update: Yes.
- Extended user persistence with encrypted per-user Frappe credentials, authenticated-user
  identity, resolved Employee code, verification state, and verification timestamps.
- Extended Frappe connection persistence with separate encrypted application credentials and a
  compatible migration of the earlier administrator connection credentials.
- Retained former CRM and Frappe-link tables as untouched transition archives; the live CRM runtime
  no longer reads from or writes to them.

#### App Codebase Changes

- Cut CRM over to a live server-side Frappe gateway for enquiry list, get, create, update, delete,
  assignment, schedules, and Enquiry Message child-row operations without pull/push synchronization.
- Reused verified encrypted per-user API tokens and signed-session Employee mappings without
  repeating connection verification on every CRM transaction.
- Normalized Frappe rich-text headings and child messages to readable plain text at the integration
  boundary while preserving existing child-row identities during updates.
- Loaded enquiry activity directly from Frappe versions, view logs, and edit logs, including
  Messages child-row additions, removals, and field changes without local activity persistence.
- Refined CRM list, upsert, show, comments/replies, filters, columns, responsive layout, navigation,
  permissions, protected-system-user editing, and Employee-code capture.
- Added focused Frappe live-gateway and user credential administration E2E coverage and updated the
  architecture and repository-inventory documentation.
- Bumped repository version to 1.0.7.

## v-1.0.6

### [v 1.0.6] 2026-07-24 10:34 am - Expand CRM workspace and harden Frappe synchronization

#### Database Changes

- Database update: Yes.
- Added forward CRM migrations for enquiry subjects, creator-aware comments and replies, and
  cascade-owned email, call, task, note, attachment, and activity child tables.
- Added user migrations for encrypted per-user Frappe API credentials, authenticated-user
  identity, verification state, and verification timestamps.
- Extended Frappe connection persistence with separate encrypted application credentials and a
  compatible migration of the earlier administrator connection credentials.

#### App Codebase Changes

- Expanded the CRM desk with assigned, created, and unassigned enquiry scopes; filters, configurable
  columns, compact responsive tables, full enquiry upserts, and the full-width enquiry show
  workspace with comments, replies, communication tabs, properties, schedules, and next-record
  navigation.
- Added persisted CRM conversation and activity operations with creator-aware edit/delete rules,
  reply grouping, rich-text composition, due-date presentation, subject fallback, and per-enquiry
  resynchronization controls.
- Hardened Frappe integration with encrypted per-user authentication, one-time verification state,
  application-key settings, Frappe user preview/import, directional enquiry sync, live lifecycle
  create/update/delete, required Employee mapping, and clearer upstream validation errors.
- Set CRM as the default landing app and kept the Application desk restricted to system
  administrators.
- Refined the TechMedia public site, navigation, branding, authentication defaults, and application
  menus for the computer hardware, wholesale, retail, and LogicX product direction.
- Added focused CRM, Frappe, user-access, and landing-state E2E coverage plus updated architecture,
  migration, and project inventory documentation.
- Bumped repository version to 1.0.6.

## v-1.0.5

### [v 1.0.5] 2026-07-23 11:11 am - Add CRM and Frappe workflows

#### Database Changes

- Database update: Yes.
- Added database migrations for queue delivery metadata.
- Updated application access and role seed contracts. Existing installations require ordered forward
  migrations and repeatable seeds before enabling new modules.

#### App Codebase Changes

- Added the CRM API and Web workflow with enquiry lifecycle, scheduling, permissions, and navigation.
- Added the Frappe connection API/Web module with encrypted credentials, fixed contracts, protected
  permissions, and reusable server-side connection access without returning secrets to browsers.
- Integrated durable database and BullMQ/Redis Queue V2 backends, refreshed public pages, and updated
  operational documentation.
- Bumped repository version to 1.0.5.

## v-1.0.4

### [v 1.0.4] 2026-07-22 11:19 pm - Align shared bottom-right notifications

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Aligned the TechMedia release with the shared UI-owned Sonner notification boundary.
- Verified that TechMedia modules publish to the common bottom-right toaster without owning a
  competing Sonner runtime.
- Bumped repository version to 1.0.4.

## v-1.0.3

### [v 1.0.3] 2026-07-22 11:03 pm - Move Platform runtime under src

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Moved the Platform API and Web workspaces from `apps/platform` to `src/platform` and removed the
  obsolete `apps` source boundary.
- Rewired npm workspaces, database commands, development preflight, storage paths, boundary and
  lifecycle checks, E2E imports, product-stack impact detection, and container entrypoints for the
  new source layout.
- Changed generated runtime output from `dist/apps/platform` to `dist/platform` and updated the
  production API and Web container paths.
- Updated the active architecture, deployment, API, migration, and repository inventory guidance
  to make `src/platform` the authoritative TechMedia composition root.
- Bumped repository version to 1.0.3.

## v-1.0.2

### [v 1.0.2] 2026-07-22 9:46 pm - Enforce application-only container deployment boundaries

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Added mandatory Tech Media container-agent rules with VPS prerequisites, application-only
  ownership, forbidden destructive operations, and required smoke verification.
- Changed Tech Media setup to require the existing external CODEXSUN network and healthy shared
  MariaDB/Redis/Media containers instead of creating shared infrastructure.
- Added deployment guards that keep database fresh/reset and live-restore controls disabled during
  normal rollout.
- Aligned package, workspace, container build, image, and deployment defaults to version 1.0.2.

## v-1.0.1

### [v 1.0.1] 2026-07-22 9:18 pm - Finalize standalone TechMedia application and deployment

#### Database Changes

- Database update: Yes.
- Added TechMedia database migrations with explicit composition order.
- Added repeatable application, permission, access-control, and default site seeds.

#### App Codebase Changes

- Added the TechMedia API and Web composition using Framework, UI, and TechMedia-owned modules.
- Added standalone source builds, Compose installation, Traefik routing, shared MariaDB/Redis/media
  integration, persistent storage, health checks, and production smoke verification.
- Added repository Assist guidance, environment contracts, module/database boundary gates,
  release tooling, and standalone VPS installation documentation.
- Aligned package, workspace, container image, and deployment defaults to version 1.0.1.

## v-1.0.0

### [v 1.0.0] 2026-07-22 - Initialize TechMedia release tooling

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Initialized the TechMedia repository at version 1.0.0.
- Added repository-owned version display, validation, patch bump, changelog, commit, and push tooling.
- Added `version:bump`, `version-bump`, and `github:now` root commands.
