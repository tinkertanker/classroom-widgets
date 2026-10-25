// widgets.tk.sg: the teacher SPA is served straight from static assets (see
// wrangler.jsonc). The Worker handles admin, hashed assets and the OG video.

interface Env {
  ASSETS: Fetcher;
  BACKEND: Fetcher;
}

async function socialVideo(request: Request, assets: Fetcher): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return assets.fetch(request);

  // Assets currently ignores Range. Fetch the complete representation before
  // calculating byte offsets; retain conditional headers so 304 stays intact.
  const upstream = new Request(request, { method: 'GET' });
  upstream.headers.delete('Range');
  upstream.headers.delete('If-Range');
  upstream.headers.set('Accept-Encoding', 'identity');
  const res = await assets.fetch(upstream);
  if (res.status !== 200 || res.headers.get('content-type') !== 'video/mp4' ||
      res.headers.has('content-encoding')) {
    return request.method === 'HEAD' ? new Response(null, res) : res;
  }

  // Only this fixed, small social clip (~230 KB) is buffered, not arbitrary
  // assets. Derive size from bytes: Assets HEAD can omit Content-Length.
  // ArrayBuffer responses let Workers infer the actual wire Content-Length.
  const bytes = await res.arrayBuffer();
  const size = BigInt(bytes.byteLength);
  const headers = new Headers(res.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate, no-transform');
  headers.delete('Content-Length');
  const ifRange = request.headers.get('If-Range');
  const etag = headers.get('ETag');
  // No strong matching validator (including dates without Last-Modified):
  // safely send the complete representation, not potentially stale offsets.
  const eligible = !ifRange || (etag !== null && !etag.startsWith('W/') && ifRange === etag);
  const range = request.method === 'GET' && eligible
    ? /^bytes=(\d*)-(\d*)$/i.exec(request.headers.get('Range')?.trim() ?? '') : null;
  if (range && (range[1] || range[2])) {
    const first = range[1] ? BigInt(range[1]) : null;
    const last = range[2] ? BigInt(range[2]) : null;
    // Reversed ranges are malformed and ignored; valid but unsatisfiable
    // ranges (including a zero-byte suffix) receive 416.
    if (first === null || last === null || first <= last) {
      const start = first ?? (last! > size ? 0n : size - last!);
      const end = first === null || last === null || last >= size ? size - 1n : last;
      if (start >= size || end < start) {
        headers.set('Content-Range', `bytes */${size}`);
        return new Response(null, { status: 416, headers });
      }
      headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
      return new Response(bytes.slice(Number(start), Number(end + 1n)), { status: 206, headers });
    }
  }
  if (request.method === 'HEAD') headers.set('Content-Length', String(size));
  return new Response(request.method === 'HEAD' ? null : bytes, { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/og-video-v2.mp4') return socialVideo(request, env.ASSETS);

    // nginx.prod.conf: `location ^~ /admin` proxies the usage dashboard to the
    // backend with the public Host kept. A service binding keeps the request
    // URL (and so Host: widgets.tk.sg), which the dashboard's same-origin
    // check on sign-in compares against the browser's Origin; a plain
    // fetch('https://go.tk.sg/...') would send Host: go.tk.sg and fail it.
    if (url.pathname.startsWith('/admin')) {
      const headers = new Headers(request.headers);
      const clientIp = request.headers.get('cf-connecting-ip');
      if (clientIp) headers.set('x-forwarded-for', clientIp);
      else headers.delete('x-forwarded-for');
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
