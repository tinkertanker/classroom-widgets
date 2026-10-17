import { desktopHostScripts, normalizeShortenerProvider, ShortenerProviderId } from './generated/desktopHostScripts';

export interface ShortenerSettings {
  provider: ShortenerProviderId;
  shortioApiKey: string;
  shortioDomain: string;
}

export function readShortenerSettings(value?: unknown): ShortenerSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    provider: normalizeShortenerProvider(raw.provider),
    shortioApiKey: typeof raw.shortioApiKey === 'string' ? raw.shortioApiKey : '',
    shortioDomain: typeof raw.shortioDomain === 'string' ? raw.shortioDomain : '',
  };
}

export function shortenerSettingsScript(settings: ShortenerSettings): string {
  return desktopHostScripts.shortenerSettings(JSON.stringify(settings));
}
