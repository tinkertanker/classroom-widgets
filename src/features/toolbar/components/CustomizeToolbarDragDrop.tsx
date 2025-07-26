// CustomizeToolbarDragDrop - Interactive toolbar customization with drag and drop

import React, { useState, useRef } from 'react';
import { DndContext, DragEndEvent, DragOverlay, closestCenter, DragStartEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
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

// Sortable widget for toolbar
const SortableWidget: React.FC<{ id: string; widget: any }> = ({ id, widget }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = widget.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative ${isDragging ? 'z-50' : ''}`}
    >
      <DraggableWidget widget={widget} isDragging={isDragging} isInToolbar={true} />
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
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Handle dragging from available to toolbar
    if (activeId.startsWith('available-')) {
      const widgetType = parseInt(activeId.replace('available-', ''));
      
      // If dropping on toolbar area
      if (overId === 'toolbar-dropzone' || toolbarWidgets.some(w => w.toString() === overId)) {
        const newToolbarWidgets = [...toolbarWidgets];
        
        if (overId === 'toolbar-dropzone') {
          // Add to end
          newToolbarWidgets.push(widgetType);
        } else {
          // Insert at specific position
          const overIndex = toolbarWidgets.findIndex(w => w.toString() === overId);
          newToolbarWidgets.splice(overIndex, 0, widgetType);
        }
        
        setToolbarWidgets(newToolbarWidgets);
      }
    }
    // Handle reordering within toolbar
    else if (toolbarWidgets.some(w => w.toString() === activeId)) {
      const oldIndex = toolbarWidgets.findIndex(w => w.toString() === activeId);
      const newIndex = toolbarWidgets.findIndex(w => w.toString() === overId);
      
      if (oldIndex !== newIndex) {
        setToolbarWidgets(arrayMove(toolbarWidgets, oldIndex, newIndex));
      }
    }
    
    setActiveId(null);
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
    <div className="p-6 max-w-4xl">
      <p className="text-sm text-warm-gray-600 dark:text-warm-gray-300 mb-6">
        Drag widgets to add them to your toolbar, drag them out to remove, or rearrange by dragging within the toolbar.
      </p>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Toolbar Preview */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-3">
            Your Toolbar
          </h3>
          <div 
            id="toolbar-dropzone"
            className="bg-warm-gray-100 dark:bg-warm-gray-900 rounded-lg p-4 min-h-[100px] border-2 border-dashed border-warm-gray-300 dark:border-warm-gray-600"
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
                    
                    return (
                      <SortableWidget
                        key={widgetType}
                        id={widgetType.toString()}
                        widget={widget}
                      />
                    );
                  })}
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
          <div className="grid grid-cols-4 gap-3">
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
      
      {/* Actions */}
      <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
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