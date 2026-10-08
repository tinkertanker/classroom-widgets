# Windows App and Distribution

Classroom Widgets for Windows is a system-tray app that opens compact classroom widgets as always-on-top floating panels over other applications. It is the Windows counterpart of the [macOS menu-bar app](./MACOS_DISTRIBUTION.md) and the [Linux tray app](./LINUX_DISTRIBUTION.md), and shares the same web widget code, panel contract, and settings model.

## Requirements

- Windows 10 (1809+) or Windows 11, 64-bit.
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (Evergreen). Windows 11 and up-to-date Windows 10 machines already have it; otherwise install the Evergreen bootstrapper or `choco install webview2-runtime`.
- For building: [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0), Node.js 22.13+, and pnpm 11+ (via `corepack enable`).

## Using the app

Launching the app from the Start menu or desktop shortcut opens a searchable widget launcher. Closing that window leaves widgets running and keeps a **Classroom Widgets** icon in the system tray (it may be under the tray's "hidden icons" chevron until pinned). Launching the app again focuses the existing launcher. Left- or right-click the tray icon for the menu:

| Menu item | What it does |
| --- | --- |
| **Display**, then the widgets | Opens Display or a floating panel for a widget. Widgets are listed most used first, in the order the web app sends them, with separators between groups: Timer and Text Banner; Traffic Light and Task Cue; Randomiser and List; Link Shortener, QR Code and Sound Effects. Each item shows its global show shortcut, if one is assigned. |
| **Arrange Widgets ▸** | Free Placement (restores remembered positions), Arrange in a Row, Arrange in a Column. A row or column goes on the display of the panel you last used; a panel's own arrange button uses that panel's display. Greyed out when no widget is on screen. |
| **Open Widget Launcher** | Opens or focuses the searchable launcher window. |
| **Settings…** | Always on top, launch at login, widget background opacity, customizable global widget shortcuts, reset remembered positions. |
| **Launch at Login** | Toggles the `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` entry. |
| **Check for Updates…** | Checks the latest GitHub release and installs it after confirmation. |
| **Reload Widgets** | Reloads the web host and every panel without losing widget state. |
| **About Classroom Widgets** | Shows the version and opens the project page. |
| **Open Full Web App** | Opens https://widgets.tk.sg in the default browser. |
| **Quit Classroom Widgets** | Flushes pending widget state and exits. |

Launch at login starts quietly without opening the launcher.

Each panel is borderless. Hover its top edge to reveal the chrome row: **×** (remove widget), the title (drag to move), an arrange button, and **+** to add another widget (listed like the tray menu). Resizable widgets can be dragged from any edge; fixed-size widgets (e.g. Traffic Light) cannot. Panel positions are remembered per widget and clamped to the monitor work area on restore.

The first nine widgets in menu order default to **Ctrl-Alt-Shift-1** through **Ctrl-Alt-Shift-9**. Installs from before the menu order changed are renumbered once, but only if every widget shortcut is still its original default; any customised or cleared widget shortcut leaves them all as they are. Settings can change, clear, or restore each global shortcut. An assignment remains saved if Windows cannot register it, and Settings reports the conflict so it can be changed without losing the intended shortcut.

Display has **Show** and **Dismiss** shortcuts in the same settings table, both
defaulting to **Ctrl-Alt-Shift-0**. Matching shortcuts toggle the preview; different
shortcuts act independently. Existing Display Show assignments are retained and
initially copied to Dismiss. Clearing either assignment keeps it unassigned.
Show opens or focuses the single preview window. Dismiss closes it and stops
capture, including overlap resumption, while preserving the saved source and
position. Reopening starts idle. Menu and launcher actions always show Display.
**Move to Previous/Next Display** shortcuts (defaults: Ctrl-Alt-Shift-Left and
Ctrl-Alt-Shift-Right) move the focused widget panel or Display between monitors;
both are configurable in Settings like the others. With another app focused,
the most recently activated widget panel remains the target. Movement preserves
the window's DIP size and physical work-area offset across different display
scales. Moving Display onto its capture source suspends capture immediately;
moving it away resumes capture. Maximized windows are not moved.

Display follows **Keep widgets above other windows**, including changes made
while its preview is open. Showing minimized Display or Settings restores the
existing window rather than creating a second one.

After a WebView2 process failure, the app preserves collected edits while
rebuilding its widget host. If initialization fails, it tries up to three times,
one second apart. If the runtime remains unavailable, use **Reload Widgets**
after resolving the runtime problem to retry without restarting the app.

### Where things live

| Item | Location |
| --- | --- |
| Settings and remembered panel frames | `%LOCALAPPDATA%\ClassroomWidgets\settings.json` |
| Log | `%LOCALAPPDATA%\ClassroomWidgets\classroom-widgets.log` |
| WebView2 profile (widget state, saved Randomiser lists, etc.) | `%LOCALAPPDATA%\ClassroomWidgets\WebView2` |
| Bundled teacher web build | `Web\` next to `ClassroomWidgets.exe` (overridable with `CLASSROOM_WIDGETS_WEB_ROOT`) |

Handy environment variables for debugging: `CLASSROOM_WIDGETS_DEVTOOLS=1` enables F12 dev tools inside panels; `CLASSROOM_WIDGETS_DEBUG_PORT=9333` exposes the Chromium remote-debugging port for all web views.

## Architecture

`packages/windows-dashboard` is a .NET 8 WPF project (with Windows Forms enabled for the `NotifyIcon`) that embeds the production teacher build via WebView2:

- **`WidgetHostController`** owns a hidden WebView2 that loads the teacher app in dashboard/compact mode. That page's React/Zustand store is the single source of truth for widgets; it publishes `widget-panels-changed` inventories through `chrome.webview.postMessage` and exposes `window.classroomPanelHost` for the shell to add/remove widgets and apply panel state.
- **`WidgetPanelCoordinator`** reconciles each inventory against the set of open `WidgetPanelWindow`s, creating/closing native windows, pushing versioned snapshots, and handling layout, frame persistence and reload/quit checkpoints.
- **`WidgetPanelWindow`** is one borderless WPF window per widget hosting a WebView2 on `/?surface=widget-panel&widgetId=…`. It receives snapshots via `window.classroomWidgetPanel.receiveSnapshot(...)` and forwards `panel-state-change`, Randomiser list saves and checkpoint messages back to the host.
- **`TrayController`**, **`SettingsWindow`** and **`DashboardSettings`** provide the tray menu, settings UI and JSON/registry persistence.

The web app talks to either shell through `packages/shared/utils/nativeBridge.ts`: it prefers `window.webkit.messageHandlers[handler]` (macOS) and otherwise posts `{ handler, ...message }` to `window.chrome.webview` (Windows). Web content is served from the virtual host `https://app.classroomwidgets`, mapped to the bundled `Web` folder.

## Building locally

From the repository root on Windows:

```powershell
pnpm install
pnpm windows:run            # builds the teacher app + Debug native app, then launches it
pnpm windows:run -NoRun     # build only
```

or directly:

```powershell
pnpm --filter @classroom-widgets/teacher build:desktop
dotnet build packages/windows-dashboard/ClassroomWidgets.csproj -c Debug
packages\windows-dashboard\bin\Debug\net8.0-windows\ClassroomWidgets.exe
```

The project copies `packages/teacher/build/**` into the output `Web` folder, so rebuild the teacher app whenever web code changes. Only one instance runs at a time (named mutex `Local\ClassroomWidgets.SingleInstance`).

Run native tests on an interactive Windows desktop:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @classroom-widgets/teacher build:desktop
$env:CLASSROOM_WIDGETS_WEB_ROOT = (Resolve-Path packages/teacher/build).Path
$env:CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR = Join-Path $env:TEMP 'classroom-widgets-test-evidence'
dotnet test packages/windows-dashboard/Tests/ClassroomWidgetsTests -c Release
```

The suite references the real application assembly and serializes desktop tests.
It exercises registered hotkeys, minimized window restoration, native topmost
flags, Settings controls, GDI capture, and the real bundled web app. Browser
recovery tests kill only the browser in an isolated WebView2 profile or crash the
launcher's renderer through its own DevTools connection; they verify widget state
and the launcher's actual add action after recovery. Initialization-failure tests
use incompatible options for a separate live browser's isolated profile to cause
a real SDK controller error; they verify automatic retry, a bounded stop, manual
Reload retry and retention of the already-collected List edit, including a second
crash while an earlier recovery is replaying that edit. Checkpoint tests keep a
List edit queued while another panel fails its checkpoint during reload or quit
preparation, then verify the host and rendered List retain the latest edit even
though preparation fails. Recovery-race cases crash the host renderer or browser
after Reload/quit preparation has destructively collected an edit but before its
checkpoint completes. They verify interrupted preparation does not report success
and the recovered host and List retain that edit. Quit checks target the host
preparation API; the existing app-level quit caller still exits on failure. These
checks do not simulate a power loss or prove Chromium disk durability after an
immediate forced termination.

Movement tests run the production `App` and its hotkey wiring in isolated child
processes. They require at least two Windows-visible extended monitors and skip
explicitly on single-monitor machines. The mixed-DPI case needs an adjacent
increase in scale, such as a left display at 100% and a right display at 150%.
A single-monitor CI pass does **not** verify focused Display movement or mixed
DPI. Run those cases with:

```powershell
dotnet test packages/windows-dashboard/Tests/ClassroomWidgetsTests -c Release --filter FullyQualifiedName~NativeMovementTests
```

`CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR` receives rendered captures, browser recovery
logs and movement logs with native bounds/DPI and observed results. Recovery and
movement tests use disposable settings/profile directories, not the user's widget
state. The Desktop tests workflow builds the teacher app, runs this suite for
matching desktop pull requests, and retains its evidence artifact.

## Publishing a release

Windows ships in the shared cross-platform release — see [Releasing](./RELEASING.md). Pushing a `v<version>` tag runs `.github/workflows/release.yml`, whose Windows job builds on a Windows runner and contributes two assets to the release:

- `ClassroomWidgets-v<version>-windows-x64-setup.exe` — per-user Inno Setup installer (no admin rights needed). It offers a **Start Classroom Widgets automatically when I sign in** checkbox, which writes the same `HKCU\...\Run` value the tray "Launch at login" toggle manages, so either can turn it off later. Uninstall is via Windows Settings › Apps.
- `ClassroomWidgets-v<version>-windows-x64.zip` — portable build; unzip anywhere and run `ClassroomWidgets.exe`.

To build the installer locally, install [Inno Setup 6](https://jrsoftware.org/isinfo.php) and run `pnpm windows:publish -Installer` (source in `packages/windows-dashboard/Installer/ClassroomWidgets.iss`).

To build locally instead:

```powershell
pnpm windows:publish
```

This runs `dotnet publish -c Release -r win-x64 --self-contained` into `packages/windows-dashboard/dist`, producing a folder that runs on machines without the .NET runtime (the WebView2 Runtime is still required). Zip that folder as `ClassroomWidgets-v<version>-windows-x64.zip`, or wrap it with an installer of your choice.

The native version comes from the repo-root `version.json` (shared with macOS and Linux) and is independent of the web build ID. It is shown in the tray "About" item and reported to the web app as `__CLASSROOM_WIDGETS_WINDOWS_VERSION__`.

Code signing is not yet configured; unsigned builds trigger SmartScreen on first launch. Sign `ClassroomWidgets.exe` with `signtool` before distributing publicly.

## Automatic updates

The app checks the latest stable GitHub release shortly after launch. Select
**Check for Updates…** from the tray menu to check on demand. It always asks
before downloading and verifies GitHub's published SHA-256 digest before running
the update.

Installed builds run the existing per-user installer silently, preserve the
current launch-at-login choice, and restart. Portable builds download the new
portable ZIP, replace the files beside the running executable after it exits, and
restart from the same location.
