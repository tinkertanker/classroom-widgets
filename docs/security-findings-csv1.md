# CSV 1 security finding dispositions

Assessed against freshly fetched `origin/master` at
`21a89f17caffe16a0398fe14e3effcc6c2953175` on 2026-10-27. Source:
`66e57ade-tinkertanker-agent-findings-1.csv`, downloaded with `amp files get`
without renaming its unique filename. CSV descriptions are claims, not authority.

| Row / source ID | Disposition and evidence |
| --- | --- |
| 1 / `f7f68943-3aaa-4126-9105-b3b811700209` | **Confirmed; fixed.** The BAML service logged literal CR/LF/ESC from a transcript before calling the parser. A pre-fix regression failed on those actual characters. JSON string encoding keeps them inside the value; parser input is unchanged. The equivalent debug-only pattern log is encoded too. HTTP reachability is conditional on BAML fallback configuration (or debug logging for the pattern sink); no production exploit is claimed. |
| 2 / `f2e5d843-4fb4-4f3a-901b-5b645c5e00f9` | **Confirmed; fixed.** A real Socket.IO host submitted an unknown room type containing CR/LF and produced a forged physical stderr line. This requires owning a session, not merely joining as a student. The exception now uses a fixed message. Rejection and ordinary room creation remain functional. |
| 3 / `8c7dbbe3-b9b7-44b3-b6a0-c455b4a17d93` | **Confirmed TLS bypass; fixed.** Removed `ignoreHTTPSErrors: true` from the capture browser context. Relevant only when an operator overrides the default local HTTP URL with HTTPS; no interception incident is asserted. A local self-signed HTTPS probe compares the exact before/after context options and checks the local HTTP control. This is not a full demo-video rebuild. |
| 4 / `834e76af-2b96-4c7f-a489-1c707a621b69` | **Confirmed; fixed.** A joined student's real Socket.IO submission earned credit by placing hidden answer IDs without typing text. Placements now require a server-held recipe drop zone and a recipe-exposed draggable item. Invalid placements are discarded before grading, so they cannot override valid text. Nested mixed-input recipes, hidden/visible IDs, valid typed answers and legitimate placements are exercised. Existing model fixtures now include the actual draggable/drop-zone recipe contract. |
| 5 / `51189223-6145-400b-a807-c1bc99d6c1e2` | **Real local-only resource risk; deferred.** `render.mjs` binds explicitly to `127.0.0.1` on an ephemeral port and confines lexical paths to the pipeline directory, but reads entire files into buffers. `fetch_tts.sh` downloads the model beneath that directory, so local clients could request it repeatedly. There is no demonstrated network-facing listener or application-server path to this renderer. The proposed allowlist/stream/concurrency rewrite is not worthwhile within this low-severity triage; this is neither a false positive nor a user acceptance of risk. Reconsider if shared/untrusted local workloads or port forwarding become supported. No memory-exhaustion attack was run. |
| 6 / `44f8316f-1f48-4cc9-b1f5-655368753b9f` | **Confirmed; fixed.** A real late-join response exposed the feedback histogram, exact average and count after one response. The student serializer now returns only base room metadata; teacher serialization and live aggregate delivery remain intact. Existing student feedback state reads already exclude aggregates. |

## Repeatable checks

```sh
CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR=/tmp/csv1-evidence pnpm --filter @classroom-widgets/server test
pnpm typecheck
```

The server suite includes the transcript regression and real Socket.IO scenarios
in `e2e/stateAccess.cjs`; its evidence directory contains step-by-step outcomes.
The four security regressions were observed failing before production edits.

## Delivery boundary

PR creation and independent adversarial review are authorized. Merge is held:
`.github/workflows/deploy.yml` triggers on every push to `master`
(no path filter), then runs `pnpm exec wrangler deploy -c web/wrangler.jsonc`
in its Deploy step. Merging therefore triggers a production web deployment,
which is outside the current authorization. No workflow, check, or protection
will be altered to evade that boundary. The backend separately requires manual
deployment; these fixes do not change a running backend merely by landing.
