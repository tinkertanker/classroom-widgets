import { describe, expect, it } from "vitest";
import { MemoryStudioRepository } from "../src/storage/memoryRepository";
import {
  CURATED_SEED_OWNER,
  type ArtifactRecord,
  type RevisionRecord,
} from "../src/storage/repository";

const now = "2026-08-02T00:00:00.000Z";
function records(id = "artifact-1", ownerHash = "owner-a") {
  const revision: RevisionRecord = {
    id: `${id}-r1`,
    artifactId: id,
    parentRevisionId: null,
    sourceHash: "hash-1",
    sourceBytes: 100,
    kind: "generation",
    instruction: null,
    designCard: null,
    exemplars: [],
    modelVersion: "fixture",
    promptVersion: "v1",
    screenshotKey: null,
    createdAt: now,
  };
  const artifact: ArtifactRecord = {
    id,
    ownerHash,
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
    createdAt: now,
    updatedAt: now,
  };
  return { artifact, revision };
}

describe("MemoryStudioRepository artifact model", () => {
  it("enforces quota boundaries and class-code capacity", async () => {
    const repository = new MemoryStudioRepository();
    expect(
      await repository.consumeGeneration(
        "network-generation:x",
        "2026-08-02",
        2,
      ),
    ).toBe(true);
    expect(
      await repository.consumeGeneration(
        "network-generation:x",
        "2026-08-02",
        2,
      ),
    ).toBe(true);
    expect(
      await repository.consumeGeneration(
        "network-generation:x",
        "2026-08-02",
        2,
      ),
    ).toBe(false);
    repository.classCodes.set("code", {
      maximumUses: 1,
      uses: 0,
      expiresAt: "2026-08-03T00:00:00Z",
    });
    expect(await repository.consumeClassCode("code", now)).toBe(true);
    expect(await repository.consumeClassCode("code", now)).toBe(false);
  });

  it("keeps artifacts private and revisions in an immutable same-artifact chain", async () => {
    const repository = new MemoryStudioRepository();
    const { artifact, revision } = records();
    await repository.createArtifact({
      artifact,
      revision,
      assetIds: ["asset-1"],
    });
    expect(await repository.getArtifact(artifact.id, "owner-b")).toBeNull();
    expect(await repository.listRevisions(artifact.id, "owner-b")).toEqual([]);

    const next = {
      ...revision,
      id: "revision-2",
      parentRevisionId: revision.id,
      sourceHash: "hash-2",
    };
    expect(
      await repository.createRevision(next, "owner-a", revision.id, [
        "asset-2",
      ]),
    ).toBe(true);
    expect(
      (await repository.getArtifact(artifact.id, "owner-a"))?.headRevisionId,
    ).toBe(next.id);
    expect((await repository.getRevision(revision.id))?.sourceHash).toBe(
      "hash-1",
    );

    const other = records("artifact-2");
    await repository.createArtifact({ ...other, assetIds: [] });
    const crossArtifact = {
      ...next,
      id: "bad",
      artifactId: other.artifact.id,
      parentRevisionId: next.id,
    };
    expect(
      await repository.createRevision(crossArtifact, "owner-a", next.id, []),
    ).toBe(false);
    expect(
      await repository.moveHead(
        artifact.id,
        "owner-a",
        other.revision.id,
        next.id,
        now,
      ),
    ).toBe(false);
  });

  it("publishes the exact head, reuses its slug, checks live assets, and supports lifecycle controls", async () => {
    const repository = new MemoryStudioRepository();
    const { artifact, revision } = records();
    await repository.createArtifact({
      artifact,
      revision,
      assetIds: ["asset-1"],
    });
    const first = await repository.publish(
      "first-slug",
      artifact,
      revision,
      "2026-09-01T00:00:00Z",
      now,
      "<html/>",
    );
    expect(first?.revisionId).toBe(revision.id);
    expect(await repository.isRevisionRetrievable(revision.id, now)).toBe(true);
    expect(
      await repository.publicationReferencesAsset("first-slug", "asset-1"),
    ).toBe(true);
    expect(
      await repository.publicationReferencesAsset("first-slug", "asset-2"),
    ).toBe(false);

    const next = {
      ...revision,
      id: "revision-2",
      parentRevisionId: revision.id,
      sourceHash: "hash-2",
    };
    await repository.createRevision(next, "owner-a", revision.id, []);
    const current = await repository.getArtifact(artifact.id, "owner-a");
    expect(
      (
        await repository.publish(
          "unused-slug",
          current!,
          next,
          "2026-10-01T00:00:00Z",
          now,
          "<html/>",
        )
      )?.slug,
    ).toBe("first-slug");
    expect(await repository.isRevisionRetrievable(revision.id, now)).toBe(
      false,
    );
    expect(await repository.isRevisionRetrievable(next.id, now)).toBe(true);
    expect(
      await repository.publish(
        "stale",
        artifact,
        revision,
        "2026-10-01T00:00:00Z",
        now,
        "<html/>",
      ),
    ).toBeNull();
    expect(
      (
        await repository.extendPublication(
          "first-slug",
          "owner-a",
          now,
          1,
          "2027-01-01T00:00:00Z",
        )
      ).status,
    ).toBe("extended");
    expect(
      await repository.revokePublication("first-slug", "owner-b", now),
    ).toBe(false);
    expect(
      await repository.revokePublication("first-slug", "owner-a", now),
    ).toBe(true);
  });

  it("preserves remix lineage on the artifact while its first revision has no parent", async () => {
    const repository = new MemoryStudioRepository();
    const original = records();
    await repository.createArtifact({ ...original, assetIds: [] });
    const remix = records("remix");
    remix.artifact.remixedFromRevisionId = original.revision.id;
    remix.revision.kind = "remix";
    await repository.createArtifact({ ...remix, assetIds: [] });
    expect(
      (await repository.getArtifact("remix", "owner-a"))?.remixedFromRevisionId,
    ).toBe(original.revision.id);
    expect(
      (await repository.getRevision(remix.revision.id))?.parentRevisionId,
    ).toBeNull();
  });

  it("retains curated seeds during cleanup and removes revoked teacher artifacts from retrieval", async () => {
    const repository = new MemoryStudioRepository();
    const seed = records("fraction-seed", CURATED_SEED_OWNER);
    seed.revision.kind = "import";
    seed.artifact.updatedAt = "2025-01-01T00:00:00Z";
    await repository.upsertCuratedSeed({
      ...seed,
      assetIds: [],
      descriptor: "fractions mathematics upper primary",
    });
    expect(
      await repository.deleteExpiredArtifacts("2026-01-01T00:00:00Z", now),
    ).toBe(0);
    expect(await repository.isRevisionRetrievable(seed.revision.id, now)).toBe(
      true,
    );

    const teacher = records("teacher-artifact");
    teacher.artifact.title = "Teacher Polygon";
    await repository.createArtifact({ ...teacher, assetIds: [] });
    await repository.publish(
      "teacher-slug",
      teacher.artifact,
      teacher.revision,
      "2026-09-01T00:00:00Z",
      now,
      "<html></html>",
    );
    expect(
      await repository.isRevisionRetrievable(teacher.revision.id, now),
    ).toBe(true);
    expect(
      await repository.isRevisionRetrievable(
        teacher.revision.id,
        "2026-09-01T00:00:00Z",
      ),
    ).toBe(false);
    expect(
      await repository.searchRetrieval('"Polygon"', 10, "2026-09-01T00:00:00Z"),
    ).toEqual([]);
    expect(
      await repository.isRevisionRetrievable(
        seed.revision.id,
        "2030-01-01T00:00:00Z",
      ),
    ).toBe(true);

    await repository.updateArtifactMetadata(
      teacher.artifact.id,
      teacher.artifact.ownerHash,
      { ...teacher.artifact, title: "Decimal Quokka" },
      now,
    );
    expect(await repository.searchRetrieval('"Quokka"', 10, now)).toHaveLength(
      1,
    );
    expect(await repository.searchRetrieval('"Polygon"', 10, now)).toEqual([]);

    await repository.revokePublication("teacher-slug", "owner-a", now);
    expect(
      await repository.isRevisionRetrievable(teacher.revision.id, now),
    ).toBe(false);
    expect(await repository.isRevisionRetrievable(seed.revision.id, now)).toBe(
      true,
    );
  });
});
