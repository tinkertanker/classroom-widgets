import { createModelProvider } from './ai/createProvider';
import { createStudioApp } from './app';
import { CloudflareAssetStore } from './assets';
import { readConfig, type StudioEnv } from './env';
import { CloudflareImageSafetyInspector } from './imageSafety';
import { CloudflareImageNormalizer } from './imageNormalizer';
import { D1StudioRepository } from './storage/d1Repository';

export default {
  fetch(request: Request, env: StudioEnv): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (!pathname.startsWith('/v1/') && pathname !== '/health') {
      if (pathname.length > 1 && pathname.endsWith('/') && pathname.split('/').filter(Boolean).length === 1) {
        url.pathname = pathname.slice(0, -1);
        return Promise.resolve(Response.redirect(url.toString(), 308));
      }
      return servePlayerAsset(request, env.PLAYER_ASSETS);
    }

    return createStudioApp({
      repository: new D1StudioRepository(env.DB),
      provider: createModelProvider(env),
      config: readConfig(env),
      assets: new CloudflareAssetStore(
        env.DB,
        env.MEDIA,
        new CloudflareImageNormalizer(env.IMAGES),
        new CloudflareImageSafetyInspector(env.AI),
      ),
    }).fetch(request);
  },
  async scheduled(_controller: ScheduledController, env: StudioEnv): Promise<void> {
    const now = new Date();
    const repository = new D1StudioRepository(env.DB);
    const draftBefore = new Date(now.getTime() - 180 * 86_400_000).toISOString();
    await repository.deleteExpiredDrafts(draftBefore, now.toISOString(), 100);
    const before = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const assetStore = new CloudflareAssetStore(env.DB, env.MEDIA);
    await assetStore.cleanupOrphans(
      before,
      now.toISOString(),
      100,
    );
    const usageBefore = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
    const reportsBefore = new Date(now.getTime() - 180 * 86_400_000).toISOString();
    await Promise.all([
      repository.purgeUsage(usageBefore),
      assetStore.cleanupUsage(usageBefore),
      repository.deleteContentReports(reportsBefore),
    ]);
  },
} satisfies ExportedHandler<StudioEnv>;

async function servePlayerAsset(request: Request, assets: Fetcher): Promise<Response> {
  const response = await assets.fetch(request);
  const pathname = new URL(request.url).pathname;
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (pathname.startsWith('/assets/') && contentType.includes('text/html')) {
    return new Response('Asset not found.', {
      status: 404,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/plain; charset=utf-8',
        'x-content-type-options': 'nosniff',
      },
    });
  }
  const headers = new Headers(response.headers);
  headers.set(
    'content-security-policy',
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
  );
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('cross-origin-opener-policy', 'same-origin');
  headers.set('cross-origin-resource-policy', 'same-origin');
  headers.set('x-robots-tag', 'noindex, nofollow, noarchive');

  headers.set(
    'cache-control',
    pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache, no-store, must-revalidate',
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
