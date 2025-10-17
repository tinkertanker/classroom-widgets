import { useRef, useCallback } from "react";
import * as React from "react";
import {
  FaBullseye,
  FaTriangleExclamation,
  FaBan,
  FaCheck,
  FaClock,
  FaGripVertical
} from 'react-icons/fa6';
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useListItems,
  useAutoResizeTextarea,
  useResponsiveSize,
  useListKeyboardHandlers
} from './hooks';
import { cn, getStatusColor, transitions, widgetWrapper, buttons, text } from '../../../shared/utils/styles';
import { ListControlBar } from '../shared/components';

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

// Sortable item component
interface SortableItemProps {
  item: ListItem;
  isLarge: boolean;
  onCycleStatus: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onStartEditing: (id: string) => void;
  onStopEditing: (id: string) => void;
  onDelete: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string, index: number) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  handleInput: (e: React.FormEvent<HTMLTextAreaElement>) => void;
  handleFocus: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  createTextareaRef: (id: string, index: number) => (el: HTMLTextAreaElement) => void;
  index: number;
}

const SortableItem: React.FC<SortableItemProps> = ({
  item,
  isLarge,
  onCycleStatus,
  onUpdateText,
  onStartEditing,
  onStopEditing,
  onDelete,
  onKeyDown,
  onMouseDown,
  handleInput,
  handleFocus,
  createTextareaRef,
  index
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const statusIconSize = isLarge ? "text-xl" : "text-sm";
  const statusButtonSize = isLarge ? "w-12 h-12" : "w-8 h-8";

  return (
    <div ref={setNodeRef} style={style} className="flex flex-row items-center gap-1">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "no-drag cursor-grab active:cursor-grabbing",
          "text-warm-gray-400 hover:text-warm-gray-600 dark:text-warm-gray-500 dark:hover:text-warm-gray-300",
          transitions.colors,
          item.isEditing && 'opacity-50 pointer-events-none'
        )}
      >
        <FaGripVertical className={isLarge ? "text-lg" : "text-sm"} />
      </div>
      
      <button
        onClick={() => onCycleStatus(item.id)}
        aria-label="Cycle status"
        className={cn(
          "rounded-full flex-shrink-0 flex items-center justify-center",
          statusButtonSize,
          getStatusColor(item.status, 'bg'),
          transitions.colors
        )}
      >
        {item.status === 1 && <FaBullseye className={cn("text-white", statusIconSize)} />}
        {item.status === 2 && <FaTriangleExclamation className={cn("text-white", statusIconSize)} />}
        {item.status === 3 && <FaBan className={cn("text-white", statusIconSize)} />}
        {item.status === 4 && <FaCheck className={cn("text-white", statusIconSize)} />}
        {item.status === 0 && <FaClock className={cn(text.secondary, isLarge ? "text-lg" : "text-xs")} />}
      </button>
      <div className="relative flex-1">
        {item.isEditing ? (
          <textarea
            ref={createTextareaRef(item.id, index)}
            value={item.text}
            onChange={(e) => onUpdateText(item.id, e.target.value)}
            onBlur={() => onStopEditing(item.id)}
            onKeyDown={(e) => onKeyDown(e, item.id, index)}
            onMouseDown={onMouseDown}
            placeholder="Type away!"
            className={cn(
              "w-full px-3 pr-10 rounded resize-none overflow-hidden",
              text.primary,
              text.placeholder,
              transitions.colors,
              getStatusColor(item.status, 'surface'),
              isLarge ? "text-2xl py-3" : "text-sm py-2"
            )}
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
            onClick={() => onStartEditing(item.id)}
            onMouseDown={onMouseDown}
            className={cn(
              "w-full px-3 pr-10 rounded cursor-text break-words",
              transitions.colors,
              getStatusColor(item.status, 'surface'),
              text.primary,
              isLarge ? "text-2xl py-3 min-h-[3rem]" : "text-sm py-2 min-h-[2rem]"
            )}
          >
            {item.text || <span className="text-warm-gray-500 dark:text-warm-gray-400">Type away!</span>}
          </div>
        )}
        <button
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded",
            "hover:bg-dusty-rose-600 hover:text-white",
            transitions.colors,
            item.status === 4 ? "text-warm-gray-300 dark:text-warm-gray-500" : text.primary
          )}
          aria-label="Delete Task"
          onClick={() => onDelete(item.id)}
          tabIndex={-1}
        >
          <svg className={isLarge ? "w-5 h-5" : "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

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
    stopEditing,
    reorderItems
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

  // Configure drag sensors with activation constraint
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    })
  );

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderItems(oldIndex, newIndex);
      }
    }
  };

  return (
    <>
      <div ref={containerRef} className={widgetWrapper}>
        <div className="bg-soft-white/90 dark:bg-warm-gray-800/90 rounded-t-lg flex-1 overflow-y-auto px-4 pt-4">
          <div className="pt-0">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={`flex flex-col pt-0 ${isLarge ? "space-y-2" : "space-y-1"}`}>
                  {items.map((item, index) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      index={index}
                      isLarge={isLarge}
                      onCycleStatus={cycleItemStatus}
                      onUpdateText={updateItemText}
                      onStartEditing={startEditing}
                      onStopEditing={stopEditing}
                      onDelete={deleteItem}
                      onKeyDown={handleKeyDown}
                      onMouseDown={handleMouseDown}
                      handleInput={handleInput}
                      handleFocus={handleFocus}
                      createTextareaRef={createTextareaRef}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
        <ListControlBar
          onAddItem={handleAddInput}
          isLarge={isLarge}
        />
      </div>
    </>
  );
};

export default List;