import { createModelProvider } from "./ai/createProvider";
import { createStudioApp } from "./app";
import { CloudflareAssetStore } from "./assets";
import { readConfig, type StudioEnv } from "./env";
import { CloudflareImageSafetyInspector } from "./imageSafety";
import { CloudflareImageNormalizer } from "./imageNormalizer";
import { D1StudioRepository } from "./storage/d1Repository";
import { R2SourceStore } from "./sourceStore";
import { PUBLIC_REPORT_MARKER } from "./generation";

export default {
  fetch(request: Request, env: StudioEnv): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (!pathname.startsWith("/v1/") && pathname !== "/health") {
      if (
        pathname.length > 1 &&
        pathname.endsWith("/") &&
        pathname.split("/").filter(Boolean).length === 1
      ) {
        url.pathname = pathname.slice(0, -1);
        return Promise.resolve(Response.redirect(url.toString(), 308));
      }
      return servePublic(request, env);
    }

    return createStudioApp({
      repository: new D1StudioRepository(env.DB),
      provider: createModelProvider(env),
      config: readConfig(env),
      sources: new R2SourceStore(env.MEDIA),
      assets: new CloudflareAssetStore(
        env.DB,
        env.MEDIA,
        new CloudflareImageNormalizer(env.IMAGES),
        new CloudflareImageSafetyInspector(env.AI),
      ),
    }).fetch(request);
  },
  async scheduled(
    _controller: ScheduledController,
    env: StudioEnv,
  ): Promise<void> {
    const now = new Date();
    const repository = new D1StudioRepository(env.DB);
    const draftBefore = new Date(
      now.getTime() - 180 * 86_400_000,
    ).toISOString();
    await repository.deleteExpiredArtifacts(
      draftBefore,
      now.toISOString(),
      100,
    );
    const before = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const assetStore = new CloudflareAssetStore(env.DB, env.MEDIA);
    await assetStore.cleanupOrphans(before, now.toISOString(), 100);
    const usageBefore = new Date(now.getTime() - 14 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const reportsBefore = new Date(
      now.getTime() - 180 * 86_400_000,
    ).toISOString();
    await Promise.all([
      repository.purgeUsage(usageBefore),
      assetStore.cleanupUsage(usageBefore),
      repository.deleteContentReports(reportsBefore),
    ]);
  },
} satisfies ExportedHandler<StudioEnv>;

export function injectPublicHtml(source: string, slug: string): string {
  const report = `<script ${PUBLIC_REPORT_MARKER}>window.addEventListener('DOMContentLoaded',()=>{const b=document.createElement('button');b.textContent='Report this activity';b.setAttribute('aria-label','Report this activity');Object.assign(b.style,{position:'fixed',right:'12px',bottom:'12px',zIndex:'2147483647'});b.onclick=()=>{const reasons=['inappropriate','personal-data','copyright','accessibility','other'];const reason=prompt('Reason: inappropriate, personal-data, copyright, accessibility, or other','other');if(!reason||!reasons.includes(reason))return;fetch('/v1/publications/${slug}/reports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reason})}).then(response=>{if(!response.ok)throw new Error();b.textContent='Report sent'}).catch(()=>{b.textContent='Report failed — try again'})};document.body.append(b)})</script>`;
  const withBase = source.replace(
    /<head(\s[^>]*)?>/i,
    (head) => `${head}<base href="/${slug}/">`,
  );
  const injected = withBase.replace(/<\/body\s*>/i, `${report}</body>`);
  if (injected === withBase || withBase === source)
    throw new Error("Stored widget source is not a complete HTML document.");
  return injected;
}

async function servePublic(
  request: Request,
  env: StudioEnv,
): Promise<Response> {
  if (request.method !== "GET")
    return new Response("Not found.", { status: 404 });
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const repository = new D1StudioRepository(env.DB);
  const publication = parts[0]
    ? await repository.getPublication(parts[0])
    : null;
  if (!publication) return new Response("Widget not found.", { status: 404 });
  if (publication.revokedAt)
    return new Response("This widget was unpublished.", { status: 410 });
  if (Date.parse(publication.expiresAt) <= Date.now())
    return new Response("This widget link expired.", { status: 410 });
  if (parts[1] === "assets" && parts[2]) {
    if (
      !(await repository.publicationReferencesAsset(publication.slug, parts[2]))
    )
      return new Response("Image not found.", { status: 404 });
    const asset = await new CloudflareAssetStore(env.DB, env.MEDIA).get(
      parts[2],
    );
    if (!asset || asset.record.ownerHash !== publication.ownerHash)
      return new Response("Image not found.", { status: 404 });
    const headers = new Headers();
    asset.object.writeHttpMetadata(headers);
    headers.set("etag", asset.object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("x-content-type-options", "nosniff");
    return new Response(asset.object.body, { headers });
  }
  if (parts.length !== 1) return new Response("Not found.", { status: 404 });
  const source = await new R2SourceStore(env.MEDIA).getSource(
    publication.sourceHash,
  );
  if (!source) return new Response("Widget unavailable.", { status: 503 });
  const html = injectPublicHtml(source, publication.slug);
  const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
  headers.set(
    "content-security-policy",
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; sandbox allow-scripts allow-same-origin allow-modals",
  );
  headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-origin");
  headers.set("x-robots-tag", "noindex, nofollow, noarchive");

  headers.set("cache-control", "no-cache, no-store, must-revalidate");
  return new Response(html, { headers });
}
