import type { RgbColor } from 'react-colorful';
import type { TextBannerFontFamily } from './fonts';

export interface TextBannerState {
  text: string;
  colorIndex: number;
  customColor: string;
  fontFamily: TextBannerFontFamily;
  fontSizeCap: number;
  /** Retained for rollback compatibility; displayed-banner cycling is always enabled. */
  clickToRecolour: boolean;
  columnHeight?: number;
}

export type TextBannerDraft = Pick<TextBannerState, 'text' | 'colorIndex' | 'customColor' | 'fontFamily' | 'fontSizeCap'>;

export const DEFAULT_COLUMN_HEIGHT = 160;
export const MIN_COLUMN_HEIGHT = 128;
export const MAX_COLUMN_HEIGHT = 1200;
export const EDITOR_MIN_HEIGHT = 260;

export const colorCombinations = [
  { name: 'Terracotta', bg: 'bg-terracotta-500 dark:bg-terracotta-600', text: 'text-soft-white dark:text-white', swatch: '#d97757' },
  { name: 'Sage', bg: 'bg-sage-600 dark:bg-sage-700', text: 'text-soft-white dark:text-white', swatch: '#5c7560' },
  { name: 'Charcoal', bg: 'bg-warm-gray-800 dark:bg-warm-gray-900', text: 'text-soft-white dark:text-warm-gray-100', swatch: '#3f3a36' },
  { name: 'Rose', bg: 'bg-dusty-rose-600 dark:bg-dusty-rose-700', text: 'text-soft-white dark:text-white', swatch: '#b96370' },
  { name: 'Cream', bg: 'bg-soft-white dark:bg-warm-gray-200', text: 'text-warm-gray-900 dark:text-warm-gray-900', swatch: '#f8f5f0' },
  { name: 'Blue', bg: 'bg-blue-600 dark:bg-blue-700', text: 'text-soft-white dark:text-white', swatch: '#2563eb' }
];

const LEGACY_PLACEHOLDER_TEXT = 'Double-click to edit';
export const DEFAULT_FONT_SIZE_CAP = 48;
export const MIN_FONT_SIZE_CAP = 24;
export const MAX_FONT_SIZE_CAP = 220;
export const FONT_SIZE_STEP = 16;
export const DEFAULT_CUSTOM_COLOR = '#7c3aed';

export const normaliseSavedText = (value: string) => value === LEGACY_PLACEHOLDER_TEXT ? '' : value;
export const normaliseCustomColor = (value?: string) =>
  value && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : DEFAULT_CUSTOM_COLOR;

export const getCustomTextColor = (hex: string) => {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)]
    .map(channel => Number.parseInt(channel, 16) / 255)
    .map(channel => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? '#1c1917' : '#ffffff';
};

export const hexToRgb = (hex: string): RgbColor => ({
  r: Number.parseInt(hex.slice(1, 3), 16),
  g: Number.parseInt(hex.slice(3, 5), 16),
  b: Number.parseInt(hex.slice(5, 7), 16)
});

export const rgbToHex = ({ r, g, b }: RgbColor) => `#${[r, g, b]
  .map(channel => Math.round(channel).toString(16).padStart(2, '0'))
  .join('')}`;

export const SMART_PUNCT_RE = /[‘’‚‛“”„‟–—…]/;
export const hasCodeFence = (value: string) => /```/.test(value);
