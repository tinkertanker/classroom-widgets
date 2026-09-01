# macOS app and distribution

Classroom Widgets for macOS is a signed and notarized menu-bar app for opening compact classroom widgets that stay above other apps. It requires macOS 13 or later. The native Swift host embeds a production build of the teacher interface for its widget content.

## Install

1. Open the [GitHub releases page](https://github.com/tinkertanker/classroom-widgets/releases), where the latest release appears first.
2. Download `ClassroomWidgets-v<version>-macos.dmg` and open it.
3. Drag Classroom Widgets to Applications.
4. Launch Classroom Widgets from Applications. It appears in the menu bar rather than the Dock.

Public DMGs are Developer ID signed, notarized by Apple, and stapled. Each release page includes the DMG SHA-256 checksum.

## Use the app

Select the Classroom Widgets menu-bar icon, then **New Floating Widget**. The current macOS app supports:

- Randomiser
- Timer
- List
- Task Cue
- Traffic Light
- Text Banner
- QR Code
- Sound Effects

Each widget opens in its own floating window. Use the standard macOS title bar to move or close it. The menu also provides **Reload Widgets**, **Launch at Login**, **Settings**, **About**, and **Quit**.

Settings include:

- Launch at login
- Show floating widgets on all Spaces
- Floating-widget background opacity
- A configurable global shortcut for opening Settings (default: Command-Option-Comma)

## App identity and upgrades

Finder and macOS display the app as `Classroom Widgets`. The on-disk bundle filename remains `Classroom Widgets Dashboard.app` for upgrade-path compatibility, and the canonical bundle identifier is `sg.tk.classroomwidgets`.

Releases before 0.10.15 used `com.classroomwidgets.dashboard`. Preferences, login-item registration, and macOS permissions from those releases do not carry over automatically, so macOS may ask users to configure them again.

## Local development

Local app builds require macOS, Xcode, Node.js, and the repository's npm dependencies. From the repository root:

```bash
npm run macos:run -- --verify
```

This builds the teacher assets and the Swift package in `packages/macos-dashboard`, writes `dist/Classroom Widgets Dashboard.app`, installs it to `/Applications`, opens it, and verifies that the `ClassroomWidgets` process is running. It replaces any app at the canonical installation path.

Other supported modes are `--debug`, `--logs`, and `--telemetry`; see `script/build_and_run.sh` for their exact behavior.

## Local DMG

Install [`create-dmg`](https://github.com/create-dmg/create-dmg), then run:

```bash
npm run macos:dmg
```

This creates an ad hoc signed local package at `dist/ClassroomWidgets-v<version>-macos.dmg` and installs the built app to `/Applications/Classroom Widgets Dashboard.app`. Use it only for local packaging checks; it is not suitable for public download.

## Developer ID release

Create an untracked `.env.release.local` with the authorized machine's signing and notarization configuration:

```bash
APPLE_SIGNING_IDENTITY="Developer ID Application: Tinkertanker (TEAMID)"
APPLE_TEAM_ID="TEAMID"
APPLE_API_KEY_PATH="/path/to/AuthKey_KEYID.p8"
APPLE_API_KEY_ID="KEYID"
APPLE_API_KEY_ISSUER_ID="ISSUER-UUID"
```

Build a signed DMG without notarizing it:

```bash
npm run macos:dmg -- --distribution
```

Build, notarize, and staple a public-downloadable DMG:

```bash
npm run macos:dmg -- --distribution --notarise
```

The distribution signature uses hardened runtime and `script/macos-distribution-entitlements.plist`, which includes camera access for the Visualiser widget. Successful builds replace the installed app before packaging the DMG.

## Validate a public artifact

Replace `<version>` with the release version, then verify the app, DMG, notarization staple, Gatekeeper assessment, and checksum:

```bash
codesign -dvvv --entitlements :- "dist/Classroom Widgets Dashboard.app"
codesign --verify --deep --strict --verbose=2 "dist/Classroom Widgets Dashboard.app"
codesign --verify --strict --verbose=2 "dist/ClassroomWidgets-v<version>-macos.dmg"
xcrun stapler validate "dist/ClassroomWidgets-v<version>-macos.dmg"
spctl -a -vv -t open --context context:primary-signature "dist/ClassroomWidgets-v<version>-macos.dmg"
shasum -a 256 "dist/ClassroomWidgets-v<version>-macos.dmg"
```

Mount the DMG and repeat the app identity and signature checks against its copy. Confirm that the built, installed, and mounted apps have the same bundle identifier, version, executable hash, and contents before publishing.

## Publish a release

1. Land the release changes and version bump on `master`.
2. Build and validate the signed, notarized DMG from that exact commit on an authorized Mac.
3. Tag that exact commit as `v<version>` and push the tag.
4. Create the matching GitHub release, attach the DMG, and include its SHA-256 in the release notes.
5. Verify the remote tag target, uploaded asset size and digest, and public download URL.

> **Production side effect:** pushing any `v*` tag triggers `.github/workflows/deploy.yml`, which rebuilds and restarts the production web services from `origin/master`. Obtain deployment approval and verify that workflow plus the public web health checks after tagging.
