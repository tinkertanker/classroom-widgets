import { describe, expect, it } from "vitest";
import { D1StudioRepository } from "../src/storage/d1Repository";
import {
  CURATED_SEED_OWNER,
  type ArtifactRecord,
  type RevisionRecord,
} from "../src/storage/repository";

const revision: RevisionRecord = {
  id: "r2",
  artifactId: "a1",
  parentRevisionId: "r1",
  sourceHash: "hash",
  sourceBytes: 10,
  kind: "revision",
  instruction: "change",
  designCard: null,
  exemplars: [],
  modelVersion: "fixture",
  promptVersion: "v1",
  screenshotKey: null,
  createdAt: "2026-08-02T00:00:00Z",
};
const artifact: ArtifactRecord = {
  id: "a1",
  ownerHash: "owner-a",
  title: "Fractions",
  summary: "Compare fractions",
  subject: "Mathematics",
  level: "Primary 5",
  locale: "en-SG",
  learningObjective: "Compare fractions",
  tags: ["fractions"],
  creationBrief: "{}",
  generationBrief: "{}",
  headRevisionId: revision.id,
  remixedFromRevisionId: null,
  createdAt: revision.createdAt,
  updatedAt: revision.createdAt,
};

describe("D1StudioRepository conditional revision writes", () => {
  it("uses one batch whose insert checks owner, expected head, and same-artifact parent", async () => {
    const sql: string[] = [];
    const database = {
      prepare(text: string) {
        sql.push(text);
        const statement = { bind: () => statement };
        return statement;
      },
      batch(statements: unknown[]) {
        expect(statements).toHaveLength(3);
        return Promise.resolve(
          statements.map(() => ({ meta: { changes: 1 } })),
        );
      },
    } as unknown as D1Database;
    const repository = new D1StudioRepository(database);
    await expect(
      repository.createRevision(revision, "owner-a", "r1", ["asset-1"]),
    ).resolves.toBe(true);
    expect(sql[0]).toContain("parent.artifact_id=a.id");
    expect(sql[0]).toContain("a.owner_hash=?14");
    expect(sql[0]).toContain("a.head_revision_id=?3");
    expect(sql[1]).toContain("WHERE EXISTS");
    expect(sql[2]).toContain("head_revision_id=?5");
  });

  it("returns false for a stale conditional insert without orphan revision assets", async () => {
    const database = {
      prepare() {
        const statement = { bind: () => statement };
        return statement;
      },
      batch() {
        return Promise.resolve([
          { meta: { changes: 0 } },
          { meta: { changes: 0 } },
          { meta: { changes: 0 } },
        ]);
      },
    } as unknown as D1Database;
    await expect(
      new D1StudioRepository(database).createRevision(
        revision,
        "owner-a",
        "r1",
        ["asset-1"],
      ),
    ).resolves.toBe(false);
  });

  it("rejects a mismatched parent before issuing SQL and does not swallow database failures", async () => {
    let prepared = false;
    const database = {
      prepare() {
        prepared = true;
        throw new Error("unexpected");
      },
    } as unknown as D1Database;
    await expect(
      new D1StudioRepository(database).createRevision(
        revision,
        "owner-a",
        "other",
        [],
      ),
    ).resolves.toBe(false);
    expect(prepared).toBe(false);

    const failing = {
      prepare() {
        const statement = { bind: () => statement };
        return statement;
      },
      batch() {
        return Promise.reject(new Error("D1 unavailable"));
      },
    } as unknown as D1Database;
    await expect(
      new D1StudioRepository(failing).createRevision(
        revision,
        "owner-a",
        "r1",
        [],
      ),
    ).rejects.toThrow("D1 unavailable");
  });

  it("publishes and updates retrieval in one guarded batch", async () => {
    const sql: string[] = [];
    const database = {
      prepare(text: string) {
        sql.push(text);
        const statement = {
          bind: () => statement,
          first: () => Promise.resolve(null),
        };
        return statement;
      },
      batch(statements: unknown[]) {
        expect(statements).toHaveLength(2);
        return Promise.resolve([
          { meta: { changes: 1 } },
          { meta: { changes: 1 } },
        ]);
      },
    } as unknown as D1Database;

    await new D1StudioRepository(database).publish(
      "new-slug",
      artifact,
      revision,
      "2026-09-01T00:00:00Z",
      revision.createdAt,
      "<!doctype html><html></html>",
    );

    expect(sql[0]).toContain(
      "ON CONFLICT(artifact_id) WHERE revoked_at IS NULL",
    );
    expect(sql[0]).toContain("head_revision_id=?3");
    expect(sql[0]).toContain("publications.owner_hash=?4");
    expect(sql[1]).toContain("revision_id=?2 AND revoked_at IS NULL");
  });

  it("upserts curated seed metadata, revision, and retrieval atomically", async () => {
    const sql: string[] = [];
    const database = {
      prepare(text: string) {
        sql.push(text);
        const statement = { bind: () => statement };
        return statement;
      },
      batch(statements: unknown[]) {
        expect(statements).toHaveLength(3);
        return Promise.resolve(
          statements.map(() => ({ meta: { changes: 1 } })),
        );
      },
    } as unknown as D1Database;
    const seedArtifact = {
      ...artifact,
      id: "fraction-seed",
      ownerHash: CURATED_SEED_OWNER,
      headRevisionId: "fraction-seed-seed",
    };
    const seedRevision = {
      ...revision,
      id: "fraction-seed-seed",
      artifactId: seedArtifact.id,
      parentRevisionId: null,
      kind: "import" as const,
    };

    await new D1StudioRepository(database).upsertCuratedSeed({
      artifact: seedArtifact,
      revision: seedRevision,
      assetIds: [],
      descriptor: "fractions diagnostic",
    });

    expect(sql[0]).toContain("ON CONFLICT(id) DO UPDATE");
    expect(sql[0]).toContain("WHERE artifacts.owner_hash=?2");
    expect(sql[1]).toContain("revisions.kind='import'");
    expect(sql[2]).toContain("curated=1");
  });

  it("refreshes retrieval titles and excludes expired teacher publications", async () => {
    const sql: string[] = [];
    const database = {
      prepare(text: string) {
        sql.push(text);
        const statement = {
          bind: () => statement,
          first: () => Promise.resolve(null),
          all: () => Promise.resolve({ results: [] }),
        };
        return statement;
      },
      batch(statements: unknown[]) {
        expect(statements).toHaveLength(2);
        return Promise.resolve(
          statements.map(() => ({ meta: { changes: 1 } })),
        );
      },
    } as unknown as D1Database;
    const repository = new D1StudioRepository(database);

    await repository.updateArtifactMetadata(
      artifact.id,
      artifact.ownerHash,
      { ...artifact, title: "Decimal Quokka" },
      revision.createdAt,
    );
    await repository.isRevisionRetrievable(revision.id, revision.createdAt);
    await repository.searchRetrieval('"Quokka"', 10, revision.createdAt);

    expect(sql[1]).toContain("UPDATE retrieval_entries SET updated_at");
    expect(sql[3]).toContain("p.expires_at>?2");
    expect(sql[4]).toContain("p.expires_at>?3");
    expect(sql[3]).toContain("r.curated=1");
    expect(sql[4]).toContain("r.curated=1");
  });
});
