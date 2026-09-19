import type { Display } from 'electron';
import { describePosition, Rect } from './displayGeometry';

export interface DisplayDescriptor {
  id: number;
  name: string;
  bounds: Rect;
  scaleFactor: number;
  internal: boolean;
}

export interface DisplaySource {
  getAllDisplays(): Display[];
}

export class DisplayCatalog {
  constructor(private readonly source: DisplaySource) {}

  displays(): DisplayDescriptor[] {
    return this.source.getAllDisplays().map((display, index) => ({
      id: display.id,
      name: display.label?.trim() || `Display ${index + 1}`,
      bounds: { ...display.bounds },
      scaleFactor: Number.isFinite(display.scaleFactor) && display.scaleFactor > 0 ? display.scaleFactor : 1,
      internal: display.internal,
    }));
  }

  eligibleSources(hostDisplayId: number | null): DisplayDescriptor[] {
    return this.displays().filter((display) => display.id !== hostDisplayId);
  }

  currentMatching(descriptor: DisplayDescriptor): DisplayDescriptor | null {
    return this.displays().find((display) => display.id === descriptor.id) ?? null;
  }

  resolveSource(rememberedId: number | null, candidates: DisplayDescriptor[]): DisplayDescriptor | null {
    return candidates.find((candidate) => candidate.id === rememberedId)
      ?? (candidates.length === 1 ? candidates[0] : null);
  }

  sourceLabel(display: DisplayDescriptor): string {
    return `${display.name} — ${Math.round(display.bounds.width)} × ${Math.round(display.bounds.height)}, ${describePosition(display.bounds)}`;
  }
}
