# Agent Guide

- Keep state derived where possible. Reuse existing shared hooks, components,
  styles, and network infrastructure rather than duplicating them.
- Preserve behaviour across the teacher app, student app, server, and
  `packages/shared` contracts when a change crosses a workspace boundary.
- Do not discard unrelated worktree changes. Stage files explicitly.
- Keep topic-specific documentation in [`docs/`](docs/). Use
  [`README.md`](README.md) and `package.json` for setup and commands.

## Layout and verification

- The repo uses pnpm (Node 22.13+, pnpm 11+). The pnpm workspaces, listed in
  `pnpm-workspace.yaml`, are `packages/{shared,teacher,student,server}`.
  Add dependencies with `pnpm --filter <package> add`; never create a root
  `package-lock.json`.
- `packages/macos-dashboard` (SwiftPM), `packages/windows-dashboard` (.NET)
  and `packages/linux-dashboard` (Electron) are not pnpm workspaces.
  `linux-dashboard` keeps its own `package-lock.json` and stays on npm;
  `scripts/build_linux.sh` installs it.
- pnpm passes `--` through to the script as a literal argument. Pass script
  flags directly, as in `pnpm macos:dmg --distribution`, not
  `pnpm macos:dmg -- --distribution`.
- `pnpm test` runs the teacher suite only. When you change the server, also run
  `pnpm --filter @classroom-widgets/server test`.
- `packages/shared/voiceCommandDefinitions.json` is the source of truth for the
  generated voice-command constants under `packages/shared/constants/` and
  `packages/server/src/shared/constants/`. Edit the JSON, then run
  `pnpm generate:voice-types` (also runs on `prebuild`). Never edit the
  generated files.

## macOS releases

- The Release workflow is configured to build, sign, notarize, and attach the
  macOS DMG in GitHub Actions when `MACOS_RELEASE_IN_CI=true`. Verify the macOS
  job succeeds before attempting a manual build; never print or retrieve Actions
  secret values.
- If CI is unavailable, signed and notarized macOS builds can be produced on an
  authorized Mac through a live Amp runner. Keep signing and notarization
  credentials on that Mac; never copy them into an orb. Build the exact release
  commit in a clean checkout and leave unrelated changes in the machine's
  existing checkout untouched.
- Follow [`docs/MACOS_DISTRIBUTION.md`](docs/MACOS_DISTRIBUTION.md) for the
  versioning, validation, tagging, and publication workflow.
