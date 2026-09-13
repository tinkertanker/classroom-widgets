# Windows App and Distribution

Classroom Widgets for Windows is a system-tray app that opens compact classroom widgets as always-on-top floating panels over other applications. It is the Windows counterpart of the [macOS menu-bar app](./MACOS_DISTRIBUTION.md) and the [Linux tray app](./LINUX_DISTRIBUTION.md), and shares the same web widget code, panel contract, and settings model.

## Requirements

- Windows 10 (1809+) or Windows 11, 64-bit.
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (Evergreen). Windows 11 and up-to-date Windows 10 machines already have it; otherwise install the Evergreen bootstrapper or `choco install webview2-runtime`.
- For building: [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) and Node.js 18+.

## Using the app

The app has no main window. After launch a **Classroom Widgets** icon appears in the system tray (it may be under the tray's "hidden icons" chevron until pinned). Left- or right-click it for the menu:

| Menu item | What it does |
| --- | --- |
| **Add Widget ▸** | Opens a floating panel for Randomiser, Timer, List, Task Cue, Traffic Light, Text Banner, QR Code, or Sound Effects. |
| **Arrange Widgets ▸** | Free Placement (restores remembered positions), Arrange in a Row, Arrange in a Column. |
| **Reload Widgets** | Reloads the web host and every panel without losing widget state. |
| **Settings…** | Always on top, launch at login, widget background opacity, reset remembered positions. |
| **Launch at Login** | Toggles the `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` entry. |
| **Open Full Web App** | Opens https://widgets.tk.sg in the default browser. |
| **Quit** | Flushes pending widget state and exits. |

Each panel is borderless. Hover its top edge to reveal the chrome row: **×** (remove widget), the title (drag to move), an arrange button, and **+** to add another widget. Resizable widgets can be dragged from any edge; fixed-size widgets (e.g. Traffic Light) cannot. Panel positions are remembered per widget and clamped to the monitor work area on restore.

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
npm install
npm run windows:run            # builds the teacher app + Debug native app, then launches it
npm run windows:run -- -NoRun  # build only
```

or directly:

```powershell
npm run build -w @classroom-widgets/teacher
dotnet build packages/windows-dashboard/ClassroomWidgets.csproj -c Debug
packages\windows-dashboard\bin\Debug\net8.0-windows\ClassroomWidgets.exe
```

The project copies `packages/teacher/build/**` into the output `Web` folder, so rebuild the teacher app whenever web code changes. Only one instance runs at a time (named mutex `Local\ClassroomWidgets.SingleInstance`).

## Publishing a release

Windows ships in the shared cross-platform release — see [Releasing](./RELEASING.md). Pushing a `v<version>` tag runs `.github/workflows/release.yml`, whose Windows job builds on a Windows runner and contributes two assets to the release:

- `ClassroomWidgets-v<version>-windows-x64-setup.exe` — per-user Inno Setup installer (no admin rights needed). It offers a **Start Classroom Widgets automatically when I sign in** checkbox, which writes the same `HKCU\...\Run` value the tray "Launch at login" toggle manages, so either can turn it off later. Uninstall is via Windows Settings › Apps.
- `ClassroomWidgets-v<version>-windows-x64.zip` — portable build; unzip anywhere and run `ClassroomWidgets.exe`.

To build the installer locally, install [Inno Setup 6](https://jrsoftware.org/isinfo.php) and run `npm run windows:publish -- -Installer` (source in `packages/windows-dashboard/Installer/ClassroomWidgets.iss`).

To build locally instead:

```powershell
npm run windows:publish
```

This runs `dotnet publish -c Release -r win-x64 --self-contained` into `packages/windows-dashboard/dist`, producing a folder that runs on machines without the .NET runtime (the WebView2 Runtime is still required). Zip that folder as `ClassroomWidgets-v<version>-windows-x64.zip`, or wrap it with an installer of your choice.

The native version comes from the repo-root `version.json` (shared with macOS and Linux) and is independent of the web build ID. It is shown in the tray "About" item and reported to the web app as `__CLASSROOM_WIDGETS_WINDOWS_VERSION__`.

Code signing is not yet configured; unsigned builds trigger SmartScreen on first launch. Sign `ClassroomWidgets.exe` with `signtool` before distributing publicly.
