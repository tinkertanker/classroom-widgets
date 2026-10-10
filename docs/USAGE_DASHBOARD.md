# Admin Usage Dashboard

A small, admin-only view of how much Classroom Widgets is used and which widgets
teachers add. It runs inside the existing backend: no database, no extra
container, and no third-party analytics service, so it fits a free-tier VM.

Open it at `https://<FRONTEND_DOMAIN>/admin` or `https://<BACKEND_DOMAIN>/admin`
(locally, `http://localhost:3001/admin`). The backend serves it; in production
the frontend container's Nginx (`nginx.prod.conf`) forwards `/admin` to the
backend. You sign in separately on each address.

## What it shows

**Live**, refreshed every 10 seconds from the server's memory (nothing is
written to disk, and it works even with logging off). A panel styled like the
teacher board sums it up in a sentence, e.g. "3 teachers have Classroom Widgets
open, running 2 live sessions with 41 students":

| Figure | Meaning |
|--------|---------|
| Teachers | Teacher app devices connected right now (several tabs on one device count once); the number of open app windows is listed underneath |
| Live sessions | Classroom sessions whose teacher is connected; sessions held open while a teacher reconnects are listed underneath |
| Students | Students in any session |
| Running for students | Student-facing widgets (Poll, Questions & Comments, RT Feedback and so on), with how many of each |
| Last hour | The most teachers online at once in each minute, sampled by the server every minute and kept for an hour |
| Just now | The latest teacher and classroom events (app opened, widget added, session started, student joined), with no IDs or names; runs of the same event collapse into one line |

The last hour and the activity feed live in memory, so they start empty after
a restart.

**History** for the last 7, 30, 90 or 365 days, refreshed every minute. Today's
figures include events up to the moment of each refresh:

| Figure | Meaning |
|--------|---------|
| Unique devices | Distinct teacher browsers or desktop apps, split into web and desktop |
| Visits | Loads of the teacher app (each reload is a new visit) |
| Classroom sessions | Sessions a teacher started for students |
| Student joins | Each time a student joined a session (rejoins count again) |
| Widgets added | Widgets placed on a board, per widget type, with how many devices added each |

Each figure shows its change against the previous period of the same length,
once the logs go back that far. Clicking a figure switches the daily chart to
it; today's bar is hatched because the day is not over. Every daily figure is
also available as a table. Below, the most used widgets are ranked, and a panel
shows the web and desktop split, students per session and visits per device.

Refreshing pauses while the dashboard tab is hidden and catches up when it is
shown again.

Scripts can read both with the admin password (`ADMIN_TOKEN`):

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://<BACKEND_DOMAIN>/admin/api/live
curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://<BACKEND_DOMAIN>/admin/api/usage?days=30"
```

## What is recorded

The server appends one JSON line per event to a file per day
(`<USAGE_LOG_DIR>/YYYY-MM-DD.jsonl`):

```json
{"t":1791279000000,"e":"app_open","c":"<device id>","v":"<visit id>","s":"web"}
{"t":1791279004000,"e":"widget_add","c":"<device id>","v":"<visit id>","w":"POLL","s":"web"}
{"t":1791279010000,"e":"session_start"}
{"t":1791279020000,"e":"student_join"}
```

- The device ID is a random UUID the teacher app keeps in `localStorage`
  (`cw-usage-client-id`). The visit ID is random per page load.
- `app_open` and `widget_add` come from the teacher app over its existing
  Socket.IO connection (`usage:track`). The server keeps only the fields above,
  drops anything malformed, and limits each client IP to 300 events a minute and counts only the first `app_open` on a connection.
- `session_start` and `student_join` are recorded by the server itself.
- No names, IP addresses, session codes or classroom content are written.
  Clearing site data in the browser gives that browser a new device ID.

Past days are read once and cached; only today's file is re-read per request.
Files older than `USAGE_RETENTION_DAYS` are deleted daily. The files are plain
JSON lines, so `jq` works on them directly:

```bash
docker compose -f docker-compose.prod.yml exec backend sh -c 'cat /data/usage/*.jsonl' \
  | jq -r 'select(.e=="widget_add") | .w' | sort | uniq -c | sort -rn
```

## Signing in

There is one password: the server's `ADMIN_TOKEN`. Type it into the page and
the browser then holds a 12-hour, HMAC-signed, `HttpOnly`, `SameSite=Strict`
cookie scoped to `/admin` (`Secure` in production). Scripts send
`Authorization: Bearer <ADMIN_TOKEN>` instead, as in the examples above.

Failed sign-ins are limited to 10 per IP every 15 minutes. The cookie is tied to
the current `ADMIN_TOKEN`, so changing it and restarting the backend signs
everyone out, as does removing it. Use a long random value:

```bash
openssl rand -base64 32
```

If `ADMIN_SESSION_SECRET` is unset, a random secret is used and admins must sign
in again after each restart.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `USAGE_LOG_DIR` | unset (logging off); `/data/usage` in `docker-compose.prod.yml` | Where daily log files go |
| `USAGE_TIMEZONE` | `UTC` | IANA time zone for day boundaries. Use your teachers' zone so a school day is not split across two dates |
| `USAGE_RETENTION_DAYS` | `400` | Days of logs kept; also the longest range the dashboard shows |
| `ADMIN_SESSION_SECRET` | random per process | Signs the sign-in cookie |
| `ADMIN_TOKEN` | unset | The dashboard password; also used for bearer access, the student-app ADMIN view and `POST /api/admin/cleanup` |

In production the logs live in the `usage-data` Docker volume mounted at
`/data`, so they survive rebuilds. Back it up with:

```bash
docker run --rm -v classroom-widgets_usage-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/usage-data.tgz -C /data .
```

(Check the exact volume name with `docker volume ls`.)

## Testing

- Server tests for sign-in, cookies, the usage log and the routes run with
  `pnpm --filter @classroom-widgets/server test`.
- `pnpm --filter @classroom-widgets/teacher e2e:usage` starts the real server,
  teacher app and student app, drives two teacher devices and a student, then
  signs in to the dashboard with the password and checks every figure, the
  activity feed and the metric switcher, the live panel updating by itself
  when a teacher closes the app, and the last-hour trend (it waits for the
  minute to roll over, so it takes about two minutes). Evidence
  (step log, raw log and screenshots) goes to
  `$CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR`.

## Relationship to Umami

[Umami](./ANALYTICS.md) is optional page-view analytics with its own Postgres
container. This dashboard needs neither and answers the product questions
(how many teachers, which widgets) directly. Either can run without the other.
