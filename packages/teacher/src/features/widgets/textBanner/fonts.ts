export type TextBannerFontFamily = 'sans' | 'serif' | 'slab' | 'mono';

export const FONT_FAMILY_STACK: Record<TextBannerFontFamily, string> = {
  sans: "'Poppins', system-ui, -apple-system, sans-serif",
  serif: "'Lora', Georgia, 'Times New Roman', serif",
  slab: "'Roboto Slab', Rockwell, 'Slabo 27px', serif",
  mono: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace"
};

export const FONT_FAMILY_LABEL: Record<TextBannerFontFamily, string> = {
  sans: 'Sans',
  serif: 'Serif',
  slab: 'Slab',
  mono: 'Mono'
};

export const FONT_FAMILY_ORDER: TextBannerFontFamily[] = ['sans', 'serif', 'slab', 'mono'];
