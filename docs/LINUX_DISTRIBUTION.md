# Linux App and Distribution

Classroom Widgets for Linux is a system-tray app that opens compact classroom widgets as always-on-top floating panels over other applications. It is the Linux counterpart of the [macOS menu-bar app](./MACOS_DISTRIBUTION.md) and the [Windows tray app](./WINDOWS_DISTRIBUTION.md), and shares the same web widget code, panel contract, and settings model.

## Requirements

- 64-bit Linux with a desktop environment that provides a system tray. On GNOME you need an AppIndicator extension (e.g. *AppIndicator and KStatusNotifierItem Support*); KDE Plasma, Cinnamon and XFCE work out of the box.
- Wayland sessions must provide XWayland. Classroom Widgets automatically uses Electron's X11 backend there because native Wayland does not support the always-on-top, positioning, and non-activating window operations that floating widgets require.
- For building: Node.js 20+.

## Using the app

Launching the app from the desktop application menu opens a searchable widget launcher. Closing that window leaves widgets running and keeps a **Classroom Widgets** icon in the system tray. Launching the app again focuses the existing launcher. Click the tray icon for the menu:

| Menu item | What it does |
| --- | --- |
| **Open Widget Launcher** | Opens or focuses the searchable launcher window. |
| **Add Widget ▸** | Opens a floating panel for Randomiser, Timer, List, Task Cue, Traffic Light, Link Shortener, Text Banner, QR Code, or Sound Effects. |
| **Arrange Widgets ▸** | Free Placement (restores remembered positions), Arrange in a Row, Arrange in a Column. |
| **Reload Widgets** | Reloads the web host and every panel without losing widget state. |
| **Settings…** | Always on top, launch at login, widget background opacity, customizable global widget shortcuts, reset remembered positions. |
| **Launch at Login** | Toggles a `~/.config/autostart/classroom-widgets.desktop` entry. |
| **Open Full Web App** | Opens https://widgets.tk.sg in the default browser. |
| **Check for Updates…** | Checks the latest GitHub release and installs it after confirmation. |
| **Quit** | Flushes pending widget state and exits. |

Launch at login starts quietly without opening the launcher.

On a Wayland desktop, normal launches, launch-at-login, AppImage, and `.deb`
packages all select XWayland automatically. An explicit Electron
`--ozone-platform` command-line flag is left unchanged for diagnostics or advanced
use, but native Wayland cannot provide reliable floating widgets or Display
Preview. If XWayland is disabled in the desktop session, enable it before starting
Classroom Widgets.

Each panel is borderless. Hover its top edge to reveal the chrome row: **×** (remove widget), the title (drag to move), an arrange button, and **+** to add another widget. Resizable widgets can be dragged from any edge; fixed-size widgets (e.g. Traffic Light) cannot. Panel positions are remembered per widget and clamped to the monitor work area on restore.

### Display preview safety

The display preview opens idle. Capture starts only after an explicit click or
power-button action. Moving the preview onto any part of its selected display,
including by rearranging displays, stops capture and clears the image. Moving
fully clear resumes it unless you turned it off or closed it in the meantime.
Pointer clicks map only a live image whose captured display geometry is current.

Capture requires Electron to identify a source with a `display_id` matching the
selected display. A sole source with an empty, missing, or different ID is not
proof of identity; the preview refuses it and reports that the source is
unavailable or display identity is unsupported. Reconnect/select an available
display, or use an X11/XWayland desktop that exposes matching display IDs. There
is no fallback that guesses which display a Wayland/PipeWire portal returned.
Classroom Widgets does not use native Wayland by default because its floating
windows require XWayland; explicitly selecting native Wayland remains unsupported.

### Where things live

| Item | Location |
| --- | --- |
| Settings and remembered panel frames | `~/.config/ClassroomWidgets/settings.json` |
| Log | `~/.config/ClassroomWidgets/classroom-widgets.log` |
| Electron profile (widget state, saved Randomiser lists, etc.) | `~/.config/ClassroomWidgets` |
| Bundled teacher web build | `resources/Web` next to the installed app (overridable with `CLASSROOM_WIDGETS_WEB_ROOT`) |

Handy environment variables for debugging: `CLASSROOM_WIDGETS_DEVTOOLS=1` opens detached dev tools for each web view; `CLASSROOM_WIDGETS_DEBUG_PORT=9333` exposes the Chromium remote-debugging port. `CLASSROOM_WIDGETS_ELECTRON_FLAGS` is passed through to `npm start` by `script/build_linux.sh` — e.g. `CLASSROOM_WIDGETS_ELECTRON_FLAGS="--no-sandbox --disable-gpu"`, needed on some VMs/containers without a SUID sandbox or GPU.

## Architecture

`packages/linux-dashboard` is an Electron + TypeScript package that embeds the production teacher build:

- **`hostController`** owns a hidden BrowserWindow that loads the teacher app in dashboard/compact mode. That page's React/Zustand store is the single source of truth for widgets; it publishes `widget-panels-changed` inventories through the `classroomNativeBridge` preload bridge and exposes `window.classroomPanelHost` for the shell to add/remove widgets and apply panel state.
- **`panelCoordinator`** reconciles each inventory against the set of open `WidgetPanelWindow`s, creating/closing native windows, pushing versioned snapshots, and handling layout, frame persistence and reload/quit checkpoints.
- **`panelWindow`** is one borderless Electron window per widget: its own page renders the chrome strip while a `WebContentsView` below it loads `/?surface=widget-panel&widgetId=…`. It receives snapshots via `window.classroomWidgetPanel.receiveSnapshot(...)` and forwards `panel-state-change`, Randomiser list saves and checkpoint messages back to the host.
- **`tray`**, **`settingsWindow`** and **`settings`** provide the tray menu, settings UI and JSON persistence.

The web app talks to the shell through `packages/shared/utils/nativeBridge.ts`: it prefers `window.webkit.messageHandlers[handler]` (macOS), then `window.classroomNativeBridge` (Linux/Electron), then `window.chrome.webview` (Windows). Web content is served from the privileged `app://classroomwidgets` scheme, mapped to the bundled `Web` folder with SPA fallback to `index.html`.

## Building locally

From the repository root on Linux:

```bash
npm install
npm run linux:run                 # builds the teacher app + native code, then launches it
npm run linux:run -- --no-run     # build only
```

or directly:

```bash
npm run build -w @classroom-widgets/teacher
cd packages/linux-dashboard && npm install && npm run build && npm start
```

`packages/linux-dashboard` is intentionally **not** an npm workspace — it carries its own `package-lock.json` so Electron stays out of server and Docker installs. Rebuild the teacher app whenever web code changes. Only one instance runs at a time (Electron single-instance lock).

After building both packages, run the shortener integration check from the
repository root (install `xvfb` on headless Linux):

```bash
xvfb-run -a packages/linux-dashboard/node_modules/.bin/electron --no-sandbox --disable-gpu packages/linux-dashboard/tests/shortener.cjs
```

This uses disposable preferences and real Electron panels to check native
settings, persistence, live updates, reloads, and the widget's settings gear.
It makes no shortening requests. Set `SCREENSHOT_DIR` to an existing directory
to capture the default and Short.io Settings screens.

The first nine available widget types default to **Ctrl-Alt-Shift-1** through **Ctrl-Alt-Shift-9**. Settings can change, clear, or restore each shortcut. Per-widget launch shortcuts use Electron's global shortcut API. They work on X11, but a Wayland compositor may restrict global shortcuts from XWayland applications; an assigned shortcut can therefore remain saved while Settings reports it as unavailable. Users should resolve compositor or application conflicts rather than expecting every Wayland session to accept global shortcuts.

## Publishing a release

Linux ships in the shared cross-platform release — see [Releasing](./RELEASING.md). Pushing a `v<version>` tag runs `.github/workflows/release.yml`, whose Linux job builds on an Ubuntu runner and contributes `ClassroomWidgets-v<version>-linux-x86_64.AppImage` and `ClassroomWidgets-v<version>-linux-amd64.deb` to the release.

To build locally instead:

```bash
npm run linux:publish
```

This runs `electron-builder --linux` into `packages/linux-dashboard/dist`, producing an AppImage and a `.deb`. The AppImage is self-contained; the `.deb` installs under `/opt/Classroom Widgets`.

The native version comes from the repo-root `version.json` (shared with macOS and Windows; passed to electron-builder via `-c.extraMetadata.version`) and is independent of the web build ID. It is shown in the tray "About" item and reported to the web app as `__CLASSROOM_WIDGETS_LINUX_VERSION__`.

Code signing is not configured; AppImages and .deb packages run unsigned.

## Automatic updates

Packaged builds check for a newer stable GitHub release shortly after launch. You
can also select **Check for Updates…** from the tray menu. The app always asks
before downloading and verifies GitHub's published SHA-256 digest before running
an update.

- AppImage builds replace the running AppImage in place and restart it.
- Debian/Ubuntu installs ask PolicyKit for permission to install the downloaded
  `.deb`, then restart. If no graphical PolicyKit agent is available, the app
  opens the package in the desktop package manager for manual confirmation.

Development builds do not check for updates.
