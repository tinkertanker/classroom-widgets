Instant widget toggling, leaner classrooms, and server-side short links.

- Toggling a desktop widget off now hides its floating window instead of closing it, so toggling back on is instant and keeps the widget's state and position. Dismiss and the window's close button still close it for good. macOS panels reappear promptly when a Space becomes visible again, and clicking a floating panel now activates the app.
- Windows: legacy Display shortcuts that were never assigned stay unassigned through settings migration rather than picking up a default binding.
- Link Shortener and QR Code widgets in the browser now shorten through the classroom server, keeping the Short.io key on the backend. Desktop apps keep their per-device shortener settings.
- Large rooms run leaner: participant updates no longer rebroadcast the full roster, RT Feedback totals accumulate incrementally, and activity grading indexes responses instead of rescanning them. The student app attaches widget listeners once per room, and the teacher app zooms more smoothly.
- Fixed response counts in the admin session list.
- Extensive dead-code removal across the teacher, student, server, and shared packages; no behaviour change intended.

Hidden widgets keep running while toggled off — a hidden timer keeps counting. Self-hosted deployments must set `SHORTIO_API_KEY` and `SHORTIO_DOMAIN` on the backend for web link shortening (see `docs/ENV_SETUP.md`); without them, shortening is unavailable in the browser.
