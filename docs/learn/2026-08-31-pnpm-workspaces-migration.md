---
title: Moving the monorepo from npm workspaces to pnpm workspaces
date: 2026-08-31
project: classroom-widgets
tags: [monorepo, package-managers, pnpm, docker, build-tooling]
status: unread
---

## The grounding metaphor

Imagine a shared office supply room. With npm workspaces, every time a team needs
a stapler, npm copies a stapler into that team's own desk drawer. Four teams that
all use the same stapler means four identical staplers bought and stored. It works,
but the building fills up with duplicates, and if two teams quietly end up with
slightly different staplers, nobody notices until something jams.

pnpm runs the supply room differently. It keeps exactly one stapler of each kind
in a central cupboard for the whole machine, and each team's drawer gets a
labelled string leading back to it. The drawer looks full, but almost nothing is
actually duplicated. That central cupboard is pnpm's "content-addressable store,"
and the strings are symlinks.

## What we actually did in this project

The repository is a monorepo: one Git repo holding four packages under
`packages/` — `teacher`, `student`, `server`, and a `shared` library the first
three import from. Until now the root `package.json` had a `workspaces` array and
a `package-lock.json`, and every install ran through npm.

The migration swapped the plumbing without touching application code. The
`workspaces` array came out of `package.json` because pnpm reads its package list
from a separate file, `pnpm-workspace.yaml`, which was already present. The root
scripts changed from npm's workspace syntax — `npm run build -w @classroom-widgets/teacher`
— to pnpm's filter syntax — `pnpm --filter @classroom-widgets/teacher build`.
The `package-lock.json` was deleted and a `pnpm-lock.yaml` took its place as the
single source of truth for exact dependency versions.

Inside the two app packages that consume the shared library, the dependency line
changed from `"@classroom-widgets/shared": "*"` to
`"@classroom-widgets/shared": "workspace:*"`. That `workspace:` prefix is an
instruction to pnpm: resolve this from a sibling package in the repo, never from
the public registry, and fail loudly if no such sibling exists. npm workspaces
also resolve a bare `"*"` to the local package, so this was not broken before;
the gain is that `workspace:*` refuses to silently fall back to a registry
package of the same name if the sibling ever goes missing.

Two settings were added to `pnpm-workspace.yaml`. One keeps "pre and post"
lifecycle scripts running, so the root `prebuild` step that generates
voice-command types still fires before a build. pnpm 11 already runs these by
default, so the line is defensive rather than corrective — it pins the behaviour
against a future default change. The other loosens peer-dependency strictness to
match the tolerance the old npm command had with its `--legacy-peer-deps` flag.
An earlier draft of this migration put both in a `.npmrc` file; pnpm 10 stopped
reading `.npmrc` for its own settings and pnpm 11 ignores it entirely, so the
settings only take effect from `pnpm-workspace.yaml`.

The `pnpm-workspace.yaml` file already carried an `allowBuilds` section from a
previous change; this migration only reordered it and added comments. pnpm 10 and
later refuse to run any dependency's install script unless you name it explicitly.
Here only `esbuild` needs its install script — it does not compile anything, it
selects and unpacks the correct pre-built platform binary from an optional
dependency — so it is allowed and everything else stays blocked. This is a
supply-chain safety feature: a malicious package cannot run code on your machine
at install time just by existing in your tree.

The five Dockerfiles were the part that could have broken production. Each one
previously copied `package.json` and `package-lock.json`, then ran `npm ci`. They
now install the pinned pnpm with `npm install -g pnpm@11.22.0` — deliberately not
through `corepack`, because corepack is being moved out of the default Node
distribution and older bundled copies fail to fetch package managers against the
current registry, which is a bad failure mode in an unattended production build.
They also copy `pnpm-lock.yaml` and `pnpm-workspace.yaml` as well, copy every
workspace's `package.json` rather than only the ones the image builds, and run a
filtered `pnpm install --frozen-lockfile` scoped to just the package graph that
image needs. The reason every manifest must still be present is that pnpm reads
the whole workspace graph before it will trust the lockfile; a missing package
directory is a hard error, not a warning.

## Why this choice, and what the alternatives were

The pull toward pnpm is mostly about disk, speed, and correctness. The central
store means one copy of each package version per machine instead of one per
project, which on a repo this size is the difference between hundreds of megabytes
and a few gigabytes across worktrees. Installs are faster because unchanged
packages are hard-linked from the store rather than re-downloaded. And the strict
layout catches "phantom dependencies" — code importing a package it never declared,
which happened to resolve only because npm flattened everything into one big pile.

The cost is that the `node_modules` layout is no longer flat. Most tools handle
the symlinked structure fine now, but occasionally something with its own module
resolver trips on it. In this migration the plain-Node server was the thing to
watch, since it runs `node src/server.js` with no bundler in front of it; it was
tested and resolves its dependencies correctly through the symlinks.

The alternatives considered were staying on npm workspaces, which is the lowest
effort but leaves the disk and phantom-dependency problems in place, and switching
to a "hoisted" pnpm layout that mimics npm's flat pile. The hoisted mode is the
safe halfway house if a stubborn tool refuses to work with symlinks. The default
isolated mode was kept here because nothing needed the escape hatch.

The signal for when you would reach the other way: if a build step or a runtime
starts throwing "cannot find module" for something that is clearly installed, and
the path in the error runs through `.pnpm`, try setting `nodeLinker: hoisted` in
`pnpm-workspace.yaml` before spending an afternoon on it.

## Tiny glossary

- **Monorepo**: one version-control repository containing multiple related
  packages that are developed and released together.
- **Workspace**: one package inside a monorepo that the package manager knows
  about and can link to its siblings.
- **CAS, content-addressable store**: pnpm's per-machine cache where each file is
  stored once under a hash of its contents, and projects link to it.
- **Symlink**: a filesystem entry that points at another location instead of
  holding data itself.
- **Lockfile**: a generated file recording the exact resolved version of every
  dependency, direct and indirect, so installs are reproducible.
- **`workspace:` protocol**: a version specifier telling pnpm to satisfy a
  dependency from a sibling workspace package, never the registry.
- **Phantom dependency**: a package your code imports without declaring it, which
  works only because some other package pulled it in.
- **Corepack**: a launcher bundled with Node that runs the package-manager
  version pinned in `package.json`'s `packageManager` field. Used for local
  development here; the Dockerfiles install pnpm from the npm registry instead,
  because Node is phasing corepack out of the default distribution.
- **`--frozen-lockfile`**: an install mode that fails rather than updating the
  lockfile, used in continuous integration and Docker builds.
- **Lifecycle script**: a script npm or pnpm runs automatically at a set moment,
  such as `prebuild` before `build` or `postinstall` after install.
