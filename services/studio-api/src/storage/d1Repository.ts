import type {
  ArtifactRecord,
  ContentReportInput,
  CreateArtifactInput,
  ExtendPublicationResult,
  PublicationRecord,
  RetrievalEntry,
  RevisionRecord,
  StudioRepository,
} from "./repository";
type Row = Record<string, string | number | null>;
const art = (r: Row): ArtifactRecord => ({
  id: r.id as string,
  ownerHash: r.owner_hash as string,
  title: r.title as string,
  summary: r.summary as string,
  subject: r.subject as string | null,
  level: r.level as string | null,
  locale: r.locale as string | null,
  learningObjective: r.learning_objective as string | null,
  tags: JSON.parse((r.tags_json as string) || "[]") as string[],
  creationBrief: r.creation_brief as string,
  generationBrief: r.generation_brief_json as string,
  headRevisionId: r.head_revision_id as string,
  remixedFromRevisionId: r.remixed_from_revision_id as string | null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});
const rev = (r: Row): RevisionRecord => ({
  id: r.id as string,
  artifactId: r.artifact_id as string,
  parentRevisionId: r.parent_revision_id as string | null,
  sourceHash: r.source_hash as string,
  sourceBytes: r.source_bytes as number,
  kind: r.kind as RevisionRecord["kind"],
  instruction: r.instruction as string | null,
  designCard: r.design_card_json as string | null,
  exemplars: JSON.parse((r.exemplars_json as string) || "[]") as string[],
  modelVersion: r.model_version as string,
  promptVersion: r.prompt_version as string,
  screenshotKey: r.screenshot_key as string | null,
  createdAt: r.created_at as string,
});
const pub = (r: Row): PublicationRecord => ({
  slug: r.slug as string,
  artifactId: r.artifact_id as string,
  revisionId: r.revision_id as string,
  ownerHash: r.owner_hash as string,
  title: r.title as string,
  sourceHash: r.source_hash as string,
  createdAt: r.created_at as string,
  expiresAt: r.expires_at as string,
  revokedAt: r.revoked_at as string | null,
});
export class D1StudioRepository implements StudioRepository {
  constructor(private db: D1Database) {}
  private p(s: string, ...v: unknown[]) {
    return this.db.prepare(s).bind(...v);
  }
  async consumeGeneration(s: string, d: string, l: number) {
    const r = await this.p(
      "INSERT INTO generation_usage(owner_hash,usage_date,request_count) VALUES(?1,?2,1) ON CONFLICT(owner_hash,usage_date) DO UPDATE SET request_count=request_count+1 WHERE request_count<?3",
      s,
      d,
      l,
    ).run();
    return (r.meta.changes ?? 0) === 1;
  }
  async purgeUsage(b: string) {
    await this.p("DELETE FROM generation_usage WHERE usage_date<?1", b).run();
  }
  async consumeClassCode(h: string, n: string) {
    const r = await this.p(
      "UPDATE class_codes SET use_count=use_count+1,last_used_at=?1 WHERE code_hash=?2 AND use_count<maximum_uses AND expires_at>?1",
      n,
      h,
    ).run();
    return (r.meta.changes ?? 0) === 1;
  }
  async countArtifacts(o: string) {
    return (
      (
        await this.p(
          "SELECT count(*) n FROM artifacts WHERE owner_hash=?1",
          o,
        ).first<{ n: number }>()
      )?.n ?? 0
    );
  }
  async createArtifact(i: CreateArtifactInput) {
    const a = i.artifact,
      r = i.revision;
    await this.db.batch([
      this.p(
        "INSERT INTO artifacts(id,owner_hash,title,creation_brief,head_revision_id,remixed_from_revision_id,created_at,updated_at,summary,subject,level,locale,learning_objective,tags_json,generation_brief_json) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
        a.id,
        a.ownerHash,
        a.title,
        a.creationBrief,
        a.headRevisionId,
        a.remixedFromRevisionId,
        a.createdAt,
        a.updatedAt,
        a.summary,
        a.subject,
        a.level,
        a.locale,
        a.learningObjective,
        JSON.stringify(a.tags),
        a.generationBrief,
      ),
      this.revInsert(r),
      ...i.assetIds.map((x) =>
        this.p("INSERT INTO revision_assets VALUES(?1,?2)", r.id, x),
      ),
    ]);
  }
  private revInsert(r: RevisionRecord) {
    return this.p(
      "INSERT INTO revisions VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
      r.id,
      r.artifactId,
      r.parentRevisionId,
      r.sourceHash,
      r.sourceBytes,
      r.kind,
      r.instruction,
      r.designCard,
      JSON.stringify(r.exemplars),
      r.modelVersion,
      r.promptVersion,
      r.screenshotKey,
      r.createdAt,
    );
  }
  async getArtifact(id: string, o: string) {
    const r = await this.p(
      "SELECT * FROM artifacts WHERE id=?1 AND owner_hash=?2",
      id,
      o,
    ).first<Row>();
    return r ? art(r) : null;
  }
  async getArtifactPublic(id: string) {
    const r = await this.p(
      "SELECT * FROM artifacts WHERE id=?1",
      id,
    ).first<Row>();
    return r ? art(r) : null;
  }
  async listArtifacts(o: string) {
    return (
      await this.p(
        "SELECT * FROM artifacts WHERE owner_hash=?1 ORDER BY updated_at DESC LIMIT 100",
        o,
      ).all<Row>()
    ).results.map(art);
  }
  async updateArtifactMetadata(
    id: string,
    o: string,
    m: import("./repository").ArtifactMetadata,
    n: string,
  ) {
    await this.p(
      "UPDATE artifacts SET title=?1,summary=?2,subject=?3,level=?4,locale=?5,learning_objective=?6,tags_json=?7,creation_brief=?8,updated_at=?9 WHERE id=?10 AND owner_hash=?11",
      m.title,
      m.summary,
      m.subject,
      m.level,
      m.locale,
      m.learningObjective,
      JSON.stringify(m.tags),
      m.creationBrief,
      n,
      id,
      o,
    ).run();
    return this.getArtifact(id, o);
  }
  async deleteArtifact(id: string, o: string) {
    const r = await this.p(
      "DELETE FROM artifacts WHERE id=?1 AND owner_hash=?2 RETURNING id",
      id,
      o,
    ).all<{ id: string }>();
    return r.results.length === 1;
  }
  async deleteExpiredArtifacts(b: string, n: string, l = 100) {
    const r = await this.p(
      "DELETE FROM artifacts WHERE id IN(SELECT a.id FROM artifacts a WHERE updated_at<?1 AND NOT EXISTS(SELECT 1 FROM publications p WHERE p.artifact_id=a.id AND revoked_at IS NULL AND expires_at>?2) LIMIT ?3)",
      b,
      n,
      l,
    ).run();
    return r.meta.changes ?? 0;
  }
  async getRevision(id: string) {
    const r = await this.p(
      "SELECT * FROM revisions WHERE id=?1",
      id,
    ).first<Row>();
    return r ? rev(r) : null;
  }
  async listRevisions(id: string, o: string) {
    return (
      await this.p(
        "SELECT r.* FROM revisions r JOIN artifacts a ON a.id=r.artifact_id WHERE r.artifact_id=?1 AND a.owner_hash=?2 ORDER BY r.created_at",
        id,
        o,
      ).all<Row>()
    ).results.map(rev);
  }
  async createRevision(
    r: RevisionRecord,
    o: string,
    e: string,
    assets: string[],
  ) {
    if (r.parentRevisionId !== e) return false;
    const insert = this.p(
      `INSERT INTO revisions(id,artifact_id,parent_revision_id,source_hash,source_bytes,kind,instruction,design_card_json,exemplars_json,model_version,prompt_version,screenshot_key,created_at)
SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13
FROM artifacts a JOIN revisions parent ON parent.id=?3 AND parent.artifact_id=a.id
WHERE a.id=?2 AND a.owner_hash=?14 AND a.head_revision_id=?3`,
      r.id,
      r.artifactId,
      r.parentRevisionId,
      r.sourceHash,
      r.sourceBytes,
      r.kind,
      r.instruction,
      r.designCard,
      JSON.stringify(r.exemplars),
      r.modelVersion,
      r.promptVersion,
      r.screenshotKey,
      r.createdAt,
      o,
    );
    const statements = [
      insert,
      ...assets.map((x) =>
        this.p(
          "INSERT INTO revision_assets(revision_id,asset_id) SELECT ?1,?2 WHERE EXISTS(SELECT 1 FROM revisions WHERE id=?1 AND artifact_id=?3)",
          r.id,
          x,
          r.artifactId,
        ),
      ),
      this.p(
        "UPDATE artifacts SET head_revision_id=?1,updated_at=?2 WHERE id=?3 AND owner_hash=?4 AND head_revision_id=?5 AND EXISTS(SELECT 1 FROM revisions WHERE id=?1 AND artifact_id=?3)",
        r.id,
        r.createdAt,
        r.artifactId,
        o,
        e,
      ),
    ];
    const x = await this.db.batch(statements);
    return (
      (x[0]?.meta.changes ?? 0) === 1 && (x.at(-1)?.meta.changes ?? 0) === 1
    );
  }
  async moveHead(id: string, o: string, r: string, e: string, n: string) {
    const x = await this.p(
      "UPDATE artifacts SET head_revision_id=?1,updated_at=?2 WHERE id=?3 AND owner_hash=?4 AND head_revision_id=?5 AND EXISTS(SELECT 1 FROM revisions WHERE id=?1 AND artifact_id=?3)",
      r,
      n,
      id,
      o,
      e,
    ).run();
    return (x.meta.changes ?? 0) === 1;
  }
  async setScreenshot(id: string, o: string, k: string) {
    const x = await this.p(
      "UPDATE revisions SET screenshot_key=?1 WHERE id=?2 AND EXISTS(SELECT 1 FROM artifacts a WHERE a.id=revisions.artifact_id AND owner_hash=?3)",
      k,
      id,
      o,
    ).run();
    return (x.meta.changes ?? 0) === 1;
  }
  async isRevisionRetrievable(id: string) {
    return !!(await this.p(
      "SELECT 1 FROM retrieval_entries WHERE revision_id=?1",
      id,
    ).first());
  }
  async searchRetrieval(q: string, l: number) {
    const rows = await this.p(
      "SELECT r.*,a.title FROM retrieval_fts f JOIN retrieval_entries r ON r.artifact_id=f.artifact_id JOIN artifacts a ON a.id=r.artifact_id WHERE retrieval_fts MATCH ?1 LIMIT ?2",
      q,
      l,
    ).all<Row>();
    return rows.results.map((x) => ({
      artifactId: x.artifact_id as string,
      revisionId: x.revision_id as string,
      title: x.title as string,
      descriptor: x.descriptor as string,
      html: "",
      curated: x.curated === 1,
    }));
  }
  async publish(
    slug: string,
    a: ArtifactRecord,
    r: RevisionRecord,
    e: string,
    n: string,
    _html: string,
  ) {
    const publicationWrite = this.p(
      `INSERT INTO publications(slug,artifact_id,revision_id,owner_hash,title,source_hash,created_at,expires_at)
SELECT coalesce(
  (SELECT slug FROM publications WHERE artifact_id=?2 AND owner_hash=?4 AND revoked_at IS NULL),
  ?1
),?2,?3,?4,?5,?6,?7,?8
FROM artifacts
WHERE id=?2 AND owner_hash=?4 AND head_revision_id=?3
ON CONFLICT(artifact_id) WHERE revoked_at IS NULL DO UPDATE SET
  revision_id=?3,title=?5,source_hash=?6,expires_at=?8
WHERE publications.owner_hash=?4`,
      slug,
      a.id,
      r.id,
      a.ownerHash,
      a.title,
      r.sourceHash,
      n,
      e,
    );
    const retrievalWrite = this.p(
      `INSERT INTO retrieval_entries(artifact_id,revision_id,descriptor,curated,updated_at)
SELECT ?1,?2,?3,0,?4 FROM publications
WHERE artifact_id=?1 AND owner_hash=?5 AND revision_id=?2 AND revoked_at IS NULL
ON CONFLICT(artifact_id) DO UPDATE SET
  revision_id=?2,descriptor=?3,updated_at=?4`,
      a.id,
      r.id,
      r.designCard ?? a.creationBrief,
      n,
      a.ownerHash,
    );
    const result = await this.db.batch([publicationWrite, retrievalWrite]);
    if (
      (result[0]?.meta.changes ?? 0) !== 1 ||
      (result[1]?.meta.changes ?? 0) !== 1
    )
      return null;
    return this.getActivePublicationForArtifact(a.id, a.ownerHash);
  }
  async getActivePublicationForArtifact(id: string, o: string) {
    const r = await this.p(
      "SELECT * FROM publications WHERE artifact_id=?1 AND owner_hash=?2 AND revoked_at IS NULL",
      id,
      o,
    ).first<Row>();
    return r ? pub(r) : null;
  }
  async getPublication(s: string) {
    const r = await this.p(
      "SELECT * FROM publications WHERE slug=?1",
      s,
    ).first<Row>();
    return r ? pub(r) : null;
  }
  async publicationReferencesAsset(s: string, id: string) {
    return !!(await this.p(
      "SELECT 1 ok FROM publications p JOIN revision_assets ra ON ra.revision_id=p.revision_id WHERE p.slug=?1 AND ra.asset_id=?2",
      s,
      id,
    ).first());
  }
  async ownerReferencesAsset(o: string, id: string) {
    return !!(await this.p(
      "SELECT 1 FROM revision_assets ra JOIN revisions r ON r.id=ra.revision_id JOIN artifacts a ON a.id=r.artifact_id WHERE a.owner_hash=?1 AND ra.asset_id=?2 LIMIT 1",
      o,
      id,
    ).first());
  }
  async extendPublication(
    s: string,
    o: string,
    n: string,
    d: number,
    m: string,
  ): Promise<ExtendPublicationResult> {
    const r = await this.p(
      "UPDATE publications SET expires_at=strftime('%Y-%m-%dT%H:%M:%fZ',julianday(CASE WHEN expires_at>?1 THEN expires_at ELSE ?1 END)+?2) WHERE slug=?3 AND owner_hash=?4 AND revoked_at IS NULL AND julianday(CASE WHEN expires_at>?1 THEN expires_at ELSE ?1 END)+?2<=julianday(?5) RETURNING *",
      n,
      d,
      s,
      o,
      m,
    ).all<Row>();
    if (r.results[0])
      return { status: "extended", publication: pub(r.results[0]) };
    const p = await this.getPublication(s);
    return !p || p.ownerHash !== o || p.revokedAt
      ? { status: "not-found" }
      : { status: "expiry-limit" };
  }
  async revokePublication(s: string, o: string, n: string) {
    const r = await this.p(
      "UPDATE publications SET revoked_at=coalesce(revoked_at,?1) WHERE slug=?2 AND owner_hash=?3",
      n,
      s,
      o,
    ).run();
    return (r.meta.changes ?? 0) === 1;
  }
  async createContentReport(i: ContentReportInput) {
    const r = await this.p(
      "INSERT INTO content_reports(id,publication_slug,reason,created_at) SELECT ?1,?2,?3,?4 WHERE(SELECT count(*) FROM content_reports WHERE publication_slug=?2)<?5",
      i.id,
      i.publicationSlug,
      i.reason,
      i.now,
      i.maximumPerPublication,
    ).run();
    return (r.meta.changes ?? 0) === 1;
  }
  async deleteContentReports(b: string) {
    const r = await this.p(
      "DELETE FROM content_reports WHERE created_at<?1",
      b,
    ).run();
    return r.meta.changes ?? 0;
  }
}
