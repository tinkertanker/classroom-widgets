import type { WidgetSpec } from '@classroom-widgets/widget-spec';

export interface DraftRecord {
  id: string;
  ownerHash: string;
  title: string;
  schemaVersion: string;
  spec: WidgetSpec;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicationRecord {
  slug: string;
  draftId: string;
  ownerHash: string;
  title: string;
  schemaVersion: string;
  spec: WidgetSpec;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface SaveDraftInput {
  id: string;
  ownerHash: string;
  title: string;
  schemaVersion: string;
  spec: WidgetSpec;
  now: string;
}

export interface UpdateDraftInput {
  id: string;
  ownerHash: string;
  title: string;
  schemaVersion: string;
  spec: WidgetSpec;
  expectedVersion: number;
  instruction: string;
  now: string;
}

export interface PublishInput {
  slug: string;
  draft: DraftRecord;
  expiresAt: string;
  now: string;
}

export type ContentReportReason =
  | 'inappropriate'
  | 'personal-data'
  | 'copyright'
  | 'accessibility'
  | 'other';

export interface ContentReportInput {
  id: string;
  publicationSlug: string;
  reason: ContentReportReason;
  now: string;
  maximumPerPublication: number;
}

export interface StudioRepository {
  consumeGeneration(ownerHash: string, usageDate: string, limit: number): Promise<boolean>;
  countDrafts(ownerHash: string): Promise<number>;
  purgeUsage(beforeDate: string): Promise<void>;
  consumePilotCode(codeHash: string, now: string): Promise<boolean>;
  createDraft(input: SaveDraftInput): Promise<DraftRecord>;
  getDraft(id: string, ownerHash: string): Promise<DraftRecord | null>;
  listDrafts(ownerHash: string): Promise<DraftRecord[]>;
  deleteDraft(id: string, ownerHash: string): Promise<boolean>;
  deleteExpiredDrafts(before: string, now: string, limit?: number): Promise<number>;
  updateDraft(input: UpdateDraftInput): Promise<DraftRecord | null>;
  publish(input: PublishInput): Promise<PublicationRecord>;
  getActivePublicationForDraft(
    draftId: string,
    ownerHash: string,
  ): Promise<PublicationRecord | null>;
  getPublication(slug: string): Promise<PublicationRecord | null>;
  extendPublication(slug: string, ownerHash: string, expiresAt: string): Promise<PublicationRecord | null>;
  revokePublication(slug: string, ownerHash: string, now: string): Promise<boolean>;
  createContentReport(input: ContentReportInput): Promise<boolean>;
  deleteContentReports(before: string): Promise<number>;
}
