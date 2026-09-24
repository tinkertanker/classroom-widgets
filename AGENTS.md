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

## Testing

- Prefer end-to-end tests as the sole way to verify a feature: drive the real
  teacher app, student app, server, or desktop dashboard the way a user would.
  Use them for anything complex, such as a networked widget running across a
  teacher and several students.
- Every E2E run must end by producing a verifiable, repeatable artifact, such as
  screenshots, a video or trace, or a log of the steps and observed results.
  Write it to a known directory (the desktop tests use
  `CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR`), link it in your report, and make sure
  rerunning the same command reproduces it.
- Never write unit tests after you write code. Backfilled tests only restate the
  implementation and fail on refactors instead of bugs.
- If a system truly needs testing in isolation (for example parsing, geometry,
  time arithmetic, auth or rate limits, reconnection races, or a cross-workspace
  contract), first write down every way it could fail. Then write tests for
  those failure modes, and only then write the code.
- Do not add render smoke tests, snapshot or CSS-class assertions, tests that
  echo mocks back, or tests of trivial wrappers, constants, or framework
  behaviour. Delete any such tests you find in code you touch.

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
