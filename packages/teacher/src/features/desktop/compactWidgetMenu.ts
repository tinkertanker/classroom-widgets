import { WidgetType } from '@shared/types';
import type { WidgetConfig } from '@shared/types';
import type { CompactWidgetOption } from '@shared/types/compactPanel';

/**
 * Native menu order for compact widgets, most used first. Each inner list is
 * one separator-delimited group, and the shells' native Display item leads
 * the first group. Compact widgets not listed here follow in a final group in
 * registry order. The shells assign default launch shortcuts (1–9) in this
 * order.
 */
export const COMPACT_WIDGET_MENU_GROUPS: readonly (readonly WidgetType[])[] = [
  [WidgetType.TIMER, WidgetType.TEXT_BANNER],
  [WidgetType.TRAFFIC_LIGHT, WidgetType.TASK_CUE],
  [WidgetType.RANDOMISER, WidgetType.LIST]
];

export function compactWidgetMenuOptions(
  configs: readonly WidgetConfig[],
  groups: readonly (readonly WidgetType[])[] = COMPACT_WIDGET_MENU_GROUPS
): CompactWidgetOption[] {
  const compact = configs.filter((config) => config.compactPanel?.supported);
  const byType = new Map(compact.map((config) => [config.type, config]));
  const listed = new Set(groups.flat());
  const ordered = [
    ...groups.map((group) => group.flatMap((type) => byType.get(type) ?? [])),
    compact.filter((config) => !listed.has(config.type))
  ].filter((group) => group.length > 0);

  return ordered.flatMap((group, menuGroup) => group.map((config) => {
    const emoji = config.compactPanel?.menuEmoji;
    return { widgetType: config.type, title: config.name, menuGroup, ...(emoji ? { emoji } : {}) };
  }));
}
