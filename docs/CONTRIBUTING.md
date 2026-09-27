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
