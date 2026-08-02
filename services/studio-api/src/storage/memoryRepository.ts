import type {
  ArtifactRecord,
  ContentReportInput,
  CreateArtifactInput,
  CuratedSeedInput,
  PublicationRecord,
  RetrievalEntry,
  RevisionRecord,
  StudioRepository,
} from "./repository";
import { CURATED_SEED_OWNER } from "./repository";
export class MemoryStudioRepository implements StudioRepository {
  readonly artifacts = new Map<string, ArtifactRecord>();
  readonly revisions = new Map<string, RevisionRecord>();
  readonly publications = new Map<string, PublicationRecord>();
  readonly retrieval = new Map<string, RetrievalEntry>();
  readonly contentReports: ContentReportInput[] = [];
  readonly classCodes = new Map<
    string,
    { maximumUses: number; uses: number; expiresAt: string }
  >();
  private usage = new Map<string, number>();
  private revisionAssets = new Map<string, Set<string>>();
  async consumeGeneration(s: string, d: string, l: number) {
    const k = `${s}:${d}`,
      n = this.usage.get(k) ?? 0;
    if (n >= l) return false;
    this.usage.set(k, n + 1);
    return true;
  }
  async purgeUsage(b: string) {
    for (const k of this.usage.keys())
      if (k.slice(-10) < b) this.usage.delete(k);
  }
  async consumeClassCode(h: string, n: string) {
    const c = this.classCodes.get(h);
    if (!c || c.expiresAt <= n || c.uses >= c.maximumUses) return false;
    c.uses++;
    return true;
  }
  async countArtifacts(o: string) {
    return [...this.artifacts.values()].filter((a) => a.ownerHash === o).length;
  }
  async createArtifact(i: CreateArtifactInput) {
    this.artifacts.set(i.artifact.id, structuredClone(i.artifact));
    this.revisions.set(i.revision.id, structuredClone(i.revision));
    this.revisionAssets.set(i.revision.id, new Set(i.assetIds));
  }
  async upsertCuratedSeed(i: CuratedSeedInput) {
    if (i.artifact.ownerHash !== CURATED_SEED_OWNER || i.assetIds.length)
      throw new Error("Invalid curated seed");
    const existing = this.artifacts.get(i.artifact.id);
    if (existing && existing.ownerHash !== CURATED_SEED_OWNER)
      throw new Error("Curated seed conflicts with an existing artifact");
    this.artifacts.set(i.artifact.id, {
      ...structuredClone(i.artifact),
      createdAt: existing?.createdAt ?? i.artifact.createdAt,
    });
    this.revisions.set(i.revision.id, structuredClone(i.revision));
    this.revisionAssets.set(i.revision.id, new Set());
    this.retrieval.set(i.artifact.id, {
      artifactId: i.artifact.id,
      revisionId: i.revision.id,
      title: i.artifact.title,
      descriptor: i.descriptor,
      html: "",
      curated: true,
    });
  }
  async getArtifact(id: string, o: string) {
    const a = this.artifacts.get(id);
    return a?.ownerHash === o ? structuredClone(a) : null;
  }
  async getArtifactPublic(id: string) {
    const a = this.artifacts.get(id);
    return a ? structuredClone(a) : null;
  }
  async listArtifacts(o: string) {
    return [...this.artifacts.values()]
      .filter((a) => a.ownerHash === o)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((a) => structuredClone(a));
  }
  async updateArtifactMetadata(
    id: string,
    o: string,
    metadata: import("./repository").ArtifactMetadata,
    n: string,
  ) {
    const a = this.artifacts.get(id);
    if (!a || a.ownerHash !== o) return null;
    Object.assign(a, metadata);
    a.updatedAt = n;
    const retrieval = this.retrieval.get(id);
    if (retrieval) retrieval.title = metadata.title;
    return structuredClone(a);
  }
  async deleteArtifact(id: string, o: string) {
    const a = this.artifacts.get(id);
    if (!a || a.ownerHash !== o) return false;
    this.artifacts.delete(id);
    for (const [k, r] of this.revisions)
      if (r.artifactId === id) this.revisions.delete(k);
    for (const [k, p] of this.publications)
      if (p.artifactId === id) this.publications.delete(k);
    this.retrieval.delete(id);
    return true;
  }
  async deleteExpiredArtifacts(b: string, n: string, l = 100) {
    const a = [...this.artifacts.values()]
      .filter(
        (a) =>
          a.ownerHash !== CURATED_SEED_OWNER &&
          a.updatedAt < b &&
          ![...this.publications.values()].some(
            (p) => p.artifactId === a.id && !p.revokedAt && p.expiresAt > n,
          ),
      )
      .slice(0, l);
    for (const x of a) await this.deleteArtifact(x.id, x.ownerHash);
    return a.length;
  }
  async getRevision(id: string) {
    const r = this.revisions.get(id);
    return r ? structuredClone(r) : null;
  }
  async listRevisions(id: string, o: string) {
    if (!(await this.getArtifact(id, o))) return [];
    return [...this.revisions.values()]
      .filter((r) => r.artifactId === id)
      .map((r) => structuredClone(r));
  }
  async createRevision(
    r: RevisionRecord,
    o: string,
    e: string,
    assets: string[],
  ) {
    const a = this.artifacts.get(r.artifactId);
    if (
      !a ||
      a.ownerHash !== o ||
      a.headRevisionId !== e ||
      r.parentRevisionId !== e
    )
      return false;
    this.revisions.set(r.id, structuredClone(r));
    this.revisionAssets.set(r.id, new Set(assets));
    a.headRevisionId = r.id;
    a.updatedAt = r.createdAt;
    return true;
  }
  async moveHead(id: string, o: string, r: string, e: string, n: string) {
    const a = this.artifacts.get(id),
      v = this.revisions.get(r);
    if (
      !a ||
      a.ownerHash !== o ||
      a.headRevisionId !== e ||
      v?.artifactId !== id
    )
      return false;
    a.headRevisionId = r;
    a.updatedAt = n;
    return true;
  }
  async setScreenshot(id: string, o: string, k: string) {
    const r = this.revisions.get(id),
      a = r && this.artifacts.get(r.artifactId);
    if (!r || a?.ownerHash !== o) return false;
    r.screenshotKey = k;
    return true;
  }
  private retrievalEntryIsLive(entry: RetrievalEntry, now: string) {
    return (
      entry.curated ||
      [...this.publications.values()].some(
        (publication) =>
          publication.artifactId === entry.artifactId &&
          publication.revisionId === entry.revisionId &&
          !publication.revokedAt &&
          Date.parse(publication.expiresAt) > Date.parse(now),
      )
    );
  }
  async isRevisionRetrievable(id: string, now: string) {
    return [...this.retrieval.values()].some(
      (entry) =>
        entry.revisionId === id && this.retrievalEntryIsLive(entry, now),
    );
  }
  async searchRetrieval(q: string, l: number, now: string) {
    const terms = q
      .replaceAll('"', "")
      .toLowerCase()
      .split(/\s+or\s+/)
      .filter(Boolean);
    return [...this.retrieval.values()]
      .filter((e) => {
        const document = `${e.title} ${e.descriptor}`.toLowerCase();
        return (
          this.retrievalEntryIsLive(e, now) &&
          terms.some((term) => document.includes(term))
        );
      })
      .sort((a, b) => Number(b.curated) - Number(a.curated))
      .slice(0, l)
      .map((e) => structuredClone(e));
  }
  async publish(
    slug: string,
    a: ArtifactRecord,
    r: RevisionRecord,
    expiresAt: string,
    now: string,
    html: string,
  ) {
    const current = this.artifacts.get(a.id);
    if (!current || current.headRevisionId !== r.id) return null;
    let p = [...this.publications.values()].find(
      (p) => p.artifactId === a.id && !p.revokedAt,
    );
    if (p) {
      p.revisionId = r.id;
      p.sourceHash = r.sourceHash;
      p.title = a.title;
      p.expiresAt = expiresAt;
    } else {
      p = {
        slug,
        artifactId: a.id,
        revisionId: r.id,
        ownerHash: a.ownerHash,
        title: a.title,
        sourceHash: r.sourceHash,
        createdAt: now,
        expiresAt,
        revokedAt: null,
      };
      this.publications.set(slug, p);
    }
    this.retrieval.set(a.id, {
      artifactId: a.id,
      revisionId: r.id,
      title: a.title,
      descriptor: r.designCard ?? a.creationBrief,
      html,
      curated: false,
    });
    return structuredClone(p);
  }
  async getActivePublicationForArtifact(id: string, o: string) {
    const p = [...this.publications.values()].find(
      (p) => p.artifactId === id && p.ownerHash === o && !p.revokedAt,
    );
    return p ? structuredClone(p) : null;
  }
  async getPublication(s: string) {
    const p = this.publications.get(s);
    return p ? structuredClone(p) : null;
  }
  async publicationReferencesAsset(s: string, id: string) {
    const p = this.publications.get(s);
    return !!p && !!this.revisionAssets.get(p.revisionId)?.has(id);
  }
  async ownerReferencesAsset(o: string, id: string) {
    return [...this.revisionAssets].some(([revisionId, assets]) => {
      const revision = this.revisions.get(revisionId);
      return (
        assets.has(id) &&
        !!revision &&
        this.artifacts.get(revision.artifactId)?.ownerHash === o
      );
    });
  }
  async extendPublication(
    s: string,
    o: string,
    n: string,
    d: number,
    m: string,
  ) {
    const p = this.publications.get(s);
    if (!p || p.ownerHash !== o || p.revokedAt)
      return { status: "not-found" } as const;
    const x = new Date(
      Math.max(Date.parse(n), Date.parse(p.expiresAt)) + d * 86400000,
    ).toISOString();
    if (x > m) return { status: "expiry-limit" } as const;
    p.expiresAt = x;
    return { status: "extended", publication: structuredClone(p) } as const;
  }
  async revokePublication(s: string, o: string, n: string) {
    const p = this.publications.get(s);
    if (!p || p.ownerHash !== o) return false;
    p.revokedAt ??= n;
    if (
      ![...this.publications.values()].some(
        (candidate) =>
          candidate.artifactId === p.artifactId && !candidate.revokedAt,
      )
    )
      this.retrieval.delete(p.artifactId);
    return true;
  }
  async createContentReport(i: ContentReportInput) {
    if (
      this.contentReports.filter((r) => r.publicationSlug === i.publicationSlug)
        .length >= i.maximumPerPublication
    )
      return false;
    this.contentReports.push(structuredClone(i));
    return true;
  }
  async deleteContentReports(b: string) {
    const n = this.contentReports.length;
    const keep = this.contentReports.filter((r) => r.now >= b);
    this.contentReports.splice(0, n, ...keep);
    return n - keep.length;
  }
}
