import type { MenuItemConstructorOptions } from 'electron';
import type { CompactWidgetOption } from './models';

export interface WidgetMenuActions {
  openDisplay: () => void;
  addWidget: (widgetType: number) => void;
  /** Display-only hint; global shortcuts are registered by WidgetShortcutController. */
  displayAccelerator?: string | null;
  widgetAccelerator?: (widgetType: number) => string | null;
}

/**
 * The widget section shared by the tray and panel add menus: Display, then the
 * teacher app's options in the order sent, with a separator wherever
 * `menuGroup` changes. Display leads the first group. It never starts or ends
 * with a separator.
 */
export function widgetMenuItems(options: readonly CompactWidgetOption[], actions: WidgetMenuActions): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [
    withAccelerator({ label: '🖥️  Display', click: () => actions.openDisplay() }, actions.displayAccelerator),
  ];
  if (options.length === 0) {
    items.push({ label: 'Loading widgets…', enabled: false });
    return items;
  }
  options.forEach((option, index) => {
    if (index > 0 && option.menuGroup !== options[index - 1].menuGroup) items.push({ type: 'separator' });
    items.push(withAccelerator({
      label: option.emoji ? `${option.emoji}  ${option.title}` : option.title,
      click: () => actions.addWidget(option.widgetType),
    }, actions.widgetAccelerator?.(option.widgetType)));
  });
  return items;
}

function withAccelerator(item: MenuItemConstructorOptions, accelerator: string | null | undefined): MenuItemConstructorOptions {
  return accelerator ? { ...item, accelerator, registerAccelerator: false } : item;
}
