import type {
  DraftRecord,
  ContentReportInput,
  PublicationRecord,
  PublishInput,
  SaveDraftInput,
  StudioRepository,
  UpdateDraftInput,
} from './repository';

/** Test/local implementation. Production uses D1StudioRepository. */
export class MemoryStudioRepository implements StudioRepository {
  readonly drafts = new Map<string, DraftRecord>();
  readonly publications = new Map<string, PublicationRecord>();
  private readonly generationUsage = new Map<string, number>();
  readonly contentReports: ContentReportInput[] = [];
  readonly pilotCodes = new Map<string, { maximumUses: number; uses: number; expiresAt: string }>();

  async consumeGeneration(ownerHash: string, usageDate: string, limit: number): Promise<boolean> {
    const key = `${ownerHash}:${usageDate}`;
    const current = this.generationUsage.get(key) ?? 0;
    if (current >= limit) return false;
    this.generationUsage.set(key, current + 1);
    return true;
  }

  async countDrafts(ownerHash: string): Promise<number> {
    return [...this.drafts.values()].filter((draft) => draft.ownerHash === ownerHash).length;
  }

  async purgeUsage(beforeDate: string): Promise<void> {
    for (const key of this.generationUsage.keys()) {
      const usageDate = key.slice(key.lastIndexOf(':') + 1);
      if (usageDate < beforeDate) this.generationUsage.delete(key);
    }
  }

  async consumePilotCode(codeHash: string, now: string): Promise<boolean> {
    const code = this.pilotCodes.get(codeHash);
    if (!code || code.expiresAt <= now || code.uses >= code.maximumUses) return false;
    code.uses += 1;
    return true;
  }

  async createDraft(input: SaveDraftInput): Promise<DraftRecord> {
    const draft: DraftRecord = {
      ...input,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.drafts.set(draft.id, structuredClone(draft));
    return structuredClone(draft);
  }

  async getDraft(id: string, ownerHash: string): Promise<DraftRecord | null> {
    const draft = this.drafts.get(id);
    return draft?.ownerHash === ownerHash ? structuredClone(draft) : null;
  }

  async listDrafts(ownerHash: string): Promise<DraftRecord[]> {
    return [...this.drafts.values()]
      .filter((draft) => draft.ownerHash === ownerHash)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((draft) => structuredClone(draft));
  }

  async deleteDraft(id: string, ownerHash: string): Promise<boolean> {
    const draft = this.drafts.get(id);
    if (!draft || draft.ownerHash !== ownerHash) return false;
    for (const [slug, publication] of this.publications) {
      if (publication.draftId === id && publication.ownerHash === ownerHash) {
        this.publications.delete(slug);
      }
    }
    return this.drafts.delete(id);
  }

  async deleteExpiredDrafts(before: string, now: string, limit = 100): Promise<number> {
    const candidates = [...this.drafts.values()]
      .filter((draft) => {
        if (draft.updatedAt >= before) return false;
        return ![...this.publications.values()].some(
          (publication) =>
            publication.draftId === draft.id &&
            publication.revokedAt === null &&
            publication.expiresAt > now,
        );
      })
      .slice(0, limit);
    let deleted = 0;
    for (const draft of candidates) {
      if (await this.deleteDraft(draft.id, draft.ownerHash)) deleted += 1;
    }
    return deleted;
  }

  async updateDraft(input: UpdateDraftInput): Promise<DraftRecord | null> {
    const draft = this.drafts.get(input.id);
    if (
      !draft ||
      draft.ownerHash !== input.ownerHash ||
      draft.version !== input.expectedVersion
    ) {
      return null;
    }

    const updated: DraftRecord = {
      ...draft,
      title: input.title,
      schemaVersion: input.schemaVersion,
      spec: structuredClone(input.spec),
      version: draft.version + 1,
      updatedAt: input.now,
    };
    this.drafts.set(updated.id, updated);
    return structuredClone(updated);
  }

  async publish(input: PublishInput): Promise<PublicationRecord> {
    const existing = await this.getActivePublicationForDraft(
      input.draft.id,
      input.draft.ownerHash,
    );
    if (existing) {
      const updated: PublicationRecord = {
        ...existing,
        title: input.draft.title,
        schemaVersion: input.draft.schemaVersion,
        spec: structuredClone(input.draft.spec),
        expiresAt: input.expiresAt,
      };
      this.publications.set(updated.slug, updated);
      return structuredClone(updated);
    }
    if (this.publications.has(input.slug)) throw new Error('Publication slug already exists.');
    const publication: PublicationRecord = {
      slug: input.slug,
      draftId: input.draft.id,
      ownerHash: input.draft.ownerHash,
      title: input.draft.title,
      schemaVersion: input.draft.schemaVersion,
      spec: structuredClone(input.draft.spec),
      createdAt: input.now,
      expiresAt: input.expiresAt,
      revokedAt: null,
    };
    this.publications.set(publication.slug, publication);
    return structuredClone(publication);
  }

  async getActivePublicationForDraft(
    draftId: string,
    ownerHash: string,
  ): Promise<PublicationRecord | null> {
    const publication = [...this.publications.values()].find(
      (candidate) =>
        candidate.draftId === draftId &&
        candidate.ownerHash === ownerHash &&
        candidate.revokedAt === null,
    );
    return publication ? structuredClone(publication) : null;
  }

  async getPublication(slug: string): Promise<PublicationRecord | null> {
    const publication = this.publications.get(slug);
    return publication ? structuredClone(publication) : null;
  }

  async extendPublication(
    slug: string,
    ownerHash: string,
    expiresAt: string,
  ): Promise<PublicationRecord | null> {
    const publication = this.publications.get(slug);
    if (!publication || publication.ownerHash !== ownerHash || publication.revokedAt) return null;
    publication.expiresAt = expiresAt;
    return structuredClone(publication);
  }

  async revokePublication(slug: string, ownerHash: string, now: string): Promise<boolean> {
    const publication = this.publications.get(slug);
    if (!publication || publication.ownerHash !== ownerHash) return false;
    publication.revokedAt ??= now;
    return true;
  }

  async createContentReport(input: ContentReportInput): Promise<boolean> {
    const count = this.contentReports.filter(
      (report) => report.publicationSlug === input.publicationSlug,
    ).length;
    if (count >= input.maximumPerPublication) return false;
    this.contentReports.push(structuredClone(input));
    return true;
  }

  async deleteContentReports(before: string): Promise<number> {
    const retained = this.contentReports.filter((report) => report.now >= before);
    const deleted = this.contentReports.length - retained.length;
    this.contentReports.splice(0, this.contentReports.length, ...retained);
    return deleted;
  }
}
