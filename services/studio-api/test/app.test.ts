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
};

describe("Studio API registration and public HTML", () => {
  let repository: MemoryStudioRepository;
  let app: ReturnType<typeof createStudioApp>;
  let sources: MemorySourceStore;
  let token: string;
  beforeEach(async () => {
    repository = new MemoryStudioRepository();
    sources = new MemorySourceStore();
    token = (await issueDeviceToken(
      secret,
      new Date("2026-08-02T00:00:00Z"),
    )).token;
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
    level: "Primary 5",
    subject: "Mathematics",
    learningObjective: "Compare fractions with unlike denominators",
    studentAction: "Choose the larger fraction and check the feedback",
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

  it("creates immutable revisions, moves the head, and records remix lineage", async () => {
    const generated = await app.fetch(
      authenticated("/v1/artifacts/generate", "POST", creationBrief),
    );
    expect(generated.status).toBe(201);
    const first = (await generated.json()) as {
      artifact: { id: string; headRevisionId: string };
      revision: RevisionRecord;
    };
    expect(await sources.getSource(first.revision.sourceHash)).toContain(
      "<!doctype html>",
    );

    const revised = await app.fetch(
      authenticated(
        `/v1/artifacts/${first.artifact.id}/revisions`,
        "POST",
        {
          instruction: "Use a number line",
          expectedHeadRevisionId: first.revision.id,
        },
      ),
    );
    expect(revised.status).toBe(201);
    const second = (await revised.json()) as { revision: RevisionRecord };
    expect(second.revision.parentRevisionId).toBe(first.revision.id);
    expect((await repository.getRevision(first.revision.id))?.sourceHash).toBe(
      first.revision.sourceHash,
    );

    const moved = await app.fetch(
      authenticated(`/v1/artifacts/${first.artifact.id}`, "PATCH", {
        headRevisionId: first.revision.id,
        expectedHeadRevisionId: second.revision.id,
      }),
    );
    expect(moved.status).toBe(200);

    const remix = await app.fetch(
      authenticated(`/v1/revisions/${first.revision.id}/remix`, "POST", {}),
    );
    expect(remix.status).toBe(201);
    const remixed = (await remix.json()) as {
      artifact: { remixedFromRevisionId: string };
      revision: RevisionRecord;
    };
    expect(remixed.artifact.remixedFromRevisionId).toBe(first.revision.id);
    expect(remixed.revision.parentRevisionId).toBeNull();
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
      revision: RevisionRecord;
    };
    const ownerHash = repository.artifacts.get(first.artifact.id)!.ownerHash;
    const storedFirst = (await repository.getRevision(first.revision.id))!;
    const originalRevise = provider.revise.bind(provider);
    provider.revise = async (...args) => {
      const competing: RevisionRecord = {
        ...storedFirst,
        id: "competing-revision",
        parentRevisionId: first.revision.id,
        sourceHash: "competing-hash",
        kind: "revision",
        createdAt: "2026-08-02T00:00:01Z",
      };
      await repository.createRevision(
        competing,
        ownerHash,
        first.revision.id,
        [],
      );
      return originalRevise(...args);
    };

    const response = await app.fetch(
      authenticated(
        `/v1/artifacts/${first.artifact.id}/revisions`,
        "POST",
        {
          instruction: "Use a number line",
          expectedHeadRevisionId: first.revision.id,
        },
      ),
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
    const first = (await generated.json()) as { revision: RevisionRecord };

    const remix = await app.fetch(
      authenticated(`/v1/revisions/${first.revision.id}/remix`, "POST", {}),
    );
    expect(remix.status).toBe(429);
  });

  it("rejects invalid publication extension durations before repository writes", async () => {
    for (const days of [-1, 0, 1.5, 366, "30"]) {
      const response = await app.fetch(
        authenticated(
          "/v1/publications/ABCDEFGHIJKLMNOPQRST",
          "PATCH",
          { days },
        ),
      );
      expect(response.status).toBe(422);
    }
  });
});
