import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { FixtureModelProvider } from "../src/ai/fixtureProvider";
import { issueDeviceToken } from "../src/auth";
import { createStudioApp } from "../src/app";
import { injectPublicHtml } from "../src/index";
import { MemorySourceStore } from "../src/sourceStore";
import { MemoryStudioRepository } from "../src/storage/memoryRepository";
import type { RevisionRecord } from "../src/storage/repository";

const secret = "test-device-signing-secret-with-at-least-32-characters";
const config = {
  publicPlayerOrigin: "https://play.test",
  allowedOrigins: new Set(["https://studio.test"]),
  dailyGenerationLimit: 20,
  dailyNetworkGenerationLimit: 1_000,
  dailySafetyReviewLimit: 50,
  dailyNetworkSafetyReviewLimit: 1_000,
  dailyNetworkUploadLimit: 200,
  dailyNetworkUploadBytes: 200_000_000,
  dailyDraftCreationLimit: 50,
  dailyNetworkDraftCreationLimit: 500,
  maximumDraftsPerOwner: 100,
  dailyNetworkRegistrationLimit: 100,
  publicationTtlDays: 90,
  deviceTokenSigningSecret: secret,
  seedImportToken: "test-seed-import-token",
};

describe("Studio API registration and public HTML", () => {
  let repository: MemoryStudioRepository;
  let app: ReturnType<typeof createStudioApp>;
  let sources: MemorySourceStore;
  let token: string;
  beforeEach(async () => {
    repository = new MemoryStudioRepository();
    sources = new MemorySourceStore();
    token = (await issueDeviceToken(secret, new Date("2026-08-02T00:00:00Z")))
      .token;
    app = createStudioApp({
      repository,
      provider: new FixtureModelProvider(),
      config,
      sources,
      now: () => new Date("2026-08-02T00:00:00Z"),
    });
  });

  function authenticated(path: string, method = "GET", body?: unknown) {
    return new Request(`https://api.test${path}`, {
      method,
      headers: {
        "x-device-token": token,
        "cf-connecting-ip": "192.0.2.1",
        origin: "https://studio.test",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  const creationBrief = {
    creationBrief: "Create a Primary 5 fractions comparison activity.",
    brief: {
      learnerContext: "Primary 5 Mathematics",
      learningObjective: "Compare fractions with unlike denominators",
      studentAction: "Choose the larger fraction and check the feedback",
      feedback: "Explain each answer",
      classroomFit: "Five minutes independently",
    },
  };

  function register(accessCode: string) {
    return app.fetch(
      new Request("https://api.test/v1/devices/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "192.0.2.1",
        },
        body: JSON.stringify({ accessCode }),
      }),
    );
  }

  it("normalises a class code and permits all 100 activations on a shared network", async () => {
    const hash = createHash("sha256")
      .update("class-code:1234ABCD")
      .digest("hex");
    repository.classCodes.set(hash, {
      maximumUses: 100,
      uses: 0,
      expiresAt: "2026-08-03T00:00:00Z",
    });
    for (let use = 0; use < 100; use += 1) {
      expect(
        (await register(use === 0 ? "1234-abcd" : "1234ABCD")).status,
      ).toBe(201);
    }
    expect((await register("1234ABCD")).status).toBe(429);
    expect(repository.classCodes.get(hash)?.uses).toBe(100);
  });

  it("checks network registration quota before consuming a class code", async () => {
    const hash = createHash("sha256")
      .update("class-code:1234ABCD")
      .digest("hex");
    repository.classCodes.set(hash, {
      maximumUses: 2,
      uses: 0,
      expiresAt: "2026-08-03T00:00:00Z",
    });
    const limited = createStudioApp({
      repository,
      provider: new FixtureModelProvider(),
      config: { ...config, dailyNetworkRegistrationLimit: 1 },
      sources: new MemorySourceStore(),
      now: () => new Date("2026-08-02T00:00:00Z"),
    });
    app = limited;
    expect((await register("1234ABCD")).status).toBe(201);
    expect((await register("1234ABCD")).status).toBe(429);
    expect(repository.classCodes.get(hash)?.uses).toBe(1);
  });

  it("injects one scoped base and one report control without changing the source", () => {
    const source =
      '<!doctype html><html><head></head><body><img src="assets/image-1"></body></html>';
    const served = injectPublicHtml(source, "ABCDEFGHIJKLMNOPQRST");
    expect(served.match(/<base /g)).toHaveLength(1);
    expect(served.match(/data-studio-report/g)).toHaveLength(1);
    expect(served).toContain('<base href="/ABCDEFGHIJKLMNOPQRST/">');
    expect(source).not.toContain("<base");
  });

  it("injects the report control at the closing body rather than script text", () => {
    const source =
      '<!doctype html><html><head></head><body><script>const closing = "</body>";</script></body></html>';
    const served = injectPublicHtml(source, "ABCDEFGHIJKLMNOPQRST");

    expect(served).toContain('const closing = "</body>";');
    expect(served.indexOf("data-studio-report")).toBeGreaterThan(
      served.indexOf("</script>"),
    );
  });

  it("imports reviewed seeds into retrieval and uses a selected seed as generation context", async () => {
    const seed = {
      seedId: "fraction-equivalence-diagnostic",
      title: "Fraction Equivalence Detective",
      summary: "Compare equivalent fractions and check each answer.",
      artifact: {
        html: '<!doctype html><html lang="en-SG"><head><meta charset="utf-8"><title>Fraction Equivalence Detective</title></head><body><button type="button">Check</button></body></html>',
        designCard: { layout: "single diagnostic" },
      },
      metadata: {
        subject: "mathematics",
        level: "upper-primary",
        locale: "en-SG",
        learningObjective: "Recognise equivalent fractions.",
        tags: ["fractions", "equivalence", "diagnostic"],
        interactionPattern: "choice-diagnostic",
        descriptor: "A fraction diagnostic with immediate feedback.",
      },
    };
    const unauthorized = await app.fetch(
      new Request("https://api.test/v1/seeds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(seed),
      }),
    );
    expect(unauthorized.status).toBe(401);

    const imported = await app.fetch(
      new Request("https://api.test/v1/seeds", {
        method: "POST",
        headers: {
          authorization: "Bearer test-seed-import-token",
          "content-type": "application/json",
        },
        body: JSON.stringify(seed),
      }),
    );
    expect(imported.status).toBe(201);
    await expect(imported.json()).resolves.toMatchObject({
      artifactId: seed.seedId,
      revisionId: `${seed.seedId}-seed`,
    });
    expect(repository.retrieval.get(seed.seedId)?.curated).toBe(true);
    expect(
      await sources.getSource(
        (await repository.getRevision(`${seed.seedId}-seed`))!.sourceHash,
      ),
    ).toBe(seed.artifact.html);

    const provider = new FixtureModelProvider();
    const generate = provider.generate.bind(provider);
    let receivedExemplars: string[] = [];
    provider.generate = async (brief, exemplars) => {
      receivedExemplars = exemplars.map((exemplar) => exemplar.revisionId);
      return generate(brief, exemplars);
    };
    app = createStudioApp({
      repository,
      provider,
      config,
      sources,
      now: () => new Date("2026-08-02T00:00:00Z"),
    });
    const generated = await app.fetch(
      authenticated("/v1/artifacts/generate", "POST", {
        ...creationBrief,
        preferredExampleRevisionId: `${seed.seedId}-seed`,
      }),
    );
    expect(generated.status).toBe(201);
    expect(receivedExemplars).toEqual([`${seed.seedId}-seed`]);

    const anonymousSearch = await app.fetch(
      new Request("https://api.test/v1/examples/search?q=fractions"),
    );
    expect(anonymousSearch.status).toBe(401);
    const searched = await app.fetch(
      authenticated("/v1/examples/search?q=fractions"),
    );
    await expect(searched.json()).resolves.toMatchObject({
      examples: [
        {
          artifactId: seed.seedId,
          revisionId: `${seed.seedId}-seed`,
          curated: true,
        },
      ],
    });
  });

  it("creates immutable revisions, moves the head, and records remix lineage", async () => {
    const generated = await app.fetch(
      authenticated("/v1/artifacts/generate", "POST", creationBrief),
    );
    expect(generated.status).toBe(201);
    const first = (await generated.json()) as {
      artifact: { id: string; headRevisionId: string };
      headRevision: RevisionRecord;
    };
    expect(await sources.getSource(first.headRevision.sourceHash)).toContain(
      "<!doctype html>",
    );

    const revised = await app.fetch(
      authenticated(`/v1/artifacts/${first.artifact.id}/revisions`, "POST", {
        instruction: "Use a number line",
        expectedHeadRevisionId: first.headRevision.id,
      }),
    );
    expect(revised.status).toBe(201);
    const second = (await revised.json()) as { headRevision: RevisionRecord };
    expect(second.headRevision.parentRevisionId).toBe(first.headRevision.id);
    expect(
      (await repository.getRevision(first.headRevision.id))?.sourceHash,
    ).toBe(first.headRevision.sourceHash);

    const moved = await app.fetch(
      authenticated(`/v1/artifacts/${first.artifact.id}`, "PATCH", {
        headRevisionId: first.headRevision.id,
        expectedHeadRevisionId: second.headRevision.id,
      }),
    );
    expect(moved.status).toBe(200);

    const remix = await app.fetch(
      authenticated(`/v1/revisions/${first.headRevision.id}/remix`, "POST", {}),
    );
    expect(remix.status).toBe(201);
    const remixed = (await remix.json()) as {
      artifact: { remixedFromRevisionId: string };
      headRevision: RevisionRecord;
    };
    expect(remixed.artifact.remixedFromRevisionId).toBe(first.headRevision.id);
    expect(remixed.headRevision.parentRevisionId).toBeNull();
  });

  it("removes deleted screenshots without racing shared content-addressed sources", async () => {
    const generated = await app.fetch(
      authenticated("/v1/artifacts/generate", "POST", creationBrief),
    );
    const first = (await generated.json()) as {
      artifact: { id: string };
      headRevision: RevisionRecord;
    };
    const remixedResponse = await app.fetch(
      authenticated(`/v1/revisions/${first.headRevision.id}/remix`, "POST", {}),
    );
    const remixed = (await remixedResponse.json()) as {
      artifact: { id: string };
    };
    const screenshotKey = await sources.putScreenshot(
      first.headRevision.id,
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    );
    await repository.setScreenshot(
      first.headRevision.id,
      repository.artifacts.get(first.artifact.id)!.ownerHash,
      screenshotKey,
    );

    expect(
      (await app.fetch(authenticated(`/v1/artifacts/${first.artifact.id}`, "DELETE"))).status,
    ).toBe(204);
    expect(sources.screens.size).toBe(0);
    expect(sources.sources.size).toBe(1);

    expect(
      (await app.fetch(authenticated(`/v1/artifacts/${remixed.artifact.id}`, "DELETE"))).status,
    ).toBe(204);
    expect(sources.sources.size).toBe(1);
  });

  it("round-trips rich metadata, screenshots, and publication envelopes", async () => {
    const generated = await app.fetch(
      authenticated("/v1/artifacts/generate", "POST", creationBrief),
    );
    const first = (await generated.json()) as {
      artifact: {
        id: string;
        summary: string;
        creationBrief: string;
        publication: null;
        publicationStale: boolean;
      };
      headRevision: { id: string };
    };
    expect(first.artifact).toMatchObject({
      summary: expect.any(String),
      creationBrief: creationBrief.creationBrief,
      publication: null,
      publicationStale: false,
    });

    const metadata = await app.fetch(
      authenticated(`/v1/artifacts/${first.artifact.id}`, "PATCH", {
        title: "Fraction comparison",
        summary: "A concise fraction diagnostic",
        subject: "Mathematics",
        level: "Primary 5",
        locale: "en-SG",
        learningObjective: "Compare unlike fractions",
        tags: ["fractions", "diagnostic"],
        creationBrief: "Updated teacher-facing brief",
      }),
    );
    expect(metadata.status).toBe(200);
    await expect(metadata.json()).resolves.toMatchObject({
      artifact: {
        title: "Fraction comparison",
        summary: "A concise fraction diagnostic",
        subject: "Mathematics",
        level: "Primary 5",
        locale: "en-SG",
        learningObjective: "Compare unlike fractions",
        tags: ["fractions", "diagnostic"],
        creationBrief: "Updated teacher-facing brief",
        publication: null,
        publicationStale: false,
      },
    });

    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const screenshot = await app.fetch(
      new Request(
        `https://api.test/v1/revisions/${first.headRevision.id}/screenshot`,
        {
          method: "POST",
          headers: {
            "x-device-token": token,
            "content-type": "image/jpeg",
            origin: "https://studio.test",
          },
          body: jpeg,
        },
      ),
    );
    expect(screenshot.status).toBe(201);
    const history = await app.fetch(
      authenticated(`/v1/artifacts/${first.artifact.id}/revisions`),
    );
    await expect(history.json()).resolves.toMatchObject({
      revisions: [
        {
          id: first.headRevision.id,
          screenshotUrl: null,
        },
      ],
    });

    const published = await app.fetch(
      authenticated(`/v1/artifacts/${first.artifact.id}/publish`, "POST", {
        expectedHeadRevisionId: first.headRevision.id,
      }),
    );
    expect(published.status).toBe(201);
    const firstPublication = (await published.json()) as {
      publication: { slug: string; revisionId: string };
    };
    expect(firstPublication.publication.revisionId).toBe(first.headRevision.id);

    const revised = await app.fetch(
      authenticated(`/v1/artifacts/${first.artifact.id}/revisions`, "POST", {
        instruction: "Use a number line",
        expectedHeadRevisionId: first.headRevision.id,
      }),
    );
    const second = (await revised.json()) as {
      artifact: { publicationStale: boolean };
      headRevision: { id: string };
    };
    expect(second.artifact.publicationStale).toBe(true);
    const republished = await app.fetch(
      authenticated(`/v1/artifacts/${first.artifact.id}/publish`, "POST", {
        expectedHeadRevisionId: second.headRevision.id,
      }),
    );
    const secondPublication = (await republished.json()) as {
      publication: { slug: string; revisionId: string };
    };
    expect(secondPublication.publication.slug).toBe(
      firstPublication.publication.slug,
    );
    expect(secondPublication.publication.revisionId).toBe(
      second.headRevision.id,
    );
  });

  it("stops expired publications from authorising search, preferred context, or remix", async () => {
    const generated = await app.fetch(
      authenticated("/v1/artifacts/generate", "POST", creationBrief),
    );
    const first = (await generated.json()) as {
      artifact: { id: string };
      headRevision: RevisionRecord;
    };
    expect(
      (
        await app.fetch(
          authenticated(`/v1/artifacts/${first.artifact.id}/publish`, "POST", {
            expectedHeadRevisionId: first.headRevision.id,
          }),
        )
      ).status,
    ).toBe(201);

    const otherToken = (
      await issueDeviceToken(secret, new Date("2026-08-02T00:00:00Z"))
    ).token;
    const asOtherDevice = (path: string, method = "GET", body?: unknown) =>
      new Request(`https://api.test${path}`, {
        method,
        headers: {
          "x-device-token": otherToken,
          "cf-connecting-ip": "198.51.100.8",
          origin: "https://studio.test",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const provider = new FixtureModelProvider();
    let receivedExemplars: string[] = [];
    const generate = provider.generate.bind(provider);
    provider.generate = async (brief, exemplars) => {
      receivedExemplars = exemplars.map((exemplar) => exemplar.revisionId);
      return generate(brief, exemplars);
    };
    app = createStudioApp({
      repository,
      provider,
      config,
      sources,
      now: () => new Date("2026-12-01T00:00:00Z"),
    });

    const searched = await app.fetch(
      asOtherDevice("/v1/examples/search?q=fractions"),
    );
    await expect(searched.json()).resolves.toEqual({ examples: [] });
    expect(
      (
        await app.fetch(
          asOtherDevice(
            `/v1/revisions/${first.headRevision.id}/remix`,
            "POST",
            {},
          ),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await app.fetch(
          asOtherDevice("/v1/artifacts/generate", "POST", {
            ...creationBrief,
            preferredExampleRevisionId: first.headRevision.id,
          }),
        )
      ).status,
    ).toBe(201);
    expect(receivedExemplars).toEqual([]);
  });

  it("persists no artifact when generation and its single repair are invalid", async () => {
    const invalidProvider = {
      ...new FixtureModelProvider(),
      name: "invalid",
      generate: async () => ({ html: "not html" }),
      repair: async () => ({ html: "still not html" }),
      revise: async () => ({ html: "not html" }),
      moderate: async () => ({ safe: true, categories: [] }),
    };
    app = createStudioApp({
      repository,
      provider: invalidProvider,
      config,
      sources,
      now: () => new Date("2026-08-02T00:00:00Z"),
    });

    const response = await app.fetch(
      authenticated("/v1/artifacts/generate", "POST", creationBrief),
    );
    expect(response.status).toBe(422);
    expect(repository.artifacts.size).toBe(0);
    expect(repository.revisions.size).toBe(0);
    expect(sources.sources.size).toBe(0);
  });

  it("rejects a revision if the head changes while the provider is working", async () => {
    const provider = new FixtureModelProvider();
    app = createStudioApp({
      repository,
      provider,
      config,
      sources,
      now: () => new Date("2026-08-02T00:00:00Z"),
    });
    const generated = await app.fetch(
      authenticated("/v1/artifacts/generate", "POST", creationBrief),
    );
    const first = (await generated.json()) as {
      artifact: { id: string };
      headRevision: RevisionRecord;
    };
    const ownerHash = repository.artifacts.get(first.artifact.id)!.ownerHash;
    const storedFirst = (await repository.getRevision(first.headRevision.id))!;
    const originalRevise = provider.revise.bind(provider);
    provider.revise = async (...args) => {
      const competing: RevisionRecord = {
        ...storedFirst,
        id: "competing-revision",
        parentRevisionId: first.headRevision.id,
        sourceHash: "competing-hash",
        kind: "revision",
        createdAt: "2026-08-02T00:00:01Z",
      };
      await repository.createRevision(
        competing,
        ownerHash,
        first.headRevision.id,
        [],
      );
      return originalRevise(...args);
    };

    const response = await app.fetch(
      authenticated(`/v1/artifacts/${first.artifact.id}/revisions`, "POST", {
        instruction: "Use a number line",
        expectedHeadRevisionId: first.headRevision.id,
      }),
    );
    expect(response.status).toBe(409);
    expect(repository.revisions.size).toBe(2);
  });

  it("returns an empty example search for punctuation-only input", async () => {
    const response = await app.fetch(
      authenticated("/v1/examples/search?q=%28%29%3A&limit=-1"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ examples: [] });
  });

  it("enforces the saved-artifact cap for remixes", async () => {
    app = createStudioApp({
      repository,
      provider: new FixtureModelProvider(),
      config: { ...config, maximumDraftsPerOwner: 1 },
      sources,
      now: () => new Date("2026-08-02T00:00:00Z"),
    });
    const generated = await app.fetch(
      authenticated("/v1/artifacts/generate", "POST", creationBrief),
    );
    const first = (await generated.json()) as { headRevision: RevisionRecord };

    const remix = await app.fetch(
      authenticated(`/v1/revisions/${first.headRevision.id}/remix`, "POST", {}),
    );
    expect(remix.status).toBe(429);
  });

  it("rejects invalid publication extension durations before repository writes", async () => {
    for (const days of [-1, 0, 1.5, 366, "30"]) {
      const response = await app.fetch(
        authenticated("/v1/publications/ABCDEFGHIJKLMNOPQRST", "PATCH", {
          days,
        }),
      );
      expect(response.status).toBe(422);
    }
  });
});
