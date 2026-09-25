import { describe, expect, it } from 'vitest';
import { WidgetType, type WidgetConfig } from '@shared/types';
import { compactWidgetMenuOptions } from './compactWidgetMenu';

const config = (type: WidgetType, name: string, compact: boolean, menuEmoji?: string) => ({
  type,
  name,
  compactPanel: { supported: compact, menuEmoji }
}) as unknown as WidgetConfig;

describe('compactWidgetMenuOptions', () => {
  it('appends unlisted compact widgets and never publishes an empty group', () => {
    const configs = [
      config(WidgetType.RANDOMISER, 'Randomiser', true),
      config(WidgetType.POLL, 'Poll', false),
      config(WidgetType.QRCODE, 'QR Code', true, '🔳'),
      config(WidgetType.TIMER, 'Timer', true, '⏱️'),
      config(WidgetType.LINK_SHORTENER, 'Link Shortener', false)
    ];

    expect(compactWidgetMenuOptions(configs, [
      [WidgetType.TIMER],
      [WidgetType.LINK_SHORTENER, WidgetType.POLL],
      [WidgetType.RANDOMISER]
    ])).toEqual([
      { widgetType: WidgetType.TIMER, title: 'Timer', menuGroup: 0, emoji: '⏱️' },
      { widgetType: WidgetType.RANDOMISER, title: 'Randomiser', menuGroup: 1 },
      { widgetType: WidgetType.QRCODE, title: 'QR Code', menuGroup: 2, emoji: '🔳' }
    ]);
  });
});
