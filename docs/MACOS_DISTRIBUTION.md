# macOS distribution

Classroom Widgets for macOS is a menu-bar app for opening floating classroom widgets. It is built locally from the teacher production build and the SwiftPM package in `packages/macos-dashboard`.

## Versioning

macOS releases are versioned independently from web deployments. The source of truth is:

```text
packages/macos-dashboard/version.json
```

That version is written to `CFBundleShortVersionString`, the DMG filename, and the version label shown by the embedded teacher UI. `CFBundleVersion` is a separate monotonically increasing build number and defaults to a timestamp for release builds.

Use tags named `macos-v<version>`. Existing `v0.10.15` and older tags remain valid historical releases; the namespaced format starts with the next macOS release.

## Local run

```bash
npm run macos:run -- --verify
```

This writes `dist/Classroom Widgets Dashboard.app`, opens it, and verifies that `ClassroomWidgets` is running.
The app is installed and launched from `/Applications/Classroom Widgets Dashboard.app` after each successful local run build so existing installations are replaced in place and macOS camera permission remains tied to the canonical app location.

The on-disk bundle filename deliberately remains `Classroom Widgets Dashboard.app` for upgrade compatibility, while Finder and macOS display the app as `Classroom Widgets`. The canonical bundle identifier is `sg.tk.classroomwidgets`. Releases before 0.10.15 used `com.classroomwidgets.dashboard`, so preferences, login-item registration, and macOS permissions from those releases do not carry over automatically.

## Local DMG

```bash
npm run macos:dmg
```

This creates an ad hoc signed local DMG at:

```text
dist/ClassroomWidgets-v<version>-macos.dmg
```

`<version>` comes from `packages/macos-dashboard/version.json`.

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

## Publishing a release

1. Update `packages/macos-dashboard/version.json` and commit the change.
2. Build, validate, and test the signed and notarised DMG from that commit.
3. Tag the validated commit with `macos-v<version>`.
4. Push the commit and tag, then create a GitHub release containing the DMG.

For example, after updating the version file:

```bash
VERSION="$(node -p "require('./packages/macos-dashboard/version.json').version")"
npm run macos:dmg -- --distribution --notarise
git tag "macos-v${VERSION}"
git push origin master "macos-v${VERSION}"
gh release create "macos-v${VERSION}" \
  "dist/ClassroomWidgets-v${VERSION}-macos.dmg" \
  --title "Classroom Widgets for macOS v${VERSION}"
```

Publishing a macOS tag or GitHub release does not deploy the web application.

## Validation

Useful checks:

```bash
codesign -dvvv --entitlements :- "dist/Classroom Widgets Dashboard.app"
codesign --verify --deep --strict --verbose=2 "dist/Classroom Widgets Dashboard.app"
codesign --verify --strict --verbose=2 "dist/ClassroomWidgets-v<version>-macos.dmg"
xcrun stapler validate "dist/ClassroomWidgets-v<version>-macos.dmg"
spctl -a -vv -t open --context context:primary-signature "dist/ClassroomWidgets-v<version>-macos.dmg"
```
