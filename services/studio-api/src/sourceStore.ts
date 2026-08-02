import type { ArtifactStorageReferences } from "./storage/repository";

export interface SourceStore {
  putSource(hash: string, html: string): Promise<void>;
  getSource(hash: string): Promise<string | null>;
  putScreenshot(revisionId: string, bytes: Uint8Array): Promise<string>;
  deleteScreenshot(key: string): Promise<void>;
}
export class R2SourceStore implements SourceStore {
  constructor(private readonly bucket: R2Bucket) {}
  async putSource(hash: string, html: string) {
    await this.bucket.put(`sources/${hash}.html`, html, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
    });
  }
  async getSource(hash: string) {
    const object = await this.bucket.get(`sources/${hash}.html`);
    return object ? object.text() : null;
  }
  async putScreenshot(id: string, bytes: Uint8Array) {
    const key = `screens/${id}.jpg`;
    await this.bucket.put(key, bytes, {
      httpMetadata: { contentType: "image/jpeg" },
    });
    return key;
  }
  async deleteScreenshot(key: string) {
    await this.bucket.delete(key);
  }
}

export async function cleanupArtifactStorage(
  store: SourceStore,
  references: ArtifactStorageReferences,
): Promise<void> {
  await Promise.allSettled(
    references.screenshotKeys.map((key) => store.deleteScreenshot(key)),
  );
}
export class MemorySourceStore implements SourceStore {
  readonly sources = new Map<string, string>();
  readonly screens = new Map<string, Uint8Array>();
  async putSource(hash: string, html: string) {
    this.sources.set(hash, html);
  }
  async getSource(hash: string) {
    return this.sources.get(hash) ?? null;
  }
  async putScreenshot(id: string, bytes: Uint8Array) {
    const key = `screens/${id}.jpg`;
    this.screens.set(key, bytes);
    return key;
  }
  async deleteScreenshot(key: string) {
    this.screens.delete(key);
  }
}
