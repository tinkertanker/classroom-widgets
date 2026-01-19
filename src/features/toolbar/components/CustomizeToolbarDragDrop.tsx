// CustomizeToolbarDragDrop - Simple drag and drop toolbar customization

import React, { useState } from 'react';
import { DndContext, DragEndEvent, closestCenter, DragStartEvent, useDroppable, DragOverlay, rectIntersection } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { WidgetType } from '../../../shared/types';
import { useToolbar } from '../../../shared/hooks/useWorkspace';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import ModalDialog from '../../../shared/components/ModalDialog';
import { FaTrash, FaPlus } from 'react-icons/fa6';

interface CustomizeToolbarDragDropProps {
  onClose: () => void;
}

// Drop zone component
interface DropZoneProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ id, label, icon, isActive }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div
      ref={setNodeRef}
      className={`relative w-full min-h-[60px] flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed transition-all ${
        isActive && isOver
          ? 'border-sage-600 bg-sage-100 dark:bg-sage-900/40 scale-[1.02] shadow-lg'
          : isActive
          ? 'border-sage-400 bg-sage-50 dark:bg-sage-900/20'
          : 'border-warm-gray-300 dark:border-warm-gray-600 bg-warm-gray-100 dark:bg-warm-gray-800/50 hover:border-warm-gray-400'
      }`}
      style={{ minHeight: '60px' }}
    >
      <div className="flex items-center gap-2 pointer-events-none select-none">
        <div className={isActive && isOver ? 'animate-pulse' : ''}>
          {icon}
        </div>
        <span className={`text-sm ${
          isActive && isOver 
            ? 'text-sage-700 dark:text-sage-300 font-medium' 
            : 'text-warm-gray-600 dark:text-warm-gray-400'
        }`}>
          {label}
        </span>
      </div>
    </div>
  );
};

// Sortable widget component
interface SortableWidgetProps {
  id: string;
  widget: { type: WidgetType; name: string; icon: React.ComponentType<any> };
}

const SortableWidget: React.FC<SortableWidgetProps> = ({ id, widget }) => {
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
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = widget.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex flex-col items-center gap-1 p-3 rounded-lg bg-soft-white dark:bg-warm-gray-800 border-2 border-warm-gray-200 dark:border-warm-gray-600 cursor-move hover:border-sage-400 transition-colors"
    >
      <Icon className="text-lg text-warm-gray-600 dark:text-warm-gray-400" />
      <span className="text-xs text-center text-warm-gray-700 dark:text-warm-gray-300">
        {widget.name}
      </span>
    </div>
  );
};

const CustomizeToolbarDragDrop: React.FC<CustomizeToolbarDragDropProps> = ({ onClose }) => {
  const { visibleWidgets } = useToolbar();
  const updateToolbar = useWorkspaceStore((state) => state.updateToolbar);
  const allWidgets = widgetRegistry.getAll().filter(w => !w.features?.hidden);

  // Initialize state
  const [toolbarWidgets, setToolbarWidgets] = useState<WidgetType[]>(
    visibleWidgets.filter(type => allWidgets.some(w => w.type === type))
  );
  const [availableWidgets, setAvailableWidgets] = useState<WidgetType[]>(
    allWidgets.filter(w => !visibleWidgets.includes(w.type)).map(w => w.type)
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeContainer, setActiveContainer] = useState<string | null>(null);
  
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    // Determine which container the drag started from
    const widgetType = parseInt(event.active.id as string);
    if (toolbarWidgets.includes(widgetType)) {
      setActiveContainer('toolbar');
    } else if (availableWidgets.includes(widgetType)) {
      setActiveContainer('available');
    }
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setActiveContainer(null);
      return;
    }
    
    const activeWidgetType = parseInt(active.id as string);
    
    // Handle drops on remove zone (from toolbar)
    if (over.id === 'remove-zone' && activeContainer === 'toolbar') {
      setToolbarWidgets(prev => prev.filter(w => w !== activeWidgetType));
      setAvailableWidgets(prev => [...prev, activeWidgetType]);
    }
    // Handle drops on add zone (from available)
    else if (over.id === 'add-zone' && activeContainer === 'available') {
      setAvailableWidgets(prev => prev.filter(w => w !== activeWidgetType));
      setToolbarWidgets(prev => [...prev, activeWidgetType]);
    }
    // Handle reordering within toolbar
    else if (activeContainer === 'toolbar' && toolbarWidgets.includes(parseInt(over.id as string))) {
      const oldIndex = toolbarWidgets.indexOf(activeWidgetType);
      const newIndex = toolbarWidgets.indexOf(parseInt(over.id as string));
      
      if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
        setToolbarWidgets(arrayMove(toolbarWidgets, oldIndex, newIndex));
      }
    }
    // Handle reordering within available
    else if (activeContainer === 'available' && availableWidgets.includes(parseInt(over.id as string))) {
      const oldIndex = availableWidgets.indexOf(activeWidgetType);
      const newIndex = availableWidgets.indexOf(parseInt(over.id as string));
      
      if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
        setAvailableWidgets(arrayMove(availableWidgets, oldIndex, newIndex));
      }
    }
    
    setActiveId(null);
    setActiveContainer(null);
  };
  
  const handleSave = () => {
    updateToolbar({ visibleWidgets: toolbarWidgets });
    onClose();
  };
  
  const footerContent = (
    <div className="flex justify-end gap-3">
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
  );
  
  // Get the active widget for drag overlay
  const getActiveWidget = () => {
    if (!activeId) return null;
    const widgetType = parseInt(activeId);
    return allWidgets.find(w => w.type === widgetType);
  };
  
  const activeWidget = getActiveWidget();
  
  return (
    <ModalDialog
      title="Customize Toolbar"
      subtitle={
        <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
          Drag widgets to the drop zones to move them between sections
        </p>
      }
      onClose={onClose}
      footer={footerContent}
      contentClassName="px-6 py-4"
    >
      <DndContext
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Toolbar Section */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-3">
            Your Toolbar
          </h3>
          <div className="space-y-3">
            <div className="rounded-lg border-2 border-dashed border-warm-gray-300 dark:border-warm-gray-600 bg-warm-gray-100 dark:bg-warm-gray-900 p-4 min-h-[100px]">
              <SortableContext
                id="toolbar"
                items={toolbarWidgets.map(w => w.toString())}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  {toolbarWidgets.length === 0 ? (
                    <p className="text-warm-gray-500 text-sm w-full text-center py-4">
                      No widgets in toolbar. Drag from available widgets below.
                    </p>
                  ) : (
                    toolbarWidgets.map((widgetType) => {
                      const widget = allWidgets.find(w => w.type === widgetType);
                      if (!widget) return null;
                      
                      return (
                        <SortableWidget
                          key={widgetType}
                          id={widgetType.toString()}
                          widget={widget}
                        />
                      );
                    })
                  )}
                </div>
              </SortableContext>
            </div>
            {/* Remove drop zone */}
            {toolbarWidgets.length > 0 && (
              <DropZone
                id="remove-zone"
                label="Drag here to remove from toolbar"
                icon={<FaTrash className="text-dusty-rose-500" />}
                isActive={activeId !== null && activeContainer === 'toolbar'}
              />
            )}
          </div>
        </div>
        
        {/* Available Widgets Section */}
        <div>
          <h3 className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-3">
            Available Widgets
          </h3>
          <div className="space-y-3">
            {/* Add drop zone */}
            {availableWidgets.length > 0 && (
              <DropZone
                id="add-zone"
                label="Drag here to add to toolbar"
                icon={<FaPlus className="text-sage-500" />}
                isActive={activeId !== null && activeContainer === 'available'}
              />
            )}
            <div className="rounded-lg border-2 border-dashed border-warm-gray-300 dark:border-warm-gray-600 bg-warm-gray-100 dark:bg-warm-gray-900 p-4 min-h-[100px]">
              <SortableContext
                id="available"
                items={availableWidgets.map(w => w.toString())}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  {availableWidgets.length === 0 ? (
                    <p className="text-warm-gray-500 text-sm w-full text-center py-4">
                      All widgets are in your toolbar
                    </p>
                  ) : (
                    availableWidgets.map((widgetType) => {
                      const widget = allWidgets.find(w => w.type === widgetType);
                      if (!widget) return null;
                      
                      return (
                        <SortableWidget
                          key={widgetType}
                          id={widgetType.toString()}
                          widget={widget}
                        />
                      );
                    })
                  )}
                </div>
              </SortableContext>
            </div>
          </div>
        </div>
        
        {/* Drag Overlay */}
        <DragOverlay>
          {activeWidget ? (
            <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-soft-white dark:bg-warm-gray-800 border-2 border-sage-500 shadow-lg cursor-move">
              <activeWidget.icon className="text-lg text-warm-gray-600 dark:text-warm-gray-400" />
              <span className="text-xs text-center text-warm-gray-700 dark:text-warm-gray-300">
                {activeWidget.name}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </ModalDialog>
  );
};

export default CustomizeToolbarDragDrop;