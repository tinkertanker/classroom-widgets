Display preview shortcut parity for macOS, Windows, and Linux.

- Configure a single Display shortcut in Settings. The default remains **Command-Option-Control-0** on macOS and **Ctrl-Alt-Shift-0** on Windows and Linux.
- The shortcut opens or focuses the single preview window. Clear the assignment to leave it unassigned; menu and launcher actions also open Display.

Linux display preview requires matching display identities from Electron. X11 has been exercised; Wayland/PipeWire, physical mixed-DPI displays, and portal capture are not certified by this release's tests. An unverified display identity is rejected rather than guessed.
