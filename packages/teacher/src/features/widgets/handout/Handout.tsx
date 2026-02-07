import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaFileLines, FaTrash, FaArrowUpRightFromSquare, FaPlus } from 'react-icons/fa6';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { useNetworkedWidgetState } from '../../session/hooks/useNetworkedWidgetState';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { widgetWrapper, widgetContainer } from '@shared/utils/styles';
import { NetworkedWidgetOverlays, NetworkedWidgetStats, WidgetControlBar, PlayPauseButton, ClearButton } from '../shared/components';
import { useSocketEvents } from '../../session/hooks/useSocketEvents';
import { withWidgetProvider, WidgetProps } from '../shared/withWidgetProvider';
import { getEmptyStateButtonText, getEmptyStateDisabled } from '../shared/utils/networkedWidgetHelpers';

interface HandoutItem {
  id: string;
  content: string;
  isLink: boolean;
  timestamp: number;
}

// Common file extensions to exclude from being treated as TLDs
const FILE_EXTENSIONS = ['txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'mp3', 'mp4', 'wav', 'avi', 'mov', 'zip', 'rar', 'tar', 'gz', 'json', 'xml', 'csv', 'html', 'css', 'js', 'ts', 'py', 'java', 'cpp', 'md', 'log'];

/**
 * Normalize a URL by adding https:// if it looks like a domain without protocol.
 */
const normalizeUrl = (text: string): string => {
  const trimmed = text.trim();

  // Already has a protocol
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Quick check: must contain a dot and start with alphanumeric
  if (!/^[a-zA-Z0-9]/.test(trimmed) || !trimmed.includes('.')) {
    return trimmed;
  }

  // Don't treat things that have spaces
  if (trimmed.includes(' ') || trimmed.length > 2000) {
    return trimmed;
  }

  // Try adding https:// and see if it's a valid URL
  const withProtocol = `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    // Check: hostname should have at least one dot and valid TLD-like ending
    if (url.hostname.includes('.') && /\.[a-zA-Z]{2,}$/.test(url.hostname)) {
      // Exclude common file extensions from being treated as domains
      const hostnameExt = url.hostname.split('.').pop()?.toLowerCase();
      if (hostnameExt && FILE_EXTENSIONS.includes(hostnameExt)) {
        return trimmed;
      }
      return withProtocol;
    }
  } catch {
    // Not a valid URL, return as-is
  }

  return trimmed;
};

function Handout({ widgetId, savedState, onStateChange }: WidgetProps) {
  // State
  const [items, setItems] = useState<HandoutItem[]>(savedState?.items || []);
  const [inputValue, setInputValue] = useState('');

  // Networked widget hook
  const {
    hasRoom,
    isStarting,
    error,
    handleStart,
    session,
    recoveryData
  } = useNetworkedWidget({
    widgetId,
    roomType: 'handout',
    savedState,
    onStateChange
  });

  // Active state management
  const { isActive: isWidgetActive, toggleActive } = useNetworkedWidgetState({
    widgetId,
    roomType: 'handout',
    hasRoom,
    recoveryData
  });

  // Socket event handlers
  const socketEvents = useMemo(() => ({
    'handout:itemAdded': (data: any) => {
      if (data.widgetId === widgetId) {
        const { widgetId: _, ...item } = data;
        setItems(prev => [...prev, item]);
      }
    },
    'handout:itemDeleted': (data: { itemId: string; widgetId?: string }) => {
      if (data.widgetId === widgetId) {
        setItems(prev => prev.filter(i => i.id !== data.itemId));
      }
    },
    'handout:stateUpdate': (data: { widgetId?: string; items?: HandoutItem[] }) => {
      if (data.widgetId === widgetId && data.items) {
        setItems(data.items);
      }
    }
  }), [widgetId]);

  // Use socket events hook for automatic event management
  const { emit } = useSocketEvents({
    events: socketEvents,
    isActive: hasRoom
  });

  // Actions
  const handleAddItem = useCallback(() => {
    if (!widgetId || !hasRoom || !inputValue.trim()) return;

    emit('session:handout:add', {
      sessionCode: session.sessionCode!,
      widgetId,
      content: inputValue.trim()
    });

    setInputValue('');
  }, [widgetId, hasRoom, inputValue, emit, session.sessionCode]);

  const handleDeleteItem = useCallback((itemId: string) => {
    if (!widgetId || !hasRoom) return;
    emit('session:handout:delete', {
      sessionCode: session.sessionCode!,
      widgetId,
      itemId
    });
  }, [widgetId, hasRoom, emit, session.sessionCode]);

  const handleClearAll = useCallback(() => {
    if (!widgetId) return;
    // Delete all items one by one
    items.forEach(item => {
      emit('session:handout:delete', {
        sessionCode: session.sessionCode!,
        widgetId,
        itemId: item.id
      });
    });
  }, [items, emit, session.sessionCode, widgetId]);

  const handleToggleActive = useCallback(() => {
    if (!hasRoom) return;
    toggleActive();
  }, [hasRoom, toggleActive]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddItem();
    }
  }, [handleAddItem]);

  // Save state
  useEffect(() => {
    onStateChange?.({ items });
  }, [items, onStateChange]);

  // Handle recovery data - restore items after page refresh
  useEffect(() => {
    if (recoveryData && recoveryData.roomData) {
      if (recoveryData.roomData.items && Array.isArray(recoveryData.roomData.items)) {
        setItems(recoveryData.roomData.items);
      }
    }
  }, [recoveryData]);

  // Empty state - show when no room exists
  if (!hasRoom) {
    return (
      <NetworkedWidgetEmpty
        icon={FaFileLines}
        title="Handout"
        description="Push text or links to students"
        buttonText={getEmptyStateButtonText({
          isStarting,
          isRecovering: session.isRecovering,
          isConnected: session.isConnected,
          defaultText: "Start Handout"
        })}
        onStart={handleStart}
        disabled={getEmptyStateDisabled({
          isStarting,
          isRecovering: session.isRecovering,
          isConnected: session.isConnected
        })}
        error={error || undefined}
      />
    );
  }

  // Active state
  return (
    <div className={widgetWrapper}>
      <div className={`${widgetContainer} relative`}>
        {/* Statistics */}
        <NetworkedWidgetStats label="Handout">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </NetworkedWidgetStats>

        {/* Overlays - outside scrollable area */}
        <NetworkedWidgetOverlays
          isActive={isWidgetActive}
          isConnected={session.isConnected}
          isRecovering={session.isRecovering}
          pausedMessage="Handout is paused"
        />

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4 pt-8 space-y-3">
          {/* Input area */}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter text or link..."
              disabled={!session.isConnected}
              className="flex-1 px-3 py-2 text-sm border border-warm-gray-300 dark:border-warm-gray-600 rounded-lg bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 placeholder-warm-gray-400 dark:placeholder-warm-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleAddItem}
              disabled={!session.isConnected || !inputValue.trim()}
              className="px-3 py-2 bg-slate-blue-500 hover:bg-slate-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Add item"
            >
              <FaPlus className="text-sm" />
            </button>
          </div>

          {/* Items list */}
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-warm-gray-400 dark:text-warm-gray-600">
              <FaFileLines className="text-4xl mb-2" />
              <p className="text-sm">No items yet. Add something above!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-warm-gray-700 rounded-lg p-3 shadow-sm border border-warm-gray-200 dark:border-warm-gray-600"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {item.isLink ? (
                        <a
                          href={item.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-slate-blue-600 hover:text-slate-blue-700 dark:text-slate-blue-400 dark:hover:text-slate-blue-300 break-all inline-flex items-center gap-1"
                        >
                          {item.content}
                          <FaArrowUpRightFromSquare className="text-[10px] flex-shrink-0" />
                        </a>
                      ) : (
                        <p className="text-sm text-warm-gray-700 dark:text-warm-gray-300 whitespace-pre-wrap break-words">
                          {item.content}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-warm-gray-400 hover:text-dusty-rose-600 dark:hover:text-dusty-rose-400 transition-colors p-1"
                      title="Delete item"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Control bar */}
      <WidgetControlBar>
        <div className="flex items-center gap-2">
          <PlayPauseButton
            isActive={isWidgetActive}
            onToggle={handleToggleActive}
            disabled={!session.isConnected}
            activeLabel="Pause handout"
            inactiveLabel="Resume handout"
          />

          {items.length > 0 && (
            <ClearButton
              onClear={handleClearAll}
              count={items.length}
              label="Clear all"
              disabled={!session.isConnected}
              variant="clear"
              requireConfirmation={true}
              confirmationMessage="Are you sure you want to clear all items?"
            />
          )}
        </div>
      </WidgetControlBar>
    </div>
  );
}

export default withWidgetProvider(Handout, 'Handout');
