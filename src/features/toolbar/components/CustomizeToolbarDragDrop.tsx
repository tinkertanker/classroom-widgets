// CustomizeToolbarDragDrop - Interactive toolbar customization with drag and drop

import React, { useState, useRef } from 'react';
import { DndContext, DragEndEvent, DragOverlay, closestCenter, DragStartEvent, DragOverEvent, useSensor, useSensors, PointerSensor, useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove, AnimateLayoutChanges, defaultAnimateLayoutChanges } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { WidgetType } from '../../../shared/types';
import { useToolbar } from '../../../shared/hooks/useWorkspace';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { FaGripVertical } from 'react-icons/fa6';

interface CustomizeToolbarDragDropProps {
  onClose: () => void;
}

// Placeholder component for showing where widget will be dropped
const WidgetPlaceholder: React.FC = () => {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-lg border-2 border-sage-400 bg-sage-50/50 dark:bg-sage-900/20 opacity-60">
      <div className="w-[18px] h-[18px] bg-sage-300 dark:bg-sage-600 rounded" />
      <div className="w-12 h-2 bg-sage-300 dark:bg-sage-600 rounded" />
    </div>
  );
};

// Draggable widget item component
interface DraggableWidgetProps {
  widget: { type: WidgetType; name: string; icon: React.ComponentType<any> };
  isDragging?: boolean;
  isInToolbar?: boolean;
}

const DraggableWidget: React.FC<DraggableWidgetProps> = ({ widget, isDragging, isInToolbar }) => {
  const Icon = widget.icon;
  
  return (
    <div className={`flex flex-col items-center gap-1 p-3 rounded-lg bg-soft-white dark:bg-warm-gray-800 border-2 ${
      isInToolbar ? 'border-sage-500' : 'border-warm-gray-200 dark:border-warm-gray-600'
    } ${isDragging ? 'opacity-50' : ''} cursor-move`}>
      <Icon className="text-lg text-warm-gray-600 dark:text-warm-gray-400" />
      <span className="text-xs text-center text-warm-gray-700 dark:text-warm-gray-300">
        {widget.name}
      </span>
    </div>
  );
};

// Custom animate layout changes to always animate
const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args;
  
  if (isSorting || wasDragging) {
    return defaultAnimateLayoutChanges(args);
  }
  
  return true;
};

// Sortable widget for toolbar
const SortableWidget: React.FC<{ id: string; widget: any; isPlaceholder?: boolean }> = ({ id, widget, isPlaceholder }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    animateLayoutChanges,
    transition: {
      duration: 150, // milliseconds
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 150ms cubic-bezier(0.25, 1, 0.5, 1)',
  };

  const Icon = widget.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative transition-all duration-150 ease-out ${isDragging ? 'z-50' : ''}`}
    >
      {isPlaceholder ? (
        <div className="flex flex-col items-center gap-1 p-3 rounded-lg border-2 border-sage-400 bg-sage-50/50 dark:bg-sage-900/20 opacity-60">
          <Icon className="text-lg text-sage-500 dark:text-sage-400" />
          <span className="text-xs text-center text-sage-600 dark:text-sage-400">
            {widget.name}
          </span>
        </div>
      ) : (
        <DraggableWidget widget={widget} isDragging={isDragging} isInToolbar={true} />
      )}
    </div>
  );
};

// Available widget item
const AvailableWidget: React.FC<{ widget: any }> = ({ widget }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ 
    id: `available-${widget.type}`,
    data: { widget, source: 'available' }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <DraggableWidget widget={widget} isDragging={isDragging} />
    </div>
  );
};

const CustomizeToolbarDragDrop: React.FC<CustomizeToolbarDragDropProps> = ({ onClose }) => {
  const { visibleWidgets } = useToolbar();
  const updateToolbar = useWorkspaceStore((state) => state.updateToolbar);
  const allWidgets = widgetRegistry.getAll();
  
  // Initialize toolbar widgets in order
  const [toolbarWidgets, setToolbarWidgets] = useState<WidgetType[]>(visibleWidgets);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  
  // Set up droppable areas
  const { setNodeRef: setToolbarDropRef, isOver: isOverToolbar } = useDroppable({
    id: 'toolbar-dropzone'
  });
  
  const { setNodeRef: setAvailableDropRef, isOver: isOverAvailable } = useDroppable({
    id: 'available-dropzone'
  });
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
  // Get available widgets (not in toolbar)
  const availableWidgets = allWidgets.filter(w => !toolbarWidgets.includes(w.type));
  
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };
  
  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
  };
  
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;
    const overId = over?.id as string;
    
    setOverId(overId);
    
    // Only handle reordering of existing toolbar widgets
    if (!activeId.startsWith('available-') && toolbarWidgets.some(w => w.toString() === activeId) && over) {
      // Only reorder if over another toolbar widget
      if (toolbarWidgets.some(w => w.toString() === overId)) {
        const oldIndex = toolbarWidgets.findIndex(w => w.toString() === activeId);
        const newIndex = toolbarWidgets.findIndex(w => w.toString() === overId);
        
        if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
          setToolbarWidgets(arrayMove(toolbarWidgets, oldIndex, newIndex));
        }
      }
    }
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;
    
    // Handle dragging from available widgets
    if (activeId.startsWith('available-')) {
      const widgetType = parseInt(activeId.replace('available-', ''));
      
      // Only add if dropping on toolbar
      if (over && (over.id === 'toolbar-dropzone' || toolbarWidgets.some(w => w.toString() === over.id))) {
        let newToolbarWidgets = [...toolbarWidgets];
        
        if (over.id === 'toolbar-dropzone') {
          // Add to end
          newToolbarWidgets.push(widgetType);
        } else {
          // Insert at specific position
          const overIndex = toolbarWidgets.findIndex(w => w.toString() === over.id);
          if (overIndex >= 0) {
            newToolbarWidgets.splice(overIndex, 0, widgetType);
          } else {
            newToolbarWidgets.push(widgetType);
          }
        }
        
        setToolbarWidgets(newToolbarWidgets);
      }
    }
    // Handle dragging from toolbar
    else if (toolbarWidgets.some(w => w.toString() === activeId)) {
      // If no drop target, remove the widget
      if (!over) {
        const widgetType = parseInt(activeId);
        handleRemoveFromToolbar(widgetType);
      }
      // If dropping on available area, remove from toolbar
      else if (over.id === 'available-dropzone' || over.id.toString().startsWith('available-')) {
        const widgetType = parseInt(activeId);
        handleRemoveFromToolbar(widgetType);
      }
      // Otherwise, the reordering is already handled by handleDragOver
    }
    
    setActiveId(null);
    setOverId(null);
  };
  
  const handleRemoveFromToolbar = (widgetType: WidgetType) => {
    setToolbarWidgets(toolbarWidgets.filter(w => w !== widgetType));
  };
  
  const handleSave = () => {
    updateToolbar({ visibleWidgets: toolbarWidgets });
    onClose();
  };
  
  // Get the active widget for drag overlay
  const getActiveWidget = () => {
    if (!activeId) return null;
    
    if (activeId.startsWith('available-')) {
      const widgetType = parseInt(activeId.replace('available-', ''));
      return allWidgets.find(w => w.type === widgetType);
    } else {
      const widgetType = parseInt(activeId);
      return allWidgets.find(w => w.type === widgetType);
    }
  };
  
  const activeWidget = getActiveWidget();
  
  return (
    <div className="flex flex-col h-[600px] max-h-[80vh] bg-white dark:bg-warm-gray-800 rounded-lg">
      {/* Header with title and instructions */}
      <div className="px-6 py-4 border-b border-warm-gray-200 dark:border-warm-gray-700 bg-warm-gray-50 dark:bg-warm-gray-900 rounded-t-lg">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold text-warm-gray-800 dark:text-warm-gray-100">
            Customize Toolbar
          </h2>
          <button
            onClick={onClose}
            className="text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-warm-gray-600 dark:text-warm-gray-300">
          Drag widgets to add them to your toolbar, drag them out to remove, or rearrange by dragging within the toolbar.
        </p>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {/* Toolbar Preview */}
          <div className="mb-8">
            <h3 className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-3">
              Your Toolbar
            </h3>
            <div 
              ref={setToolbarDropRef}
              id="toolbar-dropzone"
              className={`rounded-lg p-4 min-h-[100px] border-2 border-dashed transition-all duration-200 ${
                activeId?.startsWith('available-') && isOverToolbar
                  ? 'border-sage-500 bg-sage-50 dark:bg-sage-900/20 shadow-inner' 
                  : activeId?.startsWith('available-')
                  ? 'border-sage-300 bg-sage-50/30 dark:bg-sage-900/10'
                  : 'border-warm-gray-300 dark:border-warm-gray-600 bg-warm-gray-100 dark:bg-warm-gray-900'
              }`}
            >
              {toolbarWidgets.length === 0 ? (
                <div className="text-center py-8 text-warm-gray-500">
                  Drag widgets here to add them to your toolbar
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <SortableContext
                    items={toolbarWidgets.map(w => w.toString())}
                    strategy={horizontalListSortingStrategy}
                  >
                    {toolbarWidgets.map((widgetType) => {
                      const widget = allWidgets.find(w => w.type === widgetType);
                      if (!widget) return null;
                      
                      // Show placeholder at insertion point when dragging from available
                      const showPlaceholder = activeId?.startsWith('available-') && 
                        overId === widgetType.toString() && 
                        isOverToolbar;
                      
                      return (
                        <React.Fragment key={widgetType}>
                          {showPlaceholder && (
                            <div className="flex flex-col items-center gap-1 p-3 rounded-lg border-2 border-dashed border-sage-400 bg-sage-50/50 dark:bg-sage-900/20 opacity-60 transition-all duration-150">
                              <div className="w-[18px] h-[18px] bg-sage-300 dark:bg-sage-600 rounded" />
                              <div className="w-12 h-2 bg-sage-300 dark:bg-sage-600 rounded" />
                            </div>
                          )}
                          <SortableWidget
                            id={widgetType.toString()}
                            widget={widget}
                            isPlaceholder={false}
                          />
                        </React.Fragment>
                      );
                    })}
                    {/* Show placeholder at end when dragging to empty area */}
                    {activeId?.startsWith('available-') && 
                     isOverToolbar && 
                     (overId === 'toolbar-dropzone' || !toolbarWidgets.some(w => w.toString() === overId)) && (
                      <div className="flex flex-col items-center gap-1 p-3 rounded-lg border-2 border-dashed border-sage-400 bg-sage-50/50 dark:bg-sage-900/20 opacity-60 transition-all duration-150">
                        <div className="w-[18px] h-[18px] bg-sage-300 dark:bg-sage-600 rounded" />
                        <div className="w-12 h-2 bg-sage-300 dark:bg-sage-600 rounded" />
                      </div>
                    )}
                  </SortableContext>
                </div>
              )}
            </div>
          </div>
          
          {/* Available Widgets */}
          <div>
            <h3 className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-3">
              Available Widgets
            </h3>
            <div 
              ref={setAvailableDropRef}
              id="available-dropzone" 
              className={`grid grid-cols-4 gap-3 min-h-[100px] p-2 rounded-lg transition-colors ${
                isOverAvailable && activeId && toolbarWidgets.some(w => w.toString() === activeId)
                  ? 'bg-dusty-rose-50 dark:bg-dusty-rose-900/20 border-2 border-dashed border-dusty-rose-300'
                  : ''
              }`}
            >
              <SortableContext
                items={availableWidgets.map(w => `available-${w.type}`)}
                strategy={horizontalListSortingStrategy}
              >
                {availableWidgets.map((widget) => (
                  <AvailableWidget
                    key={widget.type}
                    widget={widget}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
          
          {/* Drag Overlay */}
          <DragOverlay>
            {activeWidget ? (
              <DraggableWidget widget={activeWidget} isDragging={true} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      
      {/* Actions - Fixed at bottom */}
      <div className="flex justify-end gap-3 px-6 py-4 border-t border-warm-gray-200 dark:border-warm-gray-700 bg-warm-gray-50 dark:bg-warm-gray-900 rounded-b-lg">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-warm-gray-600 dark:text-warm-gray-300 hover:text-warm-gray-800 dark:hover:text-warm-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm bg-sage-500 hover:bg-sage-600 text-white rounded-md transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default CustomizeToolbarDragDrop;