import { useState, useRef, useEffect } from "react";
import * as React from "react";
import { v4 as uuidv4 } from 'uuid';
import { FaPlus } from 'react-icons/fa6';

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
  // Initialize items with stable IDs
  const [items, setItems] = useState<ListItem[]>(() => {
    if (savedState?.items) {
      return savedState.items;
    }
    // Convert legacy format to new format with IDs
    if (savedState?.inputs) {
      return savedState.inputs.map((text, index) => ({
        id: uuidv4(),
        text,
        status: savedState.statuses?.[index] || 0
      }));
    }
    return [{ id: uuidv4(), text: "", status: 0 }];
  });
  const [isLarge, setIsLarge] = useState(false);

  const inputRefs = useRef<HTMLInputElement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Notify parent of state changes
  const updateState = () => {
    if (onStateChange) {
      onStateChange({
        items: items,
        // Keep backward compatibility
        inputs: items.map(item => item.text),
        statuses: items.map(item => item.status)
      });
    }
  };

  // Update state whenever any value changes (skip initial render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    updateState();
  }, [items]);

  // Detect widget size
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        // Consider "large" when width is greater than 400px
        setIsLarge(width > 400);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleAddInput = () => {
    const newItem = { id: uuidv4(), text: "", status: 0 };
    setItems(prevItems => {
      const newItems = [...prevItems, newItem];
      setTimeout(() => {
        inputRefs.current[newItems.length - 1]?.focus(); // Focus the last added input after updating state
      }, 0);
      return newItems;
    });
  };

  const handleInputChange = (id: string, value: string) => {
    setItems(prevItems => 
      prevItems.map(item => 
        item.id === id ? { ...item, text: value } : item
      )
    );
  };

  const cycleStatus = (id: string) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, status: (item.status + 1) % 5 } : item
      )
    );
  };
  // useEffect(() => {
  //   const savedInputs =       JSON.parse(localStorage.getItem('inputs') || '[]');
  //   const savedCompleted =    JSON.parse(localStorage.getItem('completed') || '[]');
  //   const savedHideComplete = JSON.parse(localStorage.getItem('hideComplete') || 'false');
  //   const savedIsChecklist =  JSON.parse(localStorage.getItem('isChecklist') || 'true');

  //   setInputs(savedInputs);
  //   setCompleted(savedCompleted);
  //   setHideComplete(savedHideComplete);
  //   setIsChecklist(savedIsChecklist);
  // }, []);


  const handleDeleteInput = (id: string) => {
    setItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  const startEditing = (id: string) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, isEditing: true } : { ...item, isEditing: false }
      )
    );
  };

  const stopEditing = (id: string) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, isEditing: false } : item
      )
    );
  };


  // // LOCAL STORAGE
  // useEffect(() => {
  //   localStorage.setItem('title', localTitle);
  // }, [localTitle]);

  // useEffect(() => {
  //   localStorage.setItem('inputs', JSON.stringify(inputs));
  // }, [inputs]);

  // useEffect(() => {
  //   localStorage.setItem('completed', JSON.stringify(completed));
  // }, [completed]);

  // useEffect(() => {
  //   localStorage.setItem('hideComplete', JSON.stringify(hideComplete));
  // }, [hideComplete]);

  // useEffect(() => {
  //   localStorage.setItem('isChecklist', JSON.stringify(isChecklist));
  // }, [isChecklist]);

  return (
    <>
      <div ref={containerRef} className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          <div className="pt-0">
            <div className={`flex flex-col pt-0 ${isLarge ? "space-y-2" : "space-y-1"}`}>
              {items.map((item, index) => (
                  <div className="flex flex-row items-center gap-1" key={item.id}>
                    <button
                        onClick={() => cycleStatus(item.id)}
                        aria-label="Cycle status"
                        className={`rounded-full flex-shrink-0 transition-colors duration-200 ${
                          item.status === 1 ? "bg-green-500 hover:bg-green-600" :
                          item.status === 2 ? "bg-yellow-500 hover:bg-yellow-600" :
                          item.status === 3 ? "bg-red-500 hover:bg-red-600" :
                          item.status === 4 ? "bg-warm-gray-400 hover:bg-warm-gray-500" :
                          "bg-warm-gray-200 dark:bg-warm-gray-600 hover:bg-warm-gray-300 dark:hover:bg-warm-gray-500"
                        } ${
                          isLarge ? "w-12 h-12" : "w-8 h-8"
                        }`}
                      >
                      </button>
                    <div className="relative flex-1">
                      {item.isEditing ? (
                        <textarea
                          ref={(el) => {
                            if (el) {
                              inputRefs.current[index] = el as any;
                              el.focus();
                              // Place cursor at the end instead of selecting all
                              el.setSelectionRange(el.value.length, el.value.length);
                            }
                          }}
                          value={item.text}
                          onChange={(e) => handleInputChange(item.id, e.target.value)}
                          onBlur={() => stopEditing(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              stopEditing(item.id);
                            } else if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              stopEditing(item.id);
                              // If this is the last item and it has text, add a new item
                              if (index === items.length - 1 && item.text.trim()) {
                                handleAddInput();
                              }
                            }
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                          placeholder="Type away!"
                          className={`w-full px-3 pr-10 rounded placeholder-warm-gray-500 dark:placeholder-warm-gray-400 transition-colors duration-200 resize-none overflow-hidden ${
                            item.status === 1 ? "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/40 text-warm-gray-800 dark:text-warm-gray-200" :
                            item.status === 2 ? "bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/40 text-warm-gray-800 dark:text-warm-gray-200" :
                            item.status === 3 ? "bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/40 text-warm-gray-800 dark:text-warm-gray-200" :
                            item.status === 4 ? "bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 text-warm-gray-300 dark:text-warm-gray-500" :
                            "bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 text-warm-gray-800 dark:text-warm-gray-200"
                          } ${
                            isLarge ? "text-2xl py-3" : "text-sm py-2"
                          }`}
                          rows={1}
                          style={{
                            height: 'auto',
                            minHeight: isLarge ? '3rem' : '2rem'
                          }}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = target.scrollHeight + 'px';
                          }}
                          onFocus={(e) => {
                            // Ensure proper height on focus
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = target.scrollHeight + 'px';
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => startEditing(item.id)}
                          onMouseDown={(e) => e.stopPropagation()}
                          className={`w-full px-3 pr-10 rounded cursor-text break-words transition-colors duration-200 ${
                            item.status === 1 ? "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/40 text-warm-gray-800 dark:text-warm-gray-200" :
                            item.status === 2 ? "bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/40 text-warm-gray-800 dark:text-warm-gray-200" :
                            item.status === 3 ? "bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/40 text-warm-gray-800 dark:text-warm-gray-200" :
                            item.status === 4 ? "bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 text-warm-gray-300 dark:text-warm-gray-500" :
                            "bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 text-warm-gray-800 dark:text-warm-gray-200"
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
                        onClick={() => handleDeleteInput(item.id)}
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
