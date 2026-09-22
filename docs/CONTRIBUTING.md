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
3. Add or update tests for changed behavior.
4. Run the checks relevant to your change. For the main teacher workspace, run `npm test`; for a full web build, run `npm run build:all`.
5. Open a pull request that explains the change and how it was verified.

Repository-specific coding and verification guidance is in [`AGENTS.md`](../AGENTS.md).
