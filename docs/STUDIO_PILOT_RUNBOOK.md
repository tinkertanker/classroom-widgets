# Classroom Widgets Studio pilot runbook

This is the operator checklist for the August 2026 pilot. It covers the public
Studio API at
`https://classroom-widgets-studio-api.tinkertanker.workers.dev` and the iPad
app. Run Cloudflare commands from `services/studio-api`.
The production resources are in Wrangler's `tinkertanker` profile; keep
`--profile tinkertanker` on every production command below.

## Roles and response times

- Name one Tinkertanker facilitator as the operator before each workshop.
- Check reports before the workshop, at the midpoint, at the end, and once each
  working day while any pilot publication remains live.
- Review reports concerning personal data, child safety or inappropriate
  content immediately; review every other report within one working day.
- Revoke first when safety is uncertain. A teacher can correct and republish
  after review.

## Before inviting teachers

**Important:** Before any class-code verification, trash the legacy `.studio-pilot-codes.txt` and any stale pre-cutover `.studio-smoke-token` from prior pilot runs. The new `.studio-smoke-token` created afterwards remains active and ignored.

1. Confirm `GET /health` returns 200.
2. Apply remote D1 migrations with
   `npx wrangler d1 migrations apply DB --remote --profile tinkertanker`.
   Dropping `pilot_codes` only removes the old provisioning table; it does not
   revoke any device token already issued to a pilot iPad.
3. Rotate `DEVICE_TOKEN_SIGNING_SECRET` as part of this cutover so that every
   pilot iPad's existing device token is actually invalidated (device tokens
   are long-lived and are verified only against this secret, not looked up in
   the database). Generate a fresh secret and set it without ever displaying,
   logging or storing it:
   `openssl rand -base64 48 | npx wrangler secret put DEVICE_TOKEN_SIGNING_SECRET --profile tinkertanker`.
   Afterwards every pilot iPad receives `DEVICE_REGISTRATION_REQUIRED` and must
   re-register with a new class code; confirm `AI_API_KEY` is also configured.
4. Provision one shared code for each class with
   `npm run provision:studio-class -- 1234 30`, replacing `1234` with the
   four-digit class number and `30` with the required activation limit from 1
   to 100. The generated code contains those four numbers followed by four
   random letters. Its ignored `.studio-class-codes/1234.txt` file has
   owner-only permissions. Each successful iPad activation consumes one use;
   the code remains valid until it reaches the configured limit or expires.
5. Provision class `0000` with a 100-use limit for automated live verification.
   Set `STUDIO_CLASS_ACCESS_CODE` to that code and run
   `npm run verify:studio-live`. Later runs reuse the ignored, owner-only
   `.studio-smoke-token` file.
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

If a class code must be replaced, use `trash .studio-class-codes/1234.txt`,
delete only the matching `Class 1234` row after checking its label and usage,
then provision a replacement. Never paste class codes into issues, commits,
chat logs or screenshots.

## Review public content reports

List unreviewed reports with their widget metadata:

```sh
npx wrangler d1 execute DB --remote --profile tinkertanker --command "SELECT r.id, r.created_at, r.reason, r.publication_slug, p.title, p.expires_at, p.revoked_at FROM content_reports r JOIN publications p ON p.slug = r.publication_slug WHERE r.reviewed_at IS NULL ORDER BY r.created_at ASC"
```

Open the exact reported publication URL and assess only the reported widget.
Do not enter student information while testing it.

For an unsafe report, validate that the slug contains only letters, numbers,
`_` or `-`, then revoke that exact publication:

```sh
npx wrangler d1 execute DB --remote --profile tinkertanker --command "UPDATE publications SET revoked_at = COALESCE(revoked_at, datetime('now')) WHERE slug = 'VALIDATED_SLUG'"
```

Record the outcome against the exact report ID:

```sh
npx wrangler d1 execute DB --remote --profile tinkertanker --command "UPDATE content_reports SET reviewed_at = datetime('now'), resolution = 'widget-revoked' WHERE id = 'VALIDATED_REPORT_ID' AND reviewed_at IS NULL"
```

Use `no-action` only after checking the live widget, or `teacher-contacted` when
follow-up is still required. Reports are retained for 180 days and then removed
by the scheduled cleanup.

## Restore projects after reinstall or device replacement

The signed device credential is stored in Keychain and is eligible for an
encrypted-device-backup restore. With that credential, Studio can list the
owner's remote artifacts and publications and re-download a selected project. If the
credential is unavailable, do not issue a replacement credential that assumes
ownership: ask the operator to identify the exact link, then revoke it directly
after validating the slug.

Local projects are stored as separate atomic files with backups. If Studio
offers a conflict or recovered copy, keep both until the teacher confirms which
one is current.

## Incident and rollback

- To stop new AI generation while keeping student links available, remove or
  rotate `AI_API_KEY`; generation and model moderation will fail closed
  while stored HTML publications remain readable.
- To remove one unsafe widget, revoke only its validated slug as above.
- To roll back a bad Worker deployment, inspect the recent deployment list with
  `npx wrangler deployments list --profile tinkertanker`, then use Wrangler's
  rollback command with `--profile tinkertanker` for the
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
5. Rotate each class code before a later workshop and set a fresh activation
   limit for that class.
