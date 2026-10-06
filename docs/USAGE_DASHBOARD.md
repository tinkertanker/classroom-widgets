# Admin Usage Dashboard

A small, admin-only view of how much Classroom Widgets is used and which widgets
teachers add. It runs inside the existing backend: no database, no extra
container, and no third-party analytics service, so it fits a free-tier VM.

Open it at `https://<BACKEND_DOMAIN>/admin` (locally, `http://localhost:3001/admin`).

## What it shows

For the last 7, 30, 90 or 365 days:

| Figure | Meaning |
|--------|---------|
| Unique devices | Distinct teacher browsers or desktop apps, split into web and desktop |
| Visits | Loads of the teacher app (each reload is a new visit) |
| Classroom sessions | Sessions a teacher started for students |
| Student joins | Each time a student joined a session (rejoins count again) |
| Widgets added | Widgets placed on a board, per widget type, with how many devices added each |

There is also a daily chart of unique devices, with a table view of every daily
figure.

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
  drops anything malformed, and limits each connection to 60 events a minute.
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

Two methods, usable together:

1. **Google** (recommended). Admins click "Sign in with Google". The server
   verifies Google's ID token and checks the account against `ADMIN_EMAILS`
   (exact addresses) and `ADMIN_EMAIL_DOMAINS` (every account in a Google
   Workspace domain). A domain match needs a real Workspace account: a personal
   Google account registered with a work address is refused unless it is listed
   in `ADMIN_EMAILS`.
2. **Admin token**. The existing `ADMIN_TOKEN` can be typed into the page, or
   sent as `Authorization: Bearer <ADMIN_TOKEN>` to `GET /admin/api/usage?days=30`
   for scripts.

Either way the browser then holds a 12-hour, HMAC-signed, `HttpOnly`,
`SameSite=Strict` cookie scoped to `/admin` (`Secure` in production). The
allowlist is checked on every request, so removing someone from `ADMIN_EMAILS`
and restarting the backend ends their access. Failed sign-ins are limited to 10
per IP every 15 minutes.

### Setting up Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   pick or create a project and open **APIs & Services → Credentials**.
2. If prompted, configure the OAuth consent screen. "Internal" is simplest if
   every admin is in your Google Workspace; otherwise choose "External" and add
   the admins as test users. Only the default `email`, `profile` and `openid`
   scopes are used, so no verification review is needed.
3. **Create credentials → OAuth client ID → Web application**. Under
   **Authorised JavaScript origins** add `https://<BACKEND_DOMAIN>` (and
   `http://localhost:3001` for local testing). No redirect URI is needed.
4. Copy the client ID into `.env.production`:

```env
GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
ADMIN_EMAILS=you@example.com,colleague@example.com
ADMIN_EMAIL_DOMAINS=tinkertanker.com
ADMIN_SESSION_SECRET=<openssl rand -base64 32>
USAGE_TIMEZONE=Asia/Singapore
```

5. Redeploy the backend. Google sign-in costs nothing.

If `ADMIN_SESSION_SECRET` is unset, a random secret is used and admins must sign
in again after each restart.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `USAGE_LOG_DIR` | unset (logging off); `/data/usage` in `docker-compose.prod.yml` | Where daily log files go |
| `USAGE_TIMEZONE` | `UTC` | IANA time zone for day boundaries. Use your teachers' zone so a school day is not split across two dates |
| `USAGE_RETENTION_DAYS` | `400` | Days of logs kept; also the longest range the dashboard shows |
| `GOOGLE_CLIENT_ID` | unset | Enables Google sign-in |
| `ADMIN_EMAILS` | unset | Google accounts allowed in |
| `ADMIN_EMAIL_DOMAINS` | unset | Workspace domains allowed in |
| `ADMIN_SESSION_SECRET` | random per process | Signs the sign-in cookie |
| `ADMIN_TOKEN` | unset | Enables token sign-in and bearer access |

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
  signs in to the dashboard with a token and checks every figure. Evidence
  (step log, raw log and screenshots) goes to
  `$CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR`.
- Google sign-in itself needs a real Google account and the configured origin,
  so check it by hand after deploying.

## Relationship to Umami

[Umami](./ANALYTICS.md) is optional page-view analytics with its own Postgres
container. This dashboard needs neither and answers the product questions
(how many teachers, which widgets) directly. Either can run without the other.
