// widgets.tk.sg: the teacher SPA is served straight from static assets (see
// wrangler.jsonc). This Worker only runs for /admin* and /assets/*
// (run_worker_first).

interface Env {
  ASSETS: Fetcher;
  BACKEND: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // nginx.prod.conf: `location ^~ /admin` proxies the usage dashboard to the
    // backend with the public Host kept. A service binding keeps the request
    // URL (and so Host: widgets.tk.sg), which the dashboard's same-origin
    // check on sign-in compares against the browser's Origin; a plain
    // fetch('https://go.tk.sg/...') would send Host: go.tk.sg and fail it.
    if (url.pathname.startsWith('/admin')) {
      const headers = new Headers(request.headers);
      const clientIp = request.headers.get('cf-connecting-ip');
      if (clientIp) headers.set('x-forwarded-for', clientIp);
      headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
      return env.BACKEND.fetch(new Request(request, { headers }));
    }

    // Vite's hashed bundles. With run_worker_first as a list, the SPA fallback
    // applies to every unmatched path, so a stale chunk name (after a deploy)
    // would get index.html with the year-long immutable cache. nginx returned
    // 404 for these; so do we. /assets/ never contains HTML.
    if (url.pathname.startsWith('/assets/')) {
      const res = await env.ASSETS.fetch(request);
      if (res.headers.get('content-type')?.startsWith('text/html')) {
        return new Response('Not found', { status: 404 });
      }
      return res;
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
