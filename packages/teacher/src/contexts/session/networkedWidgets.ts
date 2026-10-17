import { WidgetType, type Widget } from '@shared/types';

// Widget types that own a server-side room
const NETWORKED_WIDGET_TYPES: readonly WidgetType[] = [
  WidgetType.POLL,
  WidgetType.QUESTIONS,
  WidgetType.RT_FEEDBACK,
  WidgetType.LINK_SHARE,
  WidgetType.HANDOUT,
  WidgetType.FILL_BLANK,
  WidgetType.CODE_FILL_BLANK,
  WidgetType.SORTING,
  WidgetType.SEQUENCING,
  WidgetType.MATCHING
];

export const networkedWidgetIds = (widgets: readonly Pick<Widget, 'id' | 'type'>[]): string[] => widgets
  .filter((w) => NETWORKED_WIDGET_TYPES.includes(w.type))
  .map((w) => w.id);
