# Desktop app icons

## macOS

In **Settings → General → App Icon**, choose **Dock and menu bar** (the
default), **Dock only**, or **Menu bar only**. Quit and reopen Classroom
Widgets to apply the change. There is no option to hide both entry points.

Right-click the Dock icon for widget shortcuts, Arrange Widgets, Open Widget
Launcher, Settings, Launch at Login, updates, and About. These use the same
actions and current widget list as the menu-bar menu. macOS supplies the Dock
menu's standard Quit action.

Menu-bar-only mode also removes the app from Command-Tab. Opening the app
normally still opens the widget launcher; launch-at-login and `--background`
start quietly. Opening the app again brings the launcher back in every mode.

## Windows and Linux

These apps stay available from the system tray. Launcher, Settings, and Display
taskbar entries are window-specific. Widget panels are configured to stay out
of the taskbar, but Linux behavior varies: KDE Plasma 5.24.7 on X11 showed a
Timer entry during verification. Closing all windows leaves the tray as the
persistent entry point; hiding the tray icon could leave no visible app access.
The macOS setting does not change these platforms.

## Manual verification

Build and run the native app on each platform; record the steps and visible
results.

- On macOS, switch through all three choices in Settings, quit, and reopen.
  Confirm the selected icons, persistence, and that a normal launch opens the
  launcher. Check that the selection does not remove an icon before restart.
- In Dock-only mode, close the launcher and all widget windows. Reopen the
  launcher from the Dock; use the Dock menu to add a widget, arrange widgets,
  and open Settings. Confirm Arrange is disabled when no widgets are visible
  and that the Dock widget order matches the menu-bar menu.
- In menu-bar-only mode, open Settings and widgets from the menu bar, and
  confirm the app does not appear in Command-Tab. Relaunch with `--background`
  and confirm it does not open the launcher. Check floating widgets over a
  full-screen app without changing their existing panel behavior.
- On Windows and Linux, verify the existing tray actions, closing/reopening
  the launcher, and whether taskbar entries disappear when their windows close.
