# Student poll submission pilot

`packages/student/hooks/pollSubmission.ts` owns local submission transitions;
`usePollSocket` owns socket listeners and the five-second confirmation deadline.
`PollActivity` renders that state. Activity and connectivity remain separate axes.
There is no server, teacher-recovery, participant-identity or protocol change.

## Feedback and recovery contract

- **Idle:** an active, connected poll accepts one choice (mouse or keyboard).
- **Sending:** keep the choice visible, prevent repeated submissions. A count
  broadcast is not evidence that this particular student's answer was accepted.
- **Acknowledged:** only a successful confirmation for a pending submission
  establishes acceptance. Preserve it through pause/resume and teacher recovery.
- **Rejected:** a definitive unsuccessful confirmation clears the pending choice
  and permits retry when active and connected. Error codes, including
  `ALREADY_VOTED`, never manufacture success.
- **Uncertain:** after five seconds without confirmation, or immediately on
  disconnect during submission, say the vote *may* have counted. Preserve the
  choice, do not automatically resend or enable a potentially duplicate retry.
  A delayed confirmation on the same uninterrupted poll/connection can resolve a
  timeout. Ask the teacher to reset before trying again if confirmation is lost.
- **Reset/options changed:** clear the choice and error and restore eligibility.
  Question-only edits do not reset eligibility. A zero-count state snapshot also
  restores eligibility, retaining the existing missed-reset recovery behavior.

Listeners and timers are cleaned up on unmount; a queued timeout checks the exact
submission object so it cannot expire a later attempt. The synchronous reducer
transition guards repeated actions before React renders the disabled choices.

## Deliberate limits

Confirmations contain `success` and `widgetId`, but no attempt or poll-generation
ID. Ignore them while idle or already acknowledged and isolate widget IDs. If a
reset overlaps an unresolved submission, the next confirmation could describe
either poll. Keep confirmation unsafe for the remainder of that mounted
submission lifecycle: new choices can be sent after a reset, but their untagged
acknowledgments cannot honestly establish success. A disconnect likewise makes a
pending confirmation unsafe. Aggregate state after rejoin cannot prove whose
vote counted. Stronger recovery needs correlated server confirmations/status,
not another client boolean. Arbitrarily duplicated confirmations arriving during
a later retry and stale unversioned state snapshots cannot be fully correlated
by this client-only pilot either. Socket.IO normally preserves delivery order.

Refresh creates a different socket identity and can permit another counted vote.
This pilot neither solves that identity issue nor recommends refreshing to retry.
Actual session-loss card removal remains owned by the existing student app flow.

## Repeatable verification

The E2E test starts the real teacher, student and server. It holds/drops or injects
Socket.IO delivery at the browser transport boundary, not mock hook responses.
The initial red run on the old implementation timed out after 12 seconds waiting
for uncertain feedback: the UI still said “Sending your vote…”.

From the repository root, with Chromium and Playwright's FFmpeg installed:

```sh
pnpm --filter @classroom-widgets/teacher exec playwright-core install chromium ffmpeg
CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR="$PWD/.amp/in/artifacts/poll-submission" \
  pnpm --filter @classroom-widgets/teacher e2e:poll-submission
```

`CHROME_BIN` can select an already installed Chromium. The evidence directory
contains `poll-submission.txt`, screenshots of ready/sending/uncertain/acknowledged/
rejected/reset-uncertain/disconnected states, and `poll-submission.webm` with a
visible moving pointer. Each rerun regenerates the named evidence.

The test covers delayed/lost acknowledgments, aggregate-before-confirmation,
repeated actions, widget isolation, duplicate rejection after success, stale
success while idle, pause-race rejection and retry, pause/resume, teacher reload
with authoritative counts, question-only edits, changed options, keyboard voting,
reset during flight with obsolete confirmations, and an accepted vote followed
by actual disconnect/rejoin without automatic resubmission. It checks successful
server acceptance before the disconnect, and observes rejoin over both polling
and WebSocket transports. Rounds respect the real two-submissions/second limit.

Neighbor checks: `pnpm typecheck`, `pnpm test --run`, and
`pnpm --filter @classroom-widgets/server test`. Chromium checks are not real-device
or Safari validation; this test is an explicit E2E command, not part of `pnpm test`.
