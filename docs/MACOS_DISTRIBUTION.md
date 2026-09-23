# macOS app and distribution

Classroom Widgets for macOS is a signed and notarized desktop and menu-bar app for opening compact classroom widgets that stay above other apps. It requires macOS 13 or later. The native Swift host embeds a production build of the teacher interface for its widget content.

## Install

1. Open the [GitHub releases page](https://github.com/tinkertanker/classroom-widgets/releases), where the latest release appears first.
2. Download `ClassroomWidgets-v<version>-macos.dmg` and open it.
3. Drag Classroom Widgets to Applications.
4. Launch Classroom Widgets from Applications. Its widget launcher appears in the Dock, and quick actions remain available from the menu bar.

Public DMGs are Developer ID signed, notarized by Apple, and stapled. Each release page includes the DMG SHA-256 checksum.

## Use the app

Launch Classroom Widgets from Applications or select **Open Widget Launcher** from its menu-bar menu to browse and search the available widgets. For faster access, select **New Floating Widget** directly from the menu. The current macOS app supports:

- Randomiser
- Timer
- List
- Task Cue
- Traffic Light
- Text Banner
- QR Code
- Link Shortener
- Sound Effects

Each widget opens in its own floating window. Closing the launcher does not close the widgets or quit the app; use Command-Q or **Quit** to exit. Clicking the Dock icon reopens the launcher. Launch at login starts the app without presenting the launcher. The menu also provides **Reload Widgets**, **Launch at Login**, **Settings**, **About**, and **Quit**.

Settings include:

- Launch at login
- Show floating widgets on all Spaces
- Floating-widget background opacity
- Link shortening provider: TinyURL (default, no sign-up), spoo.me, or Short.io
- A configurable global shortcut for opening Settings (default: Command-Option-Comma)
- Configurable global shortcuts for launching each widget (the first nine default to Command-Option-Control-1 through 9)

Display has separate **Show** and **Dismiss** shortcuts, both defaulting to
**Command-Option-Control-0**. Matching shortcuts toggle the preview; different
shortcuts act independently. Existing Display Show assignments are retained and
initially copied to Dismiss. Clearing either assignment keeps it unassigned.
Menu and launcher actions always show Display. **Move to Previous/Next
Display** shortcuts (defaults: Command-Option-Control-Left and
Command-Option-Control-Right) move the focused widget panel between monitors;
both are configurable in Settings like the others. Reopening keeps the
existing macOS source-selection and screen-recording permission behavior.

The **Link Shortener** settings tab stores the provider and optional Short.io public
key/domain in this Mac's preferences. All floating Link Shortener and QR Code
widgets share these settings, including newly opened widgets. Widget settings
buttons open the native Settings window. Use a public `pk_...` key, never a secret
API key. Creating a short link sends its destination URL to the selected provider.

## Automatic updates

The installed app checks the latest stable GitHub release shortly after launch.
Select **Check for Updates…** from the menu-bar menu to check on demand. The app
asks before downloading, verifies the release asset's published SHA-256 digest,
bundle identifier, version, and code signature, then replaces and restarts itself.
The app must be run from a writable location such as `/Applications`; a copy still
running from a mounted DMG cannot replace itself.

The DMG remains the first-install artifact. Each release also includes
`ClassroomWidgets-v<version>-macos.zip`, which contains the signed app used only
by automatic updates.

QR Code can optionally shorten a link before encoding it. If shortening fails or
takes more than 15 seconds, it displays the original URL's QR code so the lesson
can continue. School networks may block particular shortener domains; test the
result on student devices and select another provider if needed.

These runtime controls are desktop-only. The website retains its build-time
Short.io configuration and does not expose the provider picker or QR shortening.

## App identity and upgrades

Finder and macOS display the app as `Classroom Widgets`. The on-disk bundle filename remains `Classroom Widgets Dashboard.app` for upgrade-path compatibility, and the canonical bundle identifier is `sg.tk.classroomwidgets`.

Releases before 0.10.15 used `com.classroomwidgets.dashboard`. Preferences, login-item registration, and macOS permissions from those releases do not carry over automatically, so macOS may ask users to configure them again.

## Versioning

The desktop apps (macOS, Windows, Linux) share one version, independent of web deployments. The source of truth is the repo-root `version.json`. That version is written to `CFBundleShortVersionString`, the DMG filename, and the version label shown by the embedded teacher UI. `CFBundleVersion` is a separate monotonically increasing build number and defaults to a timestamp for release builds.

Releases are tagged `v<version>` and contain all platforms; see [Releasing](./RELEASING.md). Older `v0.10.x` / `macos-v*` tags remain valid historical macOS-only releases.

## Local development

Local app builds require macOS, Xcode, Node.js, and the repository's pnpm dependencies. From the repository root:

```bash
pnpm macos:run --verify
```

This builds the teacher assets and the Swift package in `packages/macos-dashboard`, writes `dist/Classroom Widgets Dashboard.app`, installs it to `/Applications`, opens it, and verifies that the `ClassroomWidgets` process is running. It replaces any app at the canonical installation path.

Other supported modes are `--debug`, `--logs`, and `--telemetry`; see `scripts/build_and_run.sh` for their exact behavior.

## Local DMG

Install [`create-dmg`](https://github.com/create-dmg/create-dmg), then run:

```bash
pnpm macos:dmg
```

This creates an ad hoc signed local package at `dist/ClassroomWidgets-v<version>-macos.dmg` and installs the built app to `/Applications/Classroom Widgets Dashboard.app`. The version comes from the repo-root `version.json`. Use this only for local packaging checks; it is not suitable for public download.

## Developer ID release

The authorized release host is `yjmbpro`. Use a live Amp runner on that Mac for
public builds; runner IDs are ephemeral, so select it by host or runner name.
It has the Developer ID signing identity, local notarization configuration,
Xcode toolchain, and `create-dmg` required by this workflow. Keep those
credentials on the Mac and never transfer them through an orb. Build from a
clean checkout pinned to the intended commit, without resetting or cleaning an
existing checkout that contains unrelated work.

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
pnpm macos:dmg --distribution
```

Build, notarize, and staple a public-downloadable DMG:

```bash
pnpm macos:dmg --distribution --notarise
```

The distribution signature uses hardened runtime and `scripts/macos-distribution-entitlements.plist`, which includes camera access for the Visualiser widget. Successful builds replace the installed app before packaging the DMG.

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

The full cross-platform process is in [Releasing](./RELEASING.md). The macOS-specific part:

1. Once the `v<version>` tag is pushed and the Release workflow has created the GitHub release, check out that exact tag on an authorized Mac.
2. Build and validate the signed, notarized DMG (sections above).
3. Upload the DMG and update ZIP and add their SHA-256 values to the release description:

   ```bash
   VERSION="$(node -p "require('./version.json').version")"
   pnpm macos:dmg --distribution --notarise
   gh release upload "v${VERSION}" \
     "dist/ClassroomWidgets-v${VERSION}-macos.dmg" \
     "dist/ClassroomWidgets-v${VERSION}-macos.zip"
   shasum -a 256 "dist/ClassroomWidgets-v${VERSION}-macos.dmg" \
     "dist/ClassroomWidgets-v${VERSION}-macos.zip"
   ```

4. Verify the uploaded asset size and digest and the public download URL.

Alternatively configure the Apple signing secrets described in [Releasing](./RELEASING.md) so the workflow builds and attaches the DMG itself.

Publishing a release tag does not deploy the web application.
