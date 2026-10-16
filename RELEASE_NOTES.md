Faster startup and widget opening, plus a round of widget fixes.

- All platforms: the app starts sooner and widgets open faster, because the launcher now loads alongside the hidden widget host.
- All platforms: fonts are bundled with the app, so widgets no longer fetch them from Google Fonts and look the same offline.
- Timer: adding time no longer drifts, and the countdown animation is smoother.
- Randomiser: a spin no longer restarts unexpectedly, and the overlay only animates while it is spinning.
- Sound Effects: keyboard shortcuts no longer swallow typed digits.
- Task Cue: the cue sound no longer repeats.
- macOS: the compact panel keeps accepting edits after its state changes.
- Linux: widget renderers now run sandboxed.
