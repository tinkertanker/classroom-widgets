# Stable desktop downloads

The homepage (`/about#desktop`) and the web app's bottom-right **Download**
popover use the same platform URLs on the configured backend (`VITE_SERVER_URL`):

| Path | Recommended download |
| --- | --- |
| `/api/downloads/windows` | Windows x64 installer (`.exe`) |
| `/api/downloads/macos` | Signed and notarised macOS disk image (`.dmg`) |
| `/api/downloads/linux` | Linux x86_64 portable AppImage |

These endpoints redirect directly to the matching asset in GitHub's latest
published release. Release metadata is fetched server-side and cached for five
minutes, shared across platforms and concurrent requests. Redirects are not
browser-cached. No GitHub token, version-specific frontend edits, website rebuild,
or additional release automation is required after the initial deployment.

## Publishing a new version

Keep the existing `v<version>` tag and Release workflow. Once that workflow
publishes the new latest release, both web surfaces automatically point to it
within five minutes. Drafts and prereleases are excluded by GitHub's
`releases/latest` API. Pushing a tag alone does not change the downloads before
the release is published.

Asset names must continue to match the release workflow:

- `ClassroomWidgets-v<version>-windows-x64-setup.exe`
- `ClassroomWidgets-v<version>-macos.dmg`
- `ClassroomWidgets-v<version>-linux-x86_64.AppImage`

When macOS is built separately, upload its versioned DMG to the same release
as described in [MACOS_DISTRIBUTION.md](MACOS_DISTRIBUTION.md). The macOS endpoint
returns a temporary 503 with a readable message until that file is uploaded;
the next cache refresh picks it up. It does not silently offer an older version
or send users to the release listing. GitHub lookup failures return a temporary
502 and are also cached to avoid exhausting GitHub's unauthenticated API limit.

## Verification

```sh
node --test packages/server/src/routes/downloads.test.js
pnpm --filter @classroom-widgets/teacher e2e:desktop-downloads
```

The E2E check starts the real app and server, verifies all three redirects against
live GitHub release metadata without downloading large installers, checks popup
keyboard and outside-click behavior, and compares homepage URLs. It writes a
step log and desktop/narrow/dark screenshots to
`$CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR` (or the harness's temporary evidence
directory). Set `CHROME_BIN` to an installed Chromium executable if needed.
