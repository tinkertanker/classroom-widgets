# Classroom Widgets

Classroom Widgets gives teachers a flexible board of classroom tools, live activities that students can join from any browser, and desktop widgets that stay visible over other apps.

[Open the web app](https://widgets.tk.sg) or install the desktop app for macOS, Windows, or Linux.

## Download

[![Download the latest release](https://img.shields.io/github/v/release/tinkertanker/classroom-widgets?label=Download&style=for-the-badge)](https://github.com/tinkertanker/classroom-widgets/releases/latest)

The latest release contains:

| Platform | Choose this file | Requirements |
| --- | --- | --- |
| macOS | `ClassroomWidgets-v<version>-macos.dmg` | macOS 13 or later |
| Windows | `ClassroomWidgets-v<version>-windows-x64-setup.exe` (recommended) or the portable `.zip` | Windows 10 (1809+) or Windows 11, 64-bit, with the Microsoft Edge WebView2 Runtime |
| Linux | `ClassroomWidgets-v<version>-linux-x86_64.AppImage` or the Debian/Ubuntu `.deb` | 64-bit Linux with a system tray; GNOME requires an AppIndicator extension |

You can also browse [all releases](https://github.com/tinkertanker/classroom-widgets/releases).

## What it does

- **Run live classroom activities:** polls, questions, drop boxes, handouts, and real-time feedback. Students join with a short session code—no app required.
- **Keep everyday tools handy:** timers, randomisers, lists, task cues, traffic lights, text banners, QR codes, sound effects, and more.
- **Build a teaching workspace:** arrange and resize widgets, save layouts, switch themes, and experiment with voice commands.
- **Float widgets over other apps:** the desktop apps provide compact, always-on-top versions of the most useful classroom tools.

## Desktop apps

Launching Classroom Widgets opens a searchable widget launcher. The app also stays available from the menu bar on macOS and the system tray on Windows and Linux for quick access; choose **New Floating Widget** on macOS or **Add Widget** on Windows and Linux. Launch-at-login starts quietly without opening the launcher.

All three desktop apps include Randomiser, Timer, List, Task Cue, Traffic Light, Link Shortener, Text Banner, QR Code, and Sound Effects. The macOS app is signed and notarized, checks for updates, and can update itself. The Windows installer is per-user and does not require administrator access. Linux is available as a portable AppImage or a Debian/Ubuntu package.

For platform-specific installation and usage, see the [macOS](./docs/MACOS_DISTRIBUTION.md), [Windows](./docs/WINDOWS_DISTRIBUTION.md), and [Linux](./docs/LINUX_DISTRIBUTION.md) guides.

## Documentation

- [Developer setup](./docs/GETTING_STARTED.md)
- [Architecture](./docs/architecture.md)
- [Adding a widget](./docs/ADDING_NEW_WIDGET.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Desktop releases](./docs/RELEASING.md)

The macOS app also includes **Display Preview** for showing an already-connected extended display in a floating window. Clicking its live image moves the pointer to the corresponding point without clicking the destination. Screen Recording permission is requested only when you press Start; capture stays on the Mac and stops when you pause or close the preview.

Display Preview was inspired by [BetterDisplay by waydabber](https://betterdisplay.com/). Classroom Widgets implements it independently with public Apple APIs; no BetterDisplay source code or assets are included.

## Contributing

Contributions are welcome. See the [contributing guide](./docs/CONTRIBUTING.md) to get started.

## Related project

The teacher-facing iPad app for creating and sharing self-contained interactive activities lives in [Tapplet](https://github.com/tinkertanker/tapplet).

## License

Classroom Widgets is licensed under the MIT License.
