# Contributing

Contributions to Classroom Widgets are welcome.

## Before you start

Read the [developer setup guide](./GETTING_STARTED.md) to install dependencies and run the teacher app, student app, and server locally. The [architecture guide](./architecture.md) explains the repository structure and major systems.

For focused changes, these references may also help:

- [Adding a widget](./ADDING_NEW_WIDGET.md)
- [Socket events](./SOCKET_EVENTS.md)
- [macOS app](./MACOS_DISTRIBUTION.md)
- [Windows app](./WINDOWS_DISTRIBUTION.md)
- [Linux app](./LINUX_DISTRIBUTION.md)

## Make a contribution

1. Fork the repository and create a focused branch.
2. Follow the existing patterns and keep unrelated changes out of the branch.
3. Verify changed behaviour according to the testing rules in [`AGENTS.md`](../AGENTS.md#testing).
4. Run the checks relevant to your change. For the main teacher workspace, run `pnpm test`; for a full web build, run `pnpm build:all`.
5. Open a pull request that explains the change and how it was verified.

Repository-specific coding and verification guidance is in [`AGENTS.md`](../AGENTS.md).

## Browser end-to-end checks

Browser checks live in `packages/teacher/e2e/`. Each one starts the server, the teacher app and the student app on free ports and drives them with `playwright-core`. The first time, install a matching Chromium with `pnpm --filter @classroom-widgets/teacher exec playwright-core install chromium`, or set `PLAYWRIGHT_BROWSERS_PATH` to an existing install.

To check the Drop Box "Copy all" and "Download CSV" buttons, run:

```bash
pnpm --filter @classroom-widgets/teacher e2e:dropbox
```

Four student pages submit through the student app. The check then asserts the clipboard text and the downloaded CSV. It writes `dropbox-export.txt` (each step and what it observed), `clipboard.txt`, `download.csv` and screenshots to `CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR` (default: a `classroom-widgets-test-evidence/dropbox-export` directory under the system temp directory).

To check activity state requests and host pause/resume, run:

```bash
pnpm --filter @classroom-widgets/teacher e2e:activity-state
```

This creates both fill-blank activity types through the teacher app, then joins,
reloads and rejoins through the student app, including while paused. It counts
Socket.IO requests, replies and activation notifications over both polling and
WebSocket transports to detect request/reply loops. `CHROME_BIN` can select an
existing Chromium executable. Results go to `activity-state.txt` in
`CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR` (default:
`classroom-widgets-test-evidence/activity-state` under the system temp directory).

To check that live-feedback aggregates go only to the teacher, run:

```bash
pnpm --filter @classroom-widgets/teacher e2e:feedback-delivery
```

Three real student pages submit and replace slider scores. The check verifies
teacher histograms, student acknowledgments, teacher reconnection, clear and
pause/resume while counting unused student aggregate deliveries. `CHROME_BIN`
can select an existing Chromium. It writes `feedback-delivery.txt` to
`CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR` (default:
`classroom-widgets-test-evidence/feedback-delivery` under the system temp directory).

To check on-demand widget loading against the production bundle, run:

```bash
pnpm --filter @classroom-widgets/teacher e2e:widget-loading
```

This builds with a manifest, checks that an empty workspace requests no widget
entry chunks, and opens, starts, pauses and reloads a Timer without loading other
widgets. Set `CHROME_BIN` to use an existing Chromium executable instead of the
Playwright-managed browser. The request counts, uncompressed JavaScript bytes and
restored Timer screenshot go to `CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR` (default:
`classroom-widgets-test-evidence/widget-loading` under the system temp directory).

After that build and `npm --prefix packages/linux-dashboard run build`, check the
same behavior in the real Linux host, launcher and panel:

```bash
xvfb-run -a packages/linux-dashboard/node_modules/.bin/electron --no-sandbox --disable-gpu --force-device-scale-factor=2 packages/linux-dashboard/tests/widgetLoading.cjs
```

The Linux check uses disposable settings and writes `widget-loading.txt` and
`timer-restored.png` to `CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR` (default:
`classroom-widgets-test-evidence/linux-widget-loading` under the system temp directory).

To check compact-host state caching after building the teacher app and Linux
dashboard, run:

```bash
xvfb-run -a packages/linux-dashboard/node_modules/.bin/electron --no-sandbox --disable-gpu packages/linux-dashboard/tests/compactStateCache.cjs
```

This creates six 100-row Lists and types through a real panel. It counts host
state clones and signature serializations, verifies unchanged state revisions,
hide/show and immediate pending-edit recovery after host reload. It writes
`compact-state-cache.txt` and `list-restored.png` to
`CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR` (default:
`classroom-widgets-test-evidence/compact-state-cache` under the system temp directory).

To measure never-shown hidden Linux panels and check their lifecycle, use the
same builds and run each startup sample in a separate process:

```bash
for count in 0 10 30; do
  xvfb-run -a packages/linux-dashboard/node_modules/.bin/electron --no-sandbox --disable-gpu packages/linux-dashboard/tests/hiddenPanels.cjs --count=$count || break
done
```

This restores hidden Lists from disposable workspace storage and records panel
windows, renderer processes and private memory from Linux `/proc`. The 10-List
case also verifies first reveal uses the latest state and saved frame, real edits,
hide/show reuse, genuine host reload and a hidden Timer's countdown/alarm attempt.
Never-shown passive panels are deferred; audio-capable and previously created
panels stay alive. Missing capability metadata keeps older bundles eager.
Results (`memory-<count>.json`, `hidden-panels-<count>.txt`, `list-restored.png`)
go to `CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR` (default:
`classroom-widgets-test-evidence/hidden-panels` under the system temp directory).
