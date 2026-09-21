Display preview shortcut parity and floating-window fixes.

- Configure **Show** and **Dismiss** shortcuts for Display in Settings, just like other widgets. Assign the same key to toggle the preview, or different keys to show and dismiss it independently.
- Existing Display shortcuts become toggles by default. The default remains **Command-Option-Control-0** on macOS and **Ctrl-Alt-Shift-0** on Windows and Linux. Clear either assignment to leave that action unassigned.
- Dismissing Display closes its window, stops capture, and cancels automatic resumption while keeping the saved source and position. Show reuses an existing preview rather than opening duplicates; menu and launcher actions still show it.
- macOS widget and Display windows use nonactivating panels to improve floating behavior across full-screen Spaces.
- Linux automatically uses XWayland in Wayland sessions for floating-window support, unless an explicit Electron backend was supplied. AppImage updates preserve that explicit backend during replacement and rollback.
- Linux keeps shortcut recording active when widget inventory arrives, without losing keyboard focus or reactivating global shortcuts prematurely.

Linux Wayland sessions require XWayland; floating-window stacking and global shortcuts remain compositor-dependent. Display preview requires matching display identities from Electron. X11 has been exercised; native Wayland/PipeWire, physical mixed-DPI displays, and portal capture are not certified by this release's tests. An unverified display identity is rejected rather than guessed.
