import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateHtmlArtifact } from "./lib/studio-html-artifact.mjs";

const origin = (
  process.env.STUDIO_LIVE_ORIGIN ??
  "https://classroom-widgets-studio-api.tinkertanker.workers.dev"
).replace(/\/$/, "");
const tokenPath = resolve(".studio-smoke-token");
const smokeCodePath = resolve(".studio-class-codes/0000.txt");
const explicitAccessCode = process.env.STUDIO_CLASS_ACCESS_CODE?.trim();
let token =
  process.env.STUDIO_DEVICE_TOKEN?.trim() ||
  (!explicitAccessCode && existsSync(tokenPath)
    ? readFileSync(tokenPath, "utf8").trim()
    : "");
const jsonHeaders: Record<string, string> = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

interface ArtifactEnvelope {
  artifact: { id: string; headRevisionId: string };
  headRevision: { id: string; parentRevisionId?: string | null };
  html: string;
}

async function ensureDeviceToken(): Promise<void> {
  if (token) {
    jsonHeaders["X-Device-Token"] = token;
    return;
  }
  const localSmokeCode = existsSync(smokeCodePath)
    ? /^(\d{4}[A-Z]{4})$/m.exec(readFileSync(smokeCodePath, "utf8"))?.[1]
    : undefined;
  const accessCode = explicitAccessCode || localSmokeCode;
  if (!accessCode) {
    throw new Error(
      "Set STUDIO_CLASS_ACCESS_CODE for the first live verification, provision class 0000, or restore .studio-smoke-token.",
    );
  }
  const response = await fetch(`${origin}/v1/devices/register`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ accessCode }),
  });
  const body = (await response.json().catch(() => undefined)) as
    { token?: string } | { error?: { message?: string } } | undefined;
  if (!response.ok || !body || !("token" in body) || !body.token) {
    const message = body && "error" in body ? body.error?.message : undefined;
    throw new Error(
      `Device registration failed (${response.status}): ${message ?? "unknown error"}`,
    );
  }
  token = body.token;
  jsonHeaders["X-Device-Token"] = token;
  writeFileSync(tokenPath, `${token}\n`, { encoding: "utf8", mode: 0o600 });
}

async function jsonRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...init,
    headers: { ...jsonHeaders, ...init.headers },
  });
  const body =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }
  return body;
}

function artifactEnvelope(body: unknown, operation: string): ArtifactEnvelope {
  const envelope = body as Partial<ArtifactEnvelope> | undefined;
  if (
    typeof envelope?.artifact?.id !== "string" ||
    typeof envelope.headRevision?.id !== "string" ||
    typeof envelope.html !== "string"
  ) {
    throw new Error(
      `${operation} did not return a complete artifact envelope.`,
    );
  }
  const validation = validateHtmlArtifact(envelope.html);
  if (!validation.valid) {
    throw new Error(
      `${operation} returned invalid HTML: ${validation.issues
        .map((issue: { message: string }) => issue.message)
        .join("; ")}`,
    );
  }
  return envelope as ArtifactEnvelope;
}

async function main() {
  await ensureDeviceToken();
  let artifactId: string | undefined;
  let slug: string | undefined;
  let assetId: string | undefined;
  try {
    const health = await fetch(`${origin}/health`);
    if (!health.ok)
      throw new Error(`Health check failed with ${health.status}.`);

    const examples = (await jsonRequest(
      "/v1/examples/search?q=science&limit=5",
    )) as {
      examples?: Array<{ revisionId?: string; curated?: boolean }>;
    };
    const preferredExampleRevisionId = examples.examples?.find(
      (example) => example.curated,
    )?.revisionId;
    if (!preferredExampleRevisionId) {
      throw new Error(
        "No curated example was retrievable. Import the Studio seed corpus before running live verification.",
      );
    }

    const generated = artifactEnvelope(
      await jsonRequest("/v1/artifacts/generate", {
        method: "POST",
        body: JSON.stringify({
          creationBrief:
            "Create a concise Secondary 2 activity about balanced and unbalanced forces.",
          brief: {
            learnerContext: "Secondary 2 Science",
            learningObjective:
              "Distinguish balanced and unbalanced forces in familiar situations.",
            studentAction:
              "Classify situations and read immediate explanatory feedback.",
            feedback: "Explain the resultant force after each answer.",
            classroomFit: "Six minutes of independent practice.",
          },
          preferredExampleRevisionId,
        }),
      }),
      "Generation",
    );
    artifactId = generated.artifact.id;

    const revised = artifactEnvelope(
      await jsonRequest(
        `/v1/artifacts/${encodeURIComponent(artifactId)}/revisions`,
        {
          method: "POST",
          body: JSON.stringify({
            instruction: "Make the student instructions more concise.",
            expectedHeadRevisionId: generated.headRevision.id,
          }),
        },
      ),
      "Revision",
    );
    if (revised.headRevision.parentRevisionId !== generated.headRevision.id) {
      throw new Error("Revision did not preserve parent history.");
    }

    const restored = artifactEnvelope(
      await jsonRequest(`/v1/artifacts/${encodeURIComponent(artifactId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          headRevisionId: generated.headRevision.id,
          expectedHeadRevisionId: revised.headRevision.id,
        }),
      }),
      "History restore",
    );
    if (restored.html !== generated.html)
      throw new Error("History restore did not recover the original source.");

    const returnedToLatest = artifactEnvelope(
      await jsonRequest(`/v1/artifacts/${encodeURIComponent(artifactId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          headRevisionId: revised.headRevision.id,
          expectedHeadRevisionId: restored.headRevision.id,
        }),
      }),
      "Head restore",
    );

    const imageBytes = stripPngTextMetadata(
      readFileSync(resolve("packages/teacher/public/logo.png")),
    );
    const uploadedImage = await fetch(`${origin}/v1/assets`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "image/png",
        "X-Device-Token": token,
        "X-Image-Width": "534",
        "X-Image-Height": "547",
        "X-Image-Sha256": createHash("sha256").update(imageBytes).digest("hex"),
        "X-Image-Alt-Base64": Buffer.from(
          "A colourful grid of classroom widgets.",
        ).toString("base64"),
        "X-Image-Decorative": "false",
      },
      body: Uint8Array.from(imageBytes),
    });
    const uploadedBody = (await uploadedImage.json().catch(() => undefined)) as
      | { asset?: { id?: string; mediaType?: string; sha256?: string } }
      | undefined;
    if (!uploadedImage.ok || typeof uploadedBody?.asset?.id !== "string") {
      throw new Error(
        `Live image upload failed (${uploadedImage.status}): ${JSON.stringify(uploadedBody)}`,
      );
    }
    assetId = uploadedBody.asset.id;

    const withImage = artifactEnvelope(
      await jsonRequest(
        `/v1/artifacts/${encodeURIComponent(artifactId)}/revisions`,
        {
          method: "POST",
          body: JSON.stringify({
            instruction: `Add the uploaded image using the exact relative URL assets/${assetId}. Give it the alternative text “A colourful grid of classroom widgets.”`,
            expectedHeadRevisionId: returnedToLatest.headRevision.id,
          }),
        },
      ),
      "Image revision",
    );
    if (!withImage.html.includes(`assets/${assetId}`)) {
      throw new Error(
        "Image revision did not reference the uploaded managed image.",
      );
    }

    const published = (await jsonRequest(
      `/v1/artifacts/${encodeURIComponent(artifactId)}/publish`,
      {
        method: "POST",
        body: JSON.stringify({
          expectedHeadRevisionId: withImage.headRevision.id,
        }),
      },
    )) as { publication?: { slug?: string; url?: string; expiresAt?: string } };
    if (
      typeof published.publication?.slug !== "string" ||
      typeof published.publication.url !== "string" ||
      typeof published.publication.expiresAt !== "string"
    ) {
      throw new Error("Publish did not return a complete publication.");
    }
    slug = published.publication.slug;
    const publicUrl = published.publication.url;

    const extended = (await jsonRequest(
      `/v1/publications/${encodeURIComponent(slug)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ days: 30 }),
      },
    )) as { publication?: { slug?: string; expiresAt?: string } };
    if (
      extended.publication?.slug !== slug ||
      Date.parse(String(extended.publication.expiresAt)) <=
        Date.parse(published.publication.expiresAt)
    ) {
      throw new Error(
        "Publication extension did not preserve the slug and move expiry forward.",
      );
    }

    const publicPage = await fetch(publicUrl, {
      headers: { Accept: "text/html" },
    });
    const publicHtml = await publicPage.text();
    if (
      !publicPage.ok ||
      !publicHtml.includes("data-studio-report") ||
      !publicHtml.includes(`/${slug}/`)
    ) {
      throw new Error(
        "Published student HTML did not load with its fixed service controls.",
      );
    }
    const publicImage = await fetch(
      `${origin}/${encodeURIComponent(slug)}/assets/${encodeURIComponent(assetId)}`,
    );
    const publicImageBytes = Buffer.from(await publicImage.arrayBuffer());
    if (
      !publicImage.ok ||
      publicImage.headers.get("content-type") !==
        uploadedBody.asset.mediaType ||
      createHash("sha256").update(publicImageBytes).digest("hex") !==
        uploadedBody.asset.sha256
    ) {
      throw new Error(
        "Published image could not be loaded intact without credentials.",
      );
    }
    const report = await fetch(
      `${origin}/v1/publications/${encodeURIComponent(slug)}/reports`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "other" }),
      },
    );
    if (report.status !== 204)
      throw new Error(`Publication report returned ${report.status}.`);

    await jsonRequest(`/v1/publications/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
    const revoked = await fetch(publicUrl, {
      headers: { Accept: "text/html" },
    });
    if (revoked.status !== 410)
      throw new Error(
        `Revoked publication returned ${revoked.status}, not 410.`,
      );
    slug = undefined;

    await jsonRequest(`/v1/artifacts/${encodeURIComponent(artifactId)}`, {
      method: "DELETE",
    });
    artifactId = undefined;
    const deletedAsset = await fetch(
      `${origin}/v1/assets/${encodeURIComponent(assetId)}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json", "X-Device-Token": token },
      },
    );
    if (deletedAsset.status !== 204) {
      throw new Error(
        `Unused image cleanup returned ${deletedAsset.status}, not 204.`,
      );
    }
    assetId = undefined;

    console.log(
      "Live Studio flow passed: retrieval, generate, revise, restore, image, publish, extend, report, revoke, delete.",
    );
  } catch (error) {
    const cleanupErrors: string[] = [];
    if (slug) {
      try {
        const cleanup = await fetch(
          `${origin}/v1/publications/${encodeURIComponent(slug)}`,
          {
            method: "DELETE",
            headers: { Accept: "application/json", "X-Device-Token": token },
          },
        );
        if (!cleanup.ok && cleanup.status !== 404)
          cleanupErrors.push(`publication cleanup returned ${cleanup.status}`);
      } catch (cleanupError) {
        cleanupErrors.push(
          `publication cleanup failed: ${String(cleanupError)}`,
        );
      }
    }
    if (artifactId) {
      try {
        const cleanup = await fetch(
          `${origin}/v1/artifacts/${encodeURIComponent(artifactId)}`,
          {
            method: "DELETE",
            headers: { Accept: "application/json", "X-Device-Token": token },
          },
        );
        if (!cleanup.ok && cleanup.status !== 404)
          cleanupErrors.push(`artifact cleanup returned ${cleanup.status}`);
      } catch (cleanupError) {
        cleanupErrors.push(`artifact cleanup failed: ${String(cleanupError)}`);
      }
    }
    if (assetId) {
      try {
        const cleanup = await fetch(
          `${origin}/v1/assets/${encodeURIComponent(assetId)}`,
          {
            method: "DELETE",
            headers: { Accept: "application/json", "X-Device-Token": token },
          },
        );
        if (!cleanup.ok && cleanup.status !== 404 && cleanup.status !== 409) {
          cleanupErrors.push(`asset cleanup returned ${cleanup.status}`);
        }
      } catch (cleanupError) {
        cleanupErrors.push(`asset cleanup failed: ${String(cleanupError)}`);
      }
    }
    if (cleanupErrors.length > 0)
      console.error(`Live cleanup warning: ${cleanupErrors.join("; ")}`);
    throw error;
  }
}

function stripPngTextMetadata(bytes: Buffer): Buffer {
  const blocked = new Set(["eXIf", "iTXt", "tEXt", "zTXt"]);
  const chunks = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const next = offset + 12 + length;
    if (next > bytes.length)
      throw new Error("The Studio icon is not a valid PNG.");
    if (!blocked.has(type)) chunks.push(bytes.subarray(offset, next));
    offset = next;
    if (type === "IEND") break;
  }
  return Buffer.concat(chunks);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
