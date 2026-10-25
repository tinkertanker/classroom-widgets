import React, { useState, useEffect, useRef, useId } from 'react';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { WidgetType, WidgetCategory, WidgetConfig } from '@shared/types';
import { FaMagnifyingGlass, FaWifi, FaXmark } from 'react-icons/fa6';
import { useServerConnection } from '@shared/hooks/useWorkspace';
import './WidgetLaunchpad.css';

interface WidgetLaunchpadProps {
  onClose: () => void;
  onSelectWidget: (type: WidgetType) => void;
  compactOnly?: boolean;
  /** Native presentation utilities shown in the Present column. */
  extraItems?: LaunchpadExtraItem[];
}

export interface LaunchpadExtraItem {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}

const groupDescriptions = {
  'Run the class': 'Keep your lesson on track',
  Present: 'Share something on screen',
  'With students': 'Invite everyone to participate',
  Extras: 'Add a little variety'
};

// Chooser groups describe purpose, not capabilities. Keep the registry's
// categories intact: NETWORKED still controls connection requirements.
function groupFor(widget: WidgetConfig): keyof typeof groupDescriptions {
  if (widget.category === WidgetCategory.NETWORKED) return 'With students';
  if (widget.category === WidgetCategory.FUN) return 'Extras';
  if ([WidgetType.TEXT_BANNER, WidgetType.IMAGE_DISPLAY, WidgetType.QRCODE, WidgetType.LINK_SHORTENER].includes(widget.type)) {
    return 'Present';
  }
  return 'Run the class';
}

const WidgetLaunchpad: React.FC<WidgetLaunchpadProps> = ({
  onClose,
  onSelectWidget,
  compactOnly = false,
  extraItems = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const { connected: serverConnected } = useServerConnection();

  useEffect(() => {
    const timer = setTimeout(() => searchInputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const items = [
    ...widgetRegistry.getAll()
      .filter(widget => !widget.features?.hidden && (!compactOnly || widget.compactPanel?.supported))
      .map(widget => ({
        id: String(widget.type),
        name: widget.name,
        description: widget.description,
        icon: widget.icon,
        group: groupFor(widget),
        disabled: widget.category === WidgetCategory.NETWORKED && !serverConnected,
        onSelect: () => onSelectWidget(widget.type)
      })),
    ...extraItems.map(item => ({ ...item, group: 'Present' as const, disabled: false }))
  ];
  const query = searchQuery.trim().toLowerCase();
  const filteredItems = items.filter(item =>
    `${item.name} ${item.group}`.toLowerCase().includes(query)
  );
  const groups = (Object.keys(groupDescriptions) as (keyof typeof groupDescriptions)[])
    .map(title => ({ title, items: filteredItems.filter(item => item.group === title) }))
    .filter(group => group.items.length > 0);

  const selectItem = (item: typeof items[number]) => {
    if (item.disabled) return;
    item.onSelect();
    onClose();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && filteredItems.length === 1) {
      event.preventDefault();
      selectItem(filteredItems[0]);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      columnsRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    }
  };

  const handleItemKeyDown = (event: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const container = columnsRef.current!;
    const groups = Array.from(container.querySelectorAll('[role="group"]'))
      .map(column => Array.from(column.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')))
      .filter(column => column.length > 0);
    // Follow the rendered layout, including native window resizing and zoom,
    // without duplicating the CSS container-query breakpoints.
    const columns = getComputedStyle(container).display === 'grid' ? groups : [groups.flat()];
    const columnIndex = columns.findIndex(column => column.includes(event.target as HTMLButtonElement));
    if (columnIndex < 0) return;
    event.preventDefault();
    const column = columns[columnIndex];
    const row = column.indexOf(event.target as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    switch (event.key) {
      case 'ArrowDown': next = column[row + 1]; break;
      case 'ArrowUp':
        if (row === 0) searchInputRef.current?.focus();
        else next = column[row - 1];
        break;
      case 'Home': next = column[0]; break;
      case 'End': next = column[column.length - 1]; break;
      default: {
        const neighbor = columns[columnIndex + (event.key === 'ArrowRight' ? 1 : -1)];
        next = neighbor?.[Math.min(row, neighbor.length - 1)];
      }
    }
    next?.focus();
  };

  return (
    <div className={`widget-launchpad ${compactOnly ? 'widget-launchpad--compact' : ''}`}>
      <div className="shrink-0 px-4 py-4 sm:px-6">
        <div className="relative">
          <FaMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-warm-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            aria-label="Search widgets"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search all widgets…"
            className="widget-launchpad-search w-full rounded-lg border border-warm-gray-200 bg-transparent py-2 pl-10 pr-10 text-sm text-warm-gray-800 placeholder-warm-gray-400 focus:border-sage-500 focus:outline-none focus:ring-2 focus:ring-sage-500/20 dark:border-warm-gray-600 dark:text-warm-gray-100"
          />
          {searchQuery && (
            <button type="button" aria-label="Clear search" onClick={() => {
              setSearchQuery('');
              searchInputRef.current?.focus();
            }} className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-warm-gray-500 hover:text-warm-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sage-500 dark:hover:text-white">
              <FaXmark aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="widget-launchpad-columns" ref={columnsRef} onKeyDown={handleItemKeyDown}>
        {groups.map(({ title, items: groupItems }) => (
          <section className="widget-launchpad-column" key={title} aria-labelledby={`${id}-${title.replaceAll(' ', '-')}`}>
            <header className="widget-launchpad-heading">
              <h3 id={`${id}-${title.replaceAll(' ', '-')}`} className="flex items-center gap-2 text-sm font-semibold text-warm-gray-800 dark:text-warm-gray-100">
                {title}
                {title === 'With students' && <FaWifi aria-hidden="true" className="h-3 w-3 text-sage-600 dark:text-sage-400" />}
              </h3>
              <p className="mt-1 text-xs text-warm-gray-600 dark:text-warm-gray-400">{groupDescriptions[title]}</p>
            </header>
            <div className="widget-launchpad-list" role="group" aria-label={`${title} widgets`}>
              {groupItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-label={item.name}
                    aria-describedby={`${id}-description-${item.id}`}
                    disabled={item.disabled}
                    onClick={() => selectItem(item)}
                    onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}
                    className={`widget-launchpad-item ${filteredItems.length === 1 ? 'widget-launchpad-item--match' : ''}`}
                  >
                    <span aria-hidden="true" className="mt-0.5 shrink-0"><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0">
                      <span className="block text-xs font-medium leading-[18px]">{item.name}</span>
                      <span id={`${id}-description-${item.id}`} className="mt-0.5 block text-[11px] leading-[15px] text-warm-gray-600 dark:text-warm-gray-400">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <p className="font-medium text-warm-gray-700 dark:text-warm-gray-200">No widgets found</p>
            <p className="mt-2 text-sm text-warm-gray-500 dark:text-warm-gray-400">Try a different name or category.</p>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-warm-gray-100 px-4 py-3 text-[11px] text-warm-gray-500 dark:border-warm-gray-700 dark:text-warm-gray-400 sm:px-6">
        {!compactOnly && !serverConnected && (
          <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <FaWifi aria-hidden="true" className="shrink-0" />
            Connect to the server to use “With students” widgets.
          </span>
        )}
        <span>Click to add · Arrow keys to browse · Esc to close</span>
      </footer>
      <span className="sr-only" role="status">{filteredItems.length} {filteredItems.length === 1 ? 'widget' : 'widgets'} found</span>
    </div>
  );
};

export default WidgetLaunchpad;
