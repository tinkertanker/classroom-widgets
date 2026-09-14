# Releasing the desktop apps

The macOS, Windows and Linux apps share one version number and ship together in one GitHub release. The source of truth is the repo-root `version.json`; the web app is deployed separately by commit (see [Deployment](./DEPLOYMENT.md)).

## Cutting a release

1. Bump `version.json` and rewrite `RELEASE_NOTES.md` with the "What's new" bullets for this version. Land both on `master`.
2. Tag that commit and push the tag:

   ```bash
   VERSION="$(node -p "require('./version.json').version")"
   git tag "v${VERSION}"
   git push origin "v${VERSION}"
   ```

3. The **Release** workflow (`.github/workflows/release.yml`) builds the Windows installer + portable zip, Linux AppImage + `.deb`, and—when `MACOS_RELEASE_IN_CI=true`—the signed and notarised macOS DMG. It then publishes a release named **Classroom Widgets v\<version\>** whose description is: intro, `RELEASE_NOTES.md`, per-platform download and install notes, supported widgets, and SHA-256 for every attached asset. The workflow fails if the tag does not match `version.json`.
4. Verify all three build jobs and their release assets. If the macOS job was skipped because CI signing is disabled, build and attach the DMG manually (see below).

Asset names are fixed:

| Platform | Asset |
| --- | --- |
| macOS | `ClassroomWidgets-v<version>-macos.dmg` |
| Windows | `ClassroomWidgets-v<version>-windows-x64-setup.exe`, `ClassroomWidgets-v<version>-windows-x64.zip` |
| Linux | `ClassroomWidgets-v<version>-linux-x86_64.AppImage`, `ClassroomWidgets-v<version>-linux-amd64.deb` |

## macOS DMG

The repository is configured to build the signed and notarised DMG in CI. The `macos` job runs when the repository variable `MACOS_RELEASE_IN_CI` is `true` and the required Actions secrets below are present. Secrets are write-only: verify their names with `gh secret list --repo tinkertanker/classroom-widgets`, but never print, retrieve, or copy their values into an orb.

If CI signing is disabled or unavailable, build on an authorised Mac from the tagged commit and upload the DMG to the release the workflow created:

```bash
git checkout "v${VERSION}"
npm run macos:dmg -- --distribution --notarise
gh release upload "v${VERSION}" "dist/ClassroomWidgets-v${VERSION}-macos.dmg"
shasum -a 256 "dist/ClassroomWidgets-v${VERSION}-macos.dmg"   # add to the release description
```

Validation steps are in [macOS distribution](./MACOS_DISTRIBUTION.md). Do not perform this manual path merely because the macOS CI job is still running; first inspect the workflow result.

CI requires these Actions secrets; when enabled, the DMG and its SHA-256 appear in the release automatically:

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE_P12_BASE64` | Developer ID Application certificate + private key, exported as `.p12`, base64-encoded |
| `APPLE_CERTIFICATE_PASSWORD` | Password of that `.p12` |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Tinkertanker Pte Ltd (TEAMID)` |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `APPLE_API_KEY_ID`, `APPLE_API_KEY_ISSUER_ID`, `APPLE_API_KEY_P8` | App Store Connect API key for notarisation (`.p8` contents) |

## Platform-only fixes

Every release carries all platforms, so a Windows-only fix is still a full `v<version>` release; the other platforms simply rebuild unchanged. Note it in `RELEASE_NOTES.md` (e.g. "Windows: fixed ...").

## History

Before `v0.11.0`, each platform was tagged and released separately (`macos-v*`/`v0.10.x`, `windows-v0.1.x`, `linux-v0.1.0`). Those releases remain valid.
