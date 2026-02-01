import React, { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { FaFileLines, FaCopy, FaArrowUpRightFromSquare, FaCheck } from 'react-icons/fa6';
import { useWidgetStateChange } from '../hooks/useWidgetStateChange';

interface HandoutItem {
  id: string;
  content: string;
  isLink: boolean;
  timestamp: number;
}

interface HandoutActivityProps {
  socket: Socket;
  roomCode: string;
  isSession?: boolean;
  widgetId?: string;
  initialIsActive?: boolean;
  initialItems?: HandoutItem[];
}

const HandoutActivity: React.FC<HandoutActivityProps> = ({
  socket,
  roomCode,
  isSession = false,
  widgetId,
  initialIsActive = true,
  initialItems = []
}) => {
  const [items, setItems] = useState<HandoutItem[]>(initialItems);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Update isActive when prop changes
  useEffect(() => {
    setIsActive(initialIsActive);
  }, [initialIsActive]);

  // Update items when prop changes
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Listen for room state changes using shared hook
  useWidgetStateChange({
    socket,
    roomCode,
    roomType: 'handout',
    widgetId,
    initialIsActive,
    onStateChange: (newIsActive, data) => {
      setIsActive(newIsActive);
      // Update items if provided in the state update
      if (data?.items) {
        setItems(data.items);
      }
    }
  });

  // Listen for item added/deleted events
  useEffect(() => {
    const handleItemAdded = (data: HandoutItem & { widgetId?: string }) => {
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        const { widgetId: _, ...item } = data;
        setItems(prev => [...prev, item]);
      }
    };

    const handleItemDeleted = (data: { itemId: string; widgetId?: string }) => {
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        setItems(prev => prev.filter(i => i.id !== data.itemId));
      }
    };

    const handleStateUpdate = (data: { items?: HandoutItem[]; isActive?: boolean; widgetId?: string }) => {
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        if (data.items) {
          setItems(data.items);
        }
        if (data.isActive !== undefined) {
          setIsActive(data.isActive);
        }
      }
    };

    socket.on('handout:itemAdded', handleItemAdded);
    socket.on('handout:itemDeleted', handleItemDeleted);
    socket.on('handout:stateUpdate', handleStateUpdate);

    // Request current state
    setTimeout(() => {
      socket.emit('handout:requestState', { sessionCode: roomCode, widgetId });
    }, 100);

    return () => {
      socket.off('handout:itemAdded', handleItemAdded);
      socket.off('handout:itemDeleted', handleItemDeleted);
      socket.off('handout:stateUpdate', handleStateUpdate);
    };
  }, [socket, roomCode, widgetId]);

  // Copy to clipboard
  const handleCopy = useCallback(async (item: HandoutItem) => {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  return (
    <div className="relative">
      {!isActive ? (
        // Inactive state
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-warm-gray-600 mb-2">
              Handout Paused
            </h2>
            <p className="text-warm-gray-500 text-sm">
              Waiting for teacher to share content...
            </p>
          </div>
        </div>
      ) : (
        // Active state
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-warm-gray-400 dark:text-warm-gray-500">
              <FaFileLines className="text-3xl mb-2" />
              <p className="text-sm">Waiting for handouts...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-warm-gray-50 dark:bg-warm-gray-700/50 rounded-lg p-3 border border-warm-gray-200 dark:border-warm-gray-600"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {item.isLink ? (
                        <a
                          href={item.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-slate-blue-600 hover:text-slate-blue-700 dark:text-slate-blue-400 dark:hover:text-slate-blue-300 break-all"
                        >
                          {item.content}
                        </a>
                      ) : (
                        <p className="text-sm text-warm-gray-700 dark:text-warm-gray-300 whitespace-pre-wrap break-words">
                          {item.content}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleCopy(item)}
                        className={`p-1.5 rounded transition-colors ${
                          copiedId === item.id
                            ? 'bg-sage-100 dark:bg-sage-900/30 text-sage-600 dark:text-sage-400'
                            : 'text-warm-gray-400 hover:text-slate-blue-600 dark:hover:text-slate-blue-400 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600'
                        }`}
                        title={copiedId === item.id ? 'Copied!' : 'Copy to clipboard'}
                      >
                        {copiedId === item.id ? (
                          <FaCheck className="text-xs" />
                        ) : (
                          <FaCopy className="text-xs" />
                        )}
                      </button>
                      {item.isLink && (
                        <a
                          href={item.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded text-warm-gray-400 hover:text-slate-blue-600 dark:hover:text-slate-blue-400 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600 transition-colors"
                          title="Open link"
                        >
                          <FaArrowUpRightFromSquare className="text-xs" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HandoutActivity;
