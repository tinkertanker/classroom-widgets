# Agent Guide

- Read the relevant code before changing it and follow nearby patterns.
- Prefer the smallest correct change; avoid unrelated refactors and new
  abstractions unless they clearly reduce complexity.
- Keep state derived where possible. Reuse existing shared hooks, components,
  styles, and network infrastructure rather than duplicating them.
- Preserve behavior across the teacher app, student app, server, and shared
  contracts when a change crosses workspace boundaries.
- Use explicit types and avoid `any`. Do not edit generated files without
  changing their source of truth.
- Add or update focused tests for behavior changes and run the narrowest useful
  verification before finishing.
- Do not discard unrelated worktree changes. Keep commits atomic and stage
  files explicitly.
- Keep topic-specific documentation in [`docs/`](docs/). Use
  [`README.md`](README.md) and `package.json` for project setup and commands.

## macOS releases

- Signed and notarized macOS builds can be produced on the `yjmbpro` Mac through
  a live Amp runner. That machine has the required Developer ID identity,
  notarization configuration, Xcode toolchain, and `create-dmg` installation.
- Keep signing and notarization credentials on `yjmbpro`; never copy them into
  an orb. Build the exact release commit in a clean checkout and leave unrelated
  changes in the machine's existing checkout untouched.
- Follow [`docs/MACOS_DISTRIBUTION.md`](docs/MACOS_DISTRIBUTION.md) for the
  versioning, validation, tagging, and publication workflow.
