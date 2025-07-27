import { useRef, useCallback } from "react";
import * as React from "react";
import { 
  FaPlus,
  FaBullseye,      // Focus/target icon for green state
  FaTriangleExclamation, // Warning icon for yellow state  
  FaBan,           // Ban/stop icon for red state
  FaCheck,         // Checkmark for completed/faded state
  FaClock          // Clock for waiting/neutral state
} from 'react-icons/fa6';
import {
  useListItems,
  useAutoResizeTextarea,
  useResponsiveSize,
  useListKeyboardHandlers
} from './hooks';

interface ListItem {
  id: string;
  text: string;
  status: number;
  isEditing?: boolean;
}

interface ListProps {
  savedState?: {
    inputs: string[];
    statuses: number[];
    items?: ListItem[];
  };
  onStateChange?: (state: any) => void;
}

const List: React.FC<ListProps> = ({ savedState, onStateChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<HTMLInputElement[]>([]);

  // List item management
  const {
    items,
    addItem,
    updateItemText,
    cycleItemStatus,
    deleteItem,
    startEditing,
    stopEditing
  } = useListItems({ savedState, onStateChange });

  // Responsive size detection
  const { isLarge } = useResponsiveSize({ containerRef });

  // Auto-resize textarea functionality
  const {
    handleInput,
    handleFocus,
    createTextareaRef
  } = useAutoResizeTextarea();

  // Add item with focus management
  const handleAddInput = useCallback(() => {
    addItem();
    setTimeout(() => {
      inputRefs.current[items.length]?.focus();
    }, 0);
  }, [addItem, items.length]);

  // Keyboard handlers
  const { handleKeyDown, handleMouseDown } = useListKeyboardHandlers({
    onStopEditing: stopEditing,
    onAddItem: handleAddInput,
    items
  });

  // Get status button styles
  const getStatusButtonStyles = (status: number) => {
    const baseStyles = "rounded-full flex-shrink-0 transition-colors duration-200 flex items-center justify-center";
    const sizeStyles = isLarge ? "w-12 h-12" : "w-8 h-8";
    
    const statusStyles = {
      1: "bg-green-500 hover:bg-green-600",
      2: "bg-yellow-500 hover:bg-yellow-600",
      3: "bg-red-500 hover:bg-red-600",
      4: "bg-warm-gray-400 hover:bg-warm-gray-500",
      0: "bg-warm-gray-200 dark:bg-warm-gray-600 hover:bg-warm-gray-300 dark:hover:bg-warm-gray-500"
    };
    
    return `${baseStyles} ${sizeStyles} ${statusStyles[status as keyof typeof statusStyles] || statusStyles[0]}`;
  };

  // Get item background styles
  const getItemBackgroundStyles = (status: number) => {
    const statusStyles = {
      1: "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/40 text-warm-gray-800 dark:text-warm-gray-200",
      2: "bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/40 text-warm-gray-800 dark:text-warm-gray-200",
      3: "bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/40 text-warm-gray-800 dark:text-warm-gray-200",
      4: "bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 text-warm-gray-300 dark:text-warm-gray-500",
      0: "bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 text-warm-gray-800 dark:text-warm-gray-200"
    };
    
    return statusStyles[status as keyof typeof statusStyles] || statusStyles[0];
  };

  return (
    <>
      <div ref={containerRef} className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          <div className="pt-0">
            <div className={`flex flex-col pt-0 ${isLarge ? "space-y-2" : "space-y-1"}`}>
              {items.map((item, index) => (
                  <div className="flex flex-row items-center gap-1" key={item.id}>
                    <button
                        onClick={() => cycleItemStatus(item.id)}
                        aria-label="Cycle status"
                        className={getStatusButtonStyles(item.status)}
                      >
                        {item.status === 1 && <FaBullseye className={`text-white ${isLarge ? "text-xl" : "text-sm"}`} />}
                        {item.status === 2 && <FaTriangleExclamation className={`text-white ${isLarge ? "text-xl" : "text-sm"}`} />}
                        {item.status === 3 && <FaBan className={`text-white ${isLarge ? "text-xl" : "text-sm"}`} />}
                        {item.status === 4 && <FaCheck className={`text-white ${isLarge ? "text-xl" : "text-sm"}`} />}
                        {item.status === 0 && <FaClock className={`text-warm-gray-600 dark:text-warm-gray-300 ${isLarge ? "text-lg" : "text-xs"}`} />}
                      </button>
                    <div className="relative flex-1">
                      {item.isEditing ? (
                        <textarea
                          ref={createTextareaRef(item.id, index)}
                          value={item.text}
                          onChange={(e) => updateItemText(item.id, e.target.value)}
                          onBlur={() => stopEditing(item.id)}
                          onKeyDown={(e) => handleKeyDown(e, item.id, index)}
                          onMouseDown={handleMouseDown}
                          placeholder="Type away!"
                          className={`w-full px-3 pr-10 rounded placeholder-warm-gray-500 dark:placeholder-warm-gray-400 transition-colors duration-200 resize-none overflow-hidden ${
                            getItemBackgroundStyles(item.status)
                          } ${
                            isLarge ? "text-2xl py-3" : "text-sm py-2"
                          }`}
                          rows={1}
                          style={{
                            height: 'auto',
                            minHeight: isLarge ? '3rem' : '2rem'
                          }}
                          onInput={handleInput}
                          onFocus={handleFocus}
                        />
                      ) : (
                        <div
                          onClick={() => startEditing(item.id)}
                          onMouseDown={handleMouseDown}
                          className={`w-full px-3 pr-10 rounded cursor-text break-words transition-colors duration-200 ${
                            getItemBackgroundStyles(item.status)
                          } ${
                            isLarge ? "text-2xl py-3 min-h-[3rem]" : "text-sm py-2 min-h-[2rem]"
                          }`}
                        >
                          {item.text || <span className="text-warm-gray-500 dark:text-warm-gray-400">Type away!</span>}
                        </div>
                      )}
                      <button
                        className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-dusty-rose-600 hover:text-white transition-colors duration-200 ${
                          item.status === 4 ? "text-warm-gray-300 dark:text-warm-gray-500" : "text-warm-gray-800 dark:text-warm-gray-200"
                        }`}
                        aria-label="Delete Task"
                        onClick={() => deleteItem(item.id)}
                        tabIndex={-1}
                      >
                        <svg className={isLarge ? "w-5 h-5" : "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-3 border-t border-warm-gray-200 dark:border-warm-gray-700 flex items-center">
          <button
            className={`px-3 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white rounded transition-colors duration-200 flex items-center gap-1.5 ${
              isLarge ? "text-base py-2" : "text-sm py-1.5"
            }`}
            onClick={handleAddInput}
          >
            <FaPlus className={isLarge ? "text-sm" : "text-xs"} />
            Add Item
          </button>
        </div>
      </div>
    </>
  );
};

export default List;