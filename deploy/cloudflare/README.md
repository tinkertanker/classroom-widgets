# Cloudflare hosting

Runs production on Cloudflare under the same hostnames as the office host
(`docker-compose.prod.yml`):

| Hostname | Worker | What it serves |
|---|---|---|
| `widgets.tk.sg` | `classroom-widgets-web` ([`web/`](web/)) | Teacher SPA from static assets. `/admin*` goes to the backend over a service binding, as `nginx.prod.conf` did |
| `go.tk.sg` | `classroom-widgets-backend` ([`backend/`](backend/)) | One Cloudflare Container running `packages/server/Dockerfile.prod` unchanged: API, Socket.IO (polling and WebSocket), `/student`, `/admin` |

Account: Tinkertanker (`b8b1032c61d9475cd00229c74db7ec72`); zone `tk.sg`.

This directory is a standalone pnpm project with its own lockfile. It is not
part of the app workspace.

## How it maps from the Docker setup

- **Teacher build.** `pnpm build:teacher` builds `packages/teacher` with the
  same `VITE_*` variables as `Dockerfile.prod`. It then stages the output and
  [`web/_headers`](web/_headers) in `web/dist`. The defaults are:
  - `VITE_SERVER_URL=https://go.tk.sg`
  - `VITE_BUILD_ID=<7-char HEAD sha>`, as the Deploy Web workflow sets it
  - `VITE_LINK_SHORTENER_ENABLED=true` (the web Link Shortener is shown)
  - `VITE_UMAMI_*` unset

  Override any of them through the environment. Umami is left off because the
  office host's `.env.production` was not recoverable. The backend's Short.io
  key is a secret (`sk_`) key, so `SHORTIO_BASE_URL` is the authenticated
  `https://api.short.io/links` endpoint, not `/links/public`.
- **SPA fallback and headers.** `not_found_handling: single-page-application`
  replaces nginx's `try_files`. `_headers` carries the nginx security headers
  and its one-year immutable caching for the same file extensions. Cloudflare
  compresses responses itself. A missing `/assets/*` file returns 404 rather
  than `index.html`.
- **`/admin` on widgets.tk.sg.** The request goes through a service binding,
  not `fetch('https://go.tk.sg')`, so the backend still sees
  `Host: widgets.tk.sg`. The dashboard's sign-in checks `Origin` against
  `Host`, so a plain fetch would make every sign-in fail with 403.
  `X-Forwarded-For` is set to the client's address.
- **One instance.** Sessions live in the Node process's memory, so every request
  goes to the Durable Object named `main` (location hint `apac-se`). That object
  runs one container, with `max_instances: 1`.
- **Container settings.** The instance type is `standard-1` (1/2 vCPU, 4 GiB).
  `sleepAfter` is `12h`, the same as `MAX_ROOM_AGE`. Socket.IO pings every 25s
  and each ping counts as activity, so the container never sleeps while anyone
  is connected.
- **Client IP.** The backend Worker replaces `X-Forwarded-For` with
  `CF-Connecting-IP`, and the server runs with `TRUST_PROXY=1`. Per-IP rate
  limits therefore key on the real client, and a forged `X-Forwarded-For`
  cannot get round them (`verify.mjs --spoof-test` checks this).
- **Backend env.** Worker `vars` and secrets reach the container through
  `Backend.envVars` in [`backend/src/index.ts`](backend/src/index.ts):
  - `NODE_ENV=production`, `PORT=3001`
  - `CORS_ORIGINS=https://widgets.tk.sg,https://go.tk.sg`
  - `STUDENT_APP_URL=https://go.tk.sg/student`
  - `SHORTIO_DOMAIN=links.widgets.tk.sg` (the record in the zone that CNAMEs to
    `cname.short.io`)
  - `USAGE_LOG_DIR=/data/usage`, `USAGE_TIMEZONE=UTC`,
    `USAGE_RETENTION_DAYS=400`, `TRUST_PROXY=1`

## Token permissions

`CLOUDFLARE_API_TOKEN` needs:

- **Account (Tinkertanker):**
  - Workers Scripts: Edit (this covers Durable Objects)
  - Containers: Edit (pushes to `registry.cloudflare.com` and creates the
    container application)
  - Account Settings: Read
- **Zone `tk.sg`:**
  - Workers Routes: Edit (custom domains)
  - DNS: Edit (to delete the old CNAMEs and to restore them on rollback)
  - Zone: Read

Workers Paid is required for Containers.

## Deploy

Run this from a clean checkout of the commit you are deploying, on a machine
with Docker (and buildx) that builds `linux/amd64`.

```sh
cd deploy/cloudflare
export CLOUDFLARE_ACCOUNT_ID=b8b1032c61d9475cd00229c74db7ec72
export CLOUDFLARE_API_TOKEN=...            # see "Token permissions"
pnpm install --frozen-lockfile

# Read-only preflight
pnpm exec wrangler whoami
pnpm typecheck
pnpm build:teacher
pnpm dry-run:backend && pnpm dry-run:web
```

### 1. Secrets

Write the secrets to a file outside the repo, readable only by you:

```sh
umask 077
cat > /tmp/cw-backend.secrets <<'EOF'
SHORTIO_API_KEY=...
ADMIN_TOKEN=...
ADMIN_SESSION_SECRET=...
EOF
```

- `SHORTIO_API_KEY` is the private key for `links.widgets.tk.sg` from the
  Short.io dashboard.
- `ADMIN_TOKEN` is the password for `/admin`, the student-app `ADMIN` code, and
  `POST /api/admin/cleanup`.
- `ADMIN_SESSION_SECRET` signs the admin sign-in cookie.

For `ADMIN_TOKEN` and `ADMIN_SESSION_SECRET`, reuse the old values or generate
new ones with `openssl rand -base64 32`. If you leave a secret out, its feature
is disabled.

### 2. Backend (go.tk.sg)

A Workers custom domain cannot be created over an existing DNS record. Delete
the DNS-only `go.tk.sg CNAME office.tk.sg` record first, then deploy:

```sh
ZONE=ea01004f470a0e8078f1b9fdef547273
REC=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records?type=CNAME&name=go.tk.sg" | jq -r '.result[0].id')
curl -s -X DELETE -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records/$REC"

pnpm exec wrangler deploy -c backend/wrangler.jsonc --secrets-file /tmp/cw-backend.secrets
```

`wrangler deploy` builds the image, pushes it, creates the container
application and the Durable Object class (migration `v1`), and binds `go.tk.sg`.
The first container takes a few minutes to provision. Until then, requests
return 503 ("no Container instance available"). Watch progress with
`pnpm exec wrangler containers list` and `pnpm exec wrangler tail classroom-widgets-backend`.

### 3. Web (widgets.tk.sg)

Deploy this after the backend, because the service binding needs the backend to
exist. Leave the `widgets.tk.sg` TXT record (Google site verification) alone and
delete only its CNAME:

```sh
REC=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records?type=CNAME&name=widgets.tk.sg" | jq -r '.result[0].id')
curl -s -X DELETE -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records/$REC"

pnpm exec wrangler deploy -c web/wrangler.jsonc
rm /tmp/cw-backend.secrets
```

### 4. Verify

```sh
node verify.mjs --backend https://go.tk.sg --web https://widgets.tk.sg
```

This writes `/tmp/classroom-widgets-cloudflare-evidence/cloudflare-check.log`
(override the directory with `CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR`). It checks:

- `/health`
- the Socket.IO polling handshake and CORS
- a teacher on WebSocket only creates a session
- the session is visible over HTTP
- a student joins over polling, and the teacher sees the participant
- `/student/` and `/admin` on go.tk.sg
- on widgets.tk.sg: SPA routes, headers, caching, a 404 for a missing asset,
  the `/admin` proxy, and the sign-in same-origin check

Add `--spoof-test` to also prove that a forged `X-Forwarded-For` is ignored.
This leaves your IP rate-limited on the session probe for a minute.

### Later deploys

- **Backend:** `pnpm deploy:backend`. Secrets persist. Every backend deploy
  restarts the container and drops all live sessions, so deploy outside class
  hours.
- **Web:** `pnpm build:teacher && pnpm deploy:web`.

The `Deploy Web to Production` workflow (`.github/workflows/deploy.yml`) still
SSHes to the office host. Disable it, or point it at these commands, before the
next push to `master`.

## Rollback

Point the hostnames back at the office host:

```sh
ACC=$CLOUDFLARE_ACCOUNT_ID
for h in widgets.tk.sg go.tk.sg; do
  ID=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$ACC/workers/domains?hostname=$h" | jq -r '.result[0].id')
  curl -s -X DELETE -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$ACC/workers/domains/$ID"
  curl -s -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' \
    "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
    --data "{\"type\":\"CNAME\",\"name\":\"$h\",\"content\":\"office.tk.sg\",\"proxied\":false,\"ttl\":1}"
done
```

This only detaches the hostnames. The Workers and the container keep running
until `wrangler delete` (`-c backend/wrangler.jsonc` / `-c web/wrangler.jsonc`).
To roll back a bad Worker version without leaving Cloudflare, use
`pnpm exec wrangler rollback -c <config>`. For the container, redeploy the
previous commit.

## Caveats

- **Single instance, in-memory state.** Live sessions are lost when the
  container restarts: on a backend deploy, a Cloudflare host restart, a crash,
  or after 12h with no traffic. Teachers then start a new session. Nothing can
  scale this horizontally until sessions move out of process.
- **Usage logs are ephemeral.** `/data/usage` (the `/admin` dashboard history)
  sits on the container's disk, which is wiped on every restart or deploy.
  Durable usage history needs an R2- or D1-backed log; that is out of scope here.
- **Cold start.** The first request after the container has slept or been
  redeployed waits for the container to boot, typically a few seconds.
- **Location.** The `apac-se` hint applies only when the `main` object is first
  created. To move it, rename `INSTANCE_NAME`.
- **Cost.** `standard-1` stays up for whole school days. `basic` (1/4 vCPU,
  1 GiB) also fits the Node process if cost matters more than CPU headroom.
- **Local `wrangler dev`.** Containers need Docker with buildx. The
  `cloudflare/proxy-everything` egress sidecar needs the kernel's iptables
  `socket` and `TPROXY` modules; without them the container fails to start
  locally. This affects local development only, not deploys.
