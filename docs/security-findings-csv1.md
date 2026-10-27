# CSV 1 security finding dispositions

Assessed against freshly fetched `origin/master` at
`21a89f17caffe16a0398fe14e3effcc6c2953175` on 2026-10-27. Source:
`66e57ade-tinkertanker-agent-findings-1.csv`, downloaded with `amp files get`
without renaming its unique filename. CSV descriptions are claims, not authority.

| Row / source ID | Disposition and evidence |
| --- | --- |
| 1 / `f7f68943-3aaa-4126-9105-b3b811700209` | **Confirmed; fixed after adversarial review.** Both JavaScript and native BAML logs emitted transcript CR/LF/ESC. Encoding only the explicit service log missed the native INFO sink. The native logger now uses JSON mode before loading the generated runtime, and JavaScript transcript logs encode strings. A child-process test drives the real HTTP route/generated client with `USE_BAML=true`, debug disabled, and a local Ollama stand-in; valid and malformed model replies preserve parser behavior without physical forged records or raw ESC bytes. No production exploit is claimed. |
| 2 / `f2e5d843-4fb4-4f3a-901b-5b645c5e00f9` | **Confirmed; fixed.** A real Socket.IO host submitted an unknown room type containing CR/LF and produced a forged physical stderr line. This requires owning a session, not merely joining as a student. The exception now uses a fixed message. Rejection and ordinary room creation remain functional. |
| 3 / `8c7dbbe3-b9b7-44b3-b6a0-c455b4a17d93` | **Confirmed TLS bypass; fixed.** Removed `ignoreHTTPSErrors: true` from the capture browser context. Relevant only when an operator overrides the default local HTTP URL with HTTPS; no interception incident is asserted. A local self-signed HTTPS probe compares the exact before/after context options and checks the local HTTP control. This is not a full demo-video rebuild. |
| 4 / `834e76af-2b96-4c7f-a489-1c707a621b69` | **Confirmed; fixed.** A joined student's real Socket.IO submission earned credit by placing hidden answer IDs without typing text. Placements now require a server-held recipe drop zone and a recipe-exposed draggable item. Invalid placements are discarded before grading, so they cannot override valid text. Nested mixed-input recipes, hidden/visible IDs, valid typed answers and legitimate placements are exercised. Existing model fixtures now include the actual draggable/drop-zone recipe contract. |
| 5 / `51189223-6145-400b-a807-c1bc99d6c1e2` | **Confirmed; large-file allocation path fixed after review.** Initially deferred as loopback-only tooling, then reassessed: an operator visiting attacker content while rendering can cause browser download navigations to a known/guessed ephemeral port. Independent Chromium probes reached the listener without user activation even though cross-origin fetch was blocked. The server now allowlists normalized `compose/`, `assets/`, and exact `timeline.json` paths before file access and streams responses with backpressure/disconnect cleanup. A controlled four-client/16 MiB-per-file probe retained about 68 MB before versus 1.2 MB after; direct and encoded model paths now return 403. This mitigates the downloaded-model/full-buffer path, not arbitrary connection exhaustion. Local files are trusted: the allowlist is lexical, not a hostile-symlink boundary; asset preparation copies files. No port-discovery or exhaustion attack was run. |
| 6 / `44f8316f-1f48-4cc9-b1f5-655368753b9f` | **Confirmed; fixed.** A real late-join response exposed the feedback histogram, exact average and count after one response. The student serializer now returns only base room metadata; teacher serialization and live aggregate delivery remain intact. Existing student feedback state reads already exclude aggregates. |

## Repeatable checks

```sh
CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR=/tmp/csv1-evidence pnpm --filter @classroom-widgets/server test
pnpm typecheck
```

The server suite includes transcript regressions, real Socket.IO scenarios in
`e2e/stateAccess.cjs`, and real native BAML logging in `e2e/voiceLogging.cjs`;
its evidence directory contains step-by-step outcomes. The native logging check
requires the configured local Ollama port 11434 to be free and fails safely if
occupied. The four original security regressions and the later native-logging
and renderer probes were observed failing before their corresponding fixes.

## Delivery boundary

PR creation and independent adversarial review are authorized. Merge is held:
`.github/workflows/deploy.yml` triggers on every push to `master`
(no path filter), then runs `pnpm exec wrangler deploy -c web/wrangler.jsonc`
in its Deploy step for non-stale runs. Merging triggers that workflow and can
deploy production, which is outside the current authorization. No workflow, check, or protection
will be altered to evade that boundary. The backend separately requires manual
deployment; these fixes do not change a running backend merely by landing.
