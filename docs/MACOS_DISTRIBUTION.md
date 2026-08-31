# macOS distribution

Classroom Widgets for macOS is a menu-bar app for opening floating classroom widgets. It is built locally from the teacher production build and the SwiftPM package in `packages/macos-dashboard`.

## Local run

```bash
npm run macos:run -- --verify
```

This writes `dist/Classroom Widgets Dashboard.app`, opens it, and verifies that `ClassroomWidgets` is running.
The app is installed and launched from `/Applications/Classroom Widgets Dashboard.app` after each successful local run build so existing installations are replaced in place and macOS camera permission remains tied to the canonical app location.

The on-disk bundle filename deliberately remains `Classroom Widgets Dashboard.app` for upgrade compatibility, while Finder and macOS display the app as `Classroom Widgets`. The bundle identifier remains `com.classroomwidgets.dashboard`, so existing preferences, login-item registration, and macOS permissions continue to belong to the same app identity.

## Local DMG

```bash
npm run macos:dmg
```

This creates an ad hoc signed local DMG at:

```text
dist/ClassroomWidgets-v<version>-macos.dmg
```

Use this only for local packaging checks. It is not suitable for public download.
The built app is also installed to `/Applications/Classroom Widgets Dashboard.app`.

## Developer ID DMG

Create a local `.env.release.local` with machine-specific credentials:

```bash
APPLE_SIGNING_IDENTITY="Developer ID Application: Tinkertanker (TEAMID)"
APPLE_TEAM_ID="TEAMID"
APPLE_API_KEY_PATH="/path/to/AuthKey_KEYID.p8"
APPLE_API_KEY_ID="KEYID"
APPLE_API_KEY_ISSUER_ID="ISSUER-UUID"
```

Build a signed DMG:

```bash
npm run macos:dmg -- --distribution
```

Build, notarise, and staple a public-downloadable DMG:

```bash
npm run macos:dmg -- --distribution --notarise
```

The distribution signature uses hardened runtime and `script/macos-distribution-entitlements.plist`, which includes camera access for the Visualiser widget.
Successful release builds also install the signed app to `/Applications/Classroom Widgets Dashboard.app` before packaging the DMG.

## Validation

Useful checks:

```bash
codesign -dvvv --entitlements :- "dist/Classroom Widgets Dashboard.app"
codesign --verify --deep --strict --verbose=2 "dist/Classroom Widgets Dashboard.app"
codesign --verify --strict --verbose=2 "dist/ClassroomWidgets-v<version>-macos.dmg"
xcrun stapler validate "dist/ClassroomWidgets-v<version>-macos.dmg"
spctl -a -vv -t open --context context:primary-signature "dist/ClassroomWidgets-v<version>-macos.dmg"
```
