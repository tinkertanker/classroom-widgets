Display preview in the launcher, move-widget display shortcuts on every platform, and a pnpm-based toolchain.

- The desktop widget launcher now includes a Display tile, so the screen preview can be opened from the same searchable grid as every other widget on macOS, Windows and Linux. Fixed extra launcher items rendering in the launchpad's grouped view.
- New configurable Move to Previous/Next Display shortcuts move the focused widget between monitors on all three platforms. macOS defaults to Command-Option-Control-Left/Right, and leaves Move to Next Display unassigned if that chord is already taken. Linux reserves the Display chords so they cannot be reassigned to move shortcuts.
- macOS: Display capture retries the preview window lookup before failing, fixing spurious start failures.
- Build tooling migrated from npm to pnpm across the workspaces, Docker images and CI; platform build scripts now live under `scripts/`.
