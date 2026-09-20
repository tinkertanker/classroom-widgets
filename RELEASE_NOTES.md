Display preview, a searchable launcher, and desktop updates for macOS, Windows, and Linux.

- Preview an already-connected extended display in a floating window. Capture pauses when the preview overlaps its source; turning it off or closing it cancels automatic resumption. Click a live preview to move the pointer to the corresponding position without clicking there.
- Find widgets in the searchable launcher. Closing the launcher leaves floating widgets running, and launch-at-login stays quiet.
- Configure separate show and dismiss shortcuts for desktop widgets, with clearer feedback when a shortcut is unavailable or conflicts with another assignment.
- Check for desktop updates from the menu bar or system tray. Updates require confirmation and verify the downloaded asset's SHA-256 digest; failed updates now show actionable feedback.
- Classroom recovery preserves session details through temporary throttling or connection failures and offers an explicit retry. Recovery retries retain the original local expiry, and networked activities wait until the classroom is ready before accepting changes.
- Fix Windows preview opacity and capture cleanup during overlap, tighten Linux display-identity checks, and correct server startup after the rate-limiter refactor.
- Restrict shared links to safe URL schemes, require host credentials for classroom recovery, and harden administrative and voice-command endpoints.

Linux display preview requires matching display identities from Electron. X11 has been exercised; Wayland/PipeWire, physical mixed-DPI displays, and portal capture are not certified by this release's tests. An unverified display identity is rejected rather than guessed.
