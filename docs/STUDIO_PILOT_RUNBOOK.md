# Classroom Widgets Studio pilot runbook

This is the operator checklist for the August 2026 pilot. It covers the public
Studio API at
`https://classroom-widgets-studio-api.dark-cell-6287.workers.dev` and the iPad
app. Run Cloudflare commands from `services/studio-api`.
The production resources are in Wrangler's `default` profile; keep
`--profile default` on every production command below.

## Roles and response times

- Name one Tinkertanker facilitator as the operator before each workshop.
- Check reports before the workshop, at the midpoint, at the end, and once each
  working day while any pilot publication remains live.
- Review reports concerning personal data, child safety or inappropriate
  content immediately; review every other report within one working day.
- Revoke first when safety is uncertain. A teacher can correct and republish
  after review.

## Before inviting teachers

1. Confirm `GET /health` returns 200.
2. Apply remote D1 migrations with
   `npx wrangler d1 migrations apply DB --remote --profile default`.
3. Confirm the Worker has both `AI_API_KEY` and
   `DEVICE_TOKEN_SIGNING_SECRET` secrets configured.
4. Generate workshop access codes once with
   `npm run provision:studio-pilot -- 25`. The ignored
   `.studio-pilot-codes.txt` file is created with owner-only permissions. Give
   each teacher a different numbered code; reserve `SMOKE` for automated live
   verification.
5. Run the live flow once by setting `STUDIO_PILOT_ACCESS_CODE` to the `SMOKE`
   code and running `npm run verify:studio-live`. Later runs reuse the ignored,
   owner-only `.studio-smoke-token` file.
6. For external TestFlight or App Store review, place a still-valid multi-use
   workshop code in App Review notes. Verify it immediately before submission
   and keep it valid until review has completed; never put it in source control
   or public metadata.
7. Install the Release build on a physical A16 iPad. Complete the full flow for
   at least three representative widgets, including a simulation: generate,
   revise, add a non-personal image where appropriate, publish, and open each
   resulting URL on a separate device in Safari. Across the three flows, test
   VoiceOver, portrait and landscape. Revoke every link and verify that the
   student sees the unavailable state.

If access codes must be replaced, use `trash .studio-pilot-codes.txt`, delete
only the known pilot-code rows after verifying their labels, and provision a
new set. Never paste access codes into issues, commits, chat logs or screenshots.

## Review public content reports

List unreviewed reports with their widget metadata:

```sh
npx wrangler d1 execute DB --remote --profile default --command "SELECT r.id, r.created_at, r.reason, r.publication_slug, p.title, p.expires_at, p.revoked_at FROM content_reports r JOIN publications p ON p.slug = r.publication_slug WHERE r.reviewed_at IS NULL ORDER BY r.created_at ASC"
```

Open the exact reported publication URL and assess only the reported widget.
Do not enter student information while testing it.

For an unsafe report, validate that the slug contains only letters, numbers,
`_` or `-`, then revoke that exact publication:

```sh
npx wrangler d1 execute DB --remote --profile default --command "UPDATE publications SET revoked_at = COALESCE(revoked_at, datetime('now')) WHERE slug = 'VALIDATED_SLUG'"
```

Record the outcome against the exact report ID:

```sh
npx wrangler d1 execute DB --remote --profile default --command "UPDATE content_reports SET reviewed_at = datetime('now'), resolution = 'widget-revoked' WHERE id = 'VALIDATED_REPORT_ID' AND reviewed_at IS NULL"
```

Use `no-action` only after checking the live widget, or `teacher-contacted` when
follow-up is still required. Reports are retained for 180 days and then removed
by the scheduled cleanup.

## Restore projects after reinstall or device replacement

The signed device credential is stored in Keychain and is eligible for an
encrypted-device-backup restore. With that credential, Studio can list the
owner's remote drafts and publications and re-download a selected draft. If the
credential is unavailable, do not issue a replacement credential that assumes
ownership: ask the operator to identify the exact link, then revoke it directly
after validating the slug.

Local projects are stored as separate atomic files with backups. If Studio
offers a conflict or recovered copy, keep both until the teacher confirms which
one is current.

## Incident and rollback

- To stop new AI generation while keeping student links available, remove or
  rotate `AI_API_KEY`; generation and model moderation will fail closed
  while the static player and stored publications remain readable.
- To remove one unsafe widget, revoke only its validated slug as above.
- To roll back a bad Worker deployment, inspect the recent deployment list with
  `npx wrangler deployments list --profile default`, then use Wrangler's
  rollback command with `--profile default` for the
  selected known-good deployment. Re-run `/health` and the complete live flow.
- If public rendering itself is unsafe, disable the Worker deployment and tell
  facilitators that published links are temporarily unavailable. Do not purge
  D1 or R2 during incident response.

## End of pilot

1. Export the anonymised counts needed for evaluation; do not export teacher
   prompts or widget content unnecessarily.
2. Review every outstanding report.
3. Revoke the smoke-test publication if one remains.
4. Keep teacher publications until their displayed expiry unless a teacher asks
   for earlier deletion.
5. Rotate the pilot access-code set before any later workshop.
