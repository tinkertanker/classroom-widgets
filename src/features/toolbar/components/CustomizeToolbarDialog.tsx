// CustomizeToolbarDialog - Dialog for customizing which widgets appear in the toolbar

import React, { useState } from 'react';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { WidgetType } from '../../../shared/types';
import { useToolbar } from '../../../shared/hooks/useWorkspace';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';

interface CustomizeToolbarDialogProps {
  onClose: () => void;
}

const CustomizeToolbarDialog: React.FC<CustomizeToolbarDialogProps> = ({ onClose }) => {
  const { visibleWidgets } = useToolbar();
  const toggleWidgetVisibility = useWorkspaceStore((state) => state.toggleWidgetVisibility);
  const [selectedWidgets, setSelectedWidgets] = useState<WidgetType[]>(visibleWidgets);
  
  const allWidgets = widgetRegistry.getAll();
  
  const handleToggle = (widgetType: WidgetType) => {
    setSelectedWidgets(prev => {
      if (prev.includes(widgetType)) {
        return prev.filter(type => type !== widgetType);
      } else {
        return [...prev, widgetType];
      }
    });
  };
  
  const handleSave = () => {
    // Update visibility for each widget
    allWidgets.forEach(widget => {
      const isCurrentlyVisible = visibleWidgets.includes(widget.type);
      const shouldBeVisible = selectedWidgets.includes(widget.type);
      
      if (isCurrentlyVisible !== shouldBeVisible) {
        toggleWidgetVisibility(widget.type);
      }
    });
    
    onClose();
  };
  
  return (
    <div className="p-6 max-w-3xl">
      <p className="text-sm text-warm-gray-600 dark:text-warm-gray-300 mb-4">
        Select which widgets appear in the toolbar. You can always access all widgets from the "More" button.
      </p>
      
      <div className="grid grid-cols-3 gap-3 mb-6">
        {allWidgets.map((widget) => {
          const Icon = widget.icon;
          const isSelected = selectedWidgets.includes(widget.type);
          
          return (
            <button
              key={widget.type}
              onClick={() => handleToggle(widget.type)}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-all duration-200 border-2 ${
                isSelected 
                  ? 'bg-sage-50 dark:bg-sage-900/20 border-sage-500 dark:border-sage-400' 
                  : 'bg-warm-gray-50 dark:bg-warm-gray-700 border-warm-gray-200 dark:border-warm-gray-600 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600'
              }`}
            >
              <Icon className={`text-2xl ${
                isSelected 
                  ? 'text-sage-600 dark:text-sage-400' 
                  : 'text-warm-gray-600 dark:text-warm-gray-400'
              }`} />
              <span className={`text-xs text-center ${
                isSelected 
                  ? 'text-sage-700 dark:text-sage-300 font-medium' 
                  : 'text-warm-gray-700 dark:text-warm-gray-300'
              }`}>
                {widget.name}
              </span>
              {isSelected && (
                <div className="text-xs text-sage-600 dark:text-sage-400">
                  ✓ In Toolbar
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      <div className="flex justify-end gap-3 pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
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

export default CustomizeToolbarDialog;