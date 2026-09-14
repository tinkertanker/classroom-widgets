export interface ShortenerSettings {
  provider: 'tinyurl' | 'spoo' | 'shortio';
  shortioApiKey: string;
  shortioDomain: string;
}

export function readShortenerSettings(value?: unknown): ShortenerSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    provider: raw.provider === 'spoo' || raw.provider === 'shortio' ? raw.provider : 'tinyurl',
    shortioApiKey: typeof raw.shortioApiKey === 'string' ? raw.shortioApiKey : '',
    shortioDomain: typeof raw.shortioDomain === 'string' ? raw.shortioDomain : '',
  };
}

export function shortenerSettingsScript(settings: ShortenerSettings): string {
  return `window.classroomShortenerSettings = ${JSON.stringify(settings)};`
    + `window.dispatchEvent(new Event('classroom-shortener-settings-changed'));`;
}
