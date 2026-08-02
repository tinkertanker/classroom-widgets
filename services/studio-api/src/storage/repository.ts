export interface ArtifactRecord {
  id: string;
  ownerHash: string;
  title: string;
  summary: string;
  subject: string | null;
  level: string | null;
  locale: string | null;
  learningObjective: string | null;
  tags: string[];
  creationBrief: string;
  generationBrief: string;
  headRevisionId: string;
  remixedFromRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
}
export type ArtifactMetadata = Pick<
  ArtifactRecord,
  | "title"
  | "summary"
  | "subject"
  | "level"
  | "locale"
  | "learningObjective"
  | "tags"
  | "creationBrief"
>;
export interface RevisionRecord {
  id: string;
  artifactId: string;
  parentRevisionId: string | null;
  sourceHash: string;
  sourceBytes: number;
  kind: "generation" | "revision" | "remix" | "import";
  instruction: string | null;
  designCard: string | null;
  exemplars: string[];
  modelVersion: string;
  promptVersion: string;
  screenshotKey: string | null;
  createdAt: string;
}
export interface PublicationRecord {
  slug: string;
  artifactId: string;
  revisionId: string;
  ownerHash: string;
  title: string;
  sourceHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}
export interface RetrievalEntry {
  artifactId: string;
  revisionId: string;
  title: string;
  descriptor: string;
  html: string;
  curated: boolean;
}
export type ContentReportReason =
  "inappropriate" | "personal-data" | "copyright" | "accessibility" | "other";
export interface ContentReportInput {
  id: string;
  publicationSlug: string;
  reason: ContentReportReason;
  now: string;
  maximumPerPublication: number;
}
export type ExtendPublicationResult =
  | { status: "extended"; publication: PublicationRecord }
  | { status: "not-found" }
  | { status: "expiry-limit" };
export interface CreateArtifactInput {
  artifact: ArtifactRecord;
  revision: RevisionRecord;
  assetIds: string[];
}
export interface CuratedSeedInput extends CreateArtifactInput {
  descriptor: string;
}

export const CURATED_SEED_OWNER = "studio-curated-seed";

export interface StudioRepository {
  consumeGeneration(
    subject: string,
    date: string,
    limit: number,
  ): Promise<boolean>;
  purgeUsage(before: string): Promise<void>;
  consumeClassCode(hash: string, now: string): Promise<boolean>;
  countArtifacts(owner: string): Promise<number>;
  createArtifact(input: CreateArtifactInput): Promise<void>;
  upsertCuratedSeed(input: CuratedSeedInput): Promise<void>;
  getArtifact(id: string, owner: string): Promise<ArtifactRecord | null>;
  getArtifactPublic(id: string): Promise<ArtifactRecord | null>;
  listArtifacts(owner: string): Promise<ArtifactRecord[]>;
  updateArtifactMetadata(
    id: string,
    owner: string,
    metadata: ArtifactMetadata,
    now: string,
  ): Promise<ArtifactRecord | null>;
  deleteArtifact(id: string, owner: string): Promise<boolean>;
  deleteExpiredArtifacts(
    before: string,
    now: string,
    limit?: number,
  ): Promise<number>;
  getRevision(id: string): Promise<RevisionRecord | null>;
  listRevisions(artifactId: string, owner: string): Promise<RevisionRecord[]>;
  createRevision(
    revision: RevisionRecord,
    owner: string,
    expectedHead: string,
    assetIds: string[],
  ): Promise<boolean>;
  moveHead(
    artifactId: string,
    owner: string,
    revisionId: string,
    expectedHead: string,
    now: string,
  ): Promise<boolean>;
  setScreenshot(
    revisionId: string,
    owner: string,
    key: string,
  ): Promise<boolean>;
  isRevisionRetrievable(revisionId: string, now: string): Promise<boolean>;
  searchRetrieval(
    query: string,
    limit: number,
    now: string,
  ): Promise<RetrievalEntry[]>;
  publish(
    slug: string,
    artifact: ArtifactRecord,
    revision: RevisionRecord,
    expiresAt: string,
    now: string,
    html: string,
  ): Promise<PublicationRecord | null>;
  getActivePublicationForArtifact(
    id: string,
    owner: string,
  ): Promise<PublicationRecord | null>;
  getPublication(slug: string): Promise<PublicationRecord | null>;
  publicationReferencesAsset(slug: string, assetId: string): Promise<boolean>;
  ownerReferencesAsset(owner: string, assetId: string): Promise<boolean>;
  extendPublication(
    slug: string,
    owner: string,
    now: string,
    days: number,
    max: string,
  ): Promise<ExtendPublicationResult>;
  revokePublication(slug: string, owner: string, now: string): Promise<boolean>;
  createContentReport(input: ContentReportInput): Promise<boolean>;
  deleteContentReports(before: string): Promise<number>;
}
