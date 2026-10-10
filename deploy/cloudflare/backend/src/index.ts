// go.tk.sg: Express + Socket.IO backend (packages/server/Dockerfile.prod)
// running in a single Cloudflare Container.
//
// Sessions live in the Node process's memory, so every request, from every
// client, must reach the same instance: one Durable Object named "main",
// backed by one container (max_instances: 1 in wrangler.jsonc).
import { Container } from '@cloudflare/containers';

interface Env {
  BACKEND: DurableObjectNamespace<Backend>;
  // vars
  CORS_ORIGINS: string;
  STUDENT_APP_URL: string;
  SHORTIO_DOMAIN: string;
  SHORTIO_BASE_URL: string;
  USAGE_TIMEZONE: string;
  USAGE_RETENTION_DAYS: string;
  // secrets (wrangler secret put)
  SHORTIO_API_KEY?: string;
  ADMIN_TOKEN?: string;
  ADMIN_SESSION_SECRET?: string;
}

const INSTANCE_NAME = 'main';

export class Backend extends Container<Env> {
  defaultPort = 3001;
  // Rooms live up to MAX_ROOM_AGE (12h), so only stop after a whole idle
  // half-day. Connected Socket.IO clients ping every 25s, which counts as
  // activity, so the container never sleeps during a class.
  sleepAfter = '12h';
  enableInternet = true; // Short.io API calls

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    const secrets = {
      SHORTIO_API_KEY: env.SHORTIO_API_KEY,
      ADMIN_TOKEN: env.ADMIN_TOKEN,
      ADMIN_SESSION_SECRET: env.ADMIN_SESSION_SECRET,
    };
    this.envVars = {
      NODE_ENV: 'production',
      PORT: '3001',
      CORS_ORIGINS: env.CORS_ORIGINS,
      STUDENT_APP_URL: env.STUDENT_APP_URL,
      SHORTIO_DOMAIN: env.SHORTIO_DOMAIN,
      SHORTIO_BASE_URL: env.SHORTIO_BASE_URL,
      // Ephemeral: the container disk is wiped on every restart or deploy.
      USAGE_LOG_DIR: '/data/usage',
      USAGE_TIMEZONE: env.USAGE_TIMEZONE,
      USAGE_RETENTION_DAYS: env.USAGE_RETENTION_DAYS,
      // The Worker below replaces X-Forwarded-For with exactly one entry, the
      // client address Cloudflare saw, so the server trusts one hop.
      TRUST_PROXY: '1',
      // Unset secrets are left out rather than passed as empty strings.
      ...Object.fromEntries(Object.entries(secrets).filter(([, v]) => v)),
    } as Record<string, string>;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Never forward a client-supplied X-Forwarded-For: the server reads the
    // last TRUST_PROXY entries for per-IP rate limits. CF-Connecting-IP is set
    // by Cloudflare's edge (and survives the service binding from the web
    // Worker for /admin), so it is the one trustworthy client address.
    const headers = new Headers(request.headers);
    const clientIp = request.headers.get('cf-connecting-ip');
    if (clientIp) headers.set('x-forwarded-for', clientIp);
    else headers.delete('x-forwarded-for');
    headers.set('x-forwarded-proto', new URL(request.url).protocol.replace(':', ''));

    // Covers plain HTTP, Socket.IO polling and WebSocket upgrades alike;
    // Container.fetch proxies the WebSocket when the container accepts it.
    // The hint only matters when the object is first created: keep it (and so
    // the container) in Southeast Asia, where the classrooms are, instead of
    // wherever the first request after deploy happens to come from.
    return env.BACKEND.getByName(INSTANCE_NAME, { locationHint: 'apac-se' })
      .fetch(new Request(request, { headers }));
  },
} satisfies ExportedHandler<Env>;
