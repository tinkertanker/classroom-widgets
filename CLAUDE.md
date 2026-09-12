# Agent Guide

- Keep state derived where possible. Reuse existing shared hooks, components,
  styles, and network infrastructure rather than duplicating them.
- Preserve behaviour across the teacher app, student app, server, and
  `packages/shared` contracts when a change crosses a workspace boundary.
- Do not discard unrelated worktree changes. Stage files explicitly.
- Keep topic-specific documentation in [`docs/`](docs/). Use
  [`README.md`](README.md) and `package.json` for setup and commands.

## Layout and verification

- npm workspaces are `packages/{shared,teacher,student,server}`.
  `packages/macos-dashboard` (SwiftPM), `packages/windows-dashboard` (.NET)
  and `packages/linux-dashboard` (Electron, with its own package-lock,
  installed by `script/build_linux.sh`) are not npm workspaces.
- `npm test` runs the teacher suite only. Run a workspace's own tests directly
  when you change it.
- `packages/shared/voiceCommandDefinitions.json` is the source of truth for the
  generated voice-command constants under `packages/shared/constants/` and
  `packages/server/src/shared/constants/`. Edit the JSON, then run
  `npm run generate:voice-types` (also runs on `prebuild`). Never edit the
  generated files.

## macOS releases

- Signed and notarized macOS builds can be produced on the `yjmbpro` Mac through
  a live Amp runner. That machine has the required Developer ID identity,
  notarization configuration, Xcode toolchain, and `create-dmg` installation.
- Keep signing and notarization credentials on `yjmbpro`; never copy them into
  an orb. Build the exact release commit in a clean checkout and leave unrelated
  changes in the machine's existing checkout untouched.
- Follow [`docs/MACOS_DISTRIBUTION.md`](docs/MACOS_DISTRIBUTION.md) for the
  versioning, validation, tagging, and publication workflow.
