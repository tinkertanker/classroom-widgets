import React from 'react';
import { WIDGET_TYPES } from '../../../shared/constants/widgetTypes';

interface CustomizeToolbarProps {
  selectedToolbarWidgets: number[];
  setSelectedToolbarWidgets: React.Dispatch<React.SetStateAction<number[]>>;
  AllComponentData: any;
  onSave?: () => void;
}

const CustomizeToolbar: React.FC<CustomizeToolbarProps> = ({
  selectedToolbarWidgets,
  setSelectedToolbarWidgets,
  AllComponentData,
  onSave
}) => {
  return (
    <div className="p-4 max-w-3xl">
      {onSave && (
        <div className="flex justify-end mb-3">
          <button
            onClick={onSave}
            className="px-3 py-1.5 text-sm bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-md transition-colors duration-200"
          >
            Save Changes
          </button>
        </div>
      )}
      
      <p className="text-sm text-warm-gray-600 dark:text-warm-gray-300 mb-3">
        Select widgets to appear in the toolbar. You can always access all widgets from the "More" button.
      </p>
      
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(WIDGET_TYPES).map(([key, widgetType]) => {
          const component = AllComponentData[widgetType];
          if (!component) return null;
          const Icon = component.icon;
          const isSelected = selectedToolbarWidgets.includes(widgetType);
          
          return (
            <button
              key={widgetType}
              onClick={() => {
                setSelectedToolbarWidgets(prev => {
                  if (prev.includes(widgetType)) {
                    // Remove widget
                    return prev.filter(id => id !== widgetType);
                  } else {
                    // Add widget - no limit
                    return [...prev, widgetType];
                  }
                });
              }}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all duration-200 ${
                isSelected 
                  ? 'bg-sage-100 border-2 border-sage-500' 
                  : 'bg-warm-gray-50 dark:bg-warm-gray-700 border-2 border-warm-gray-200 dark:border-warm-gray-600 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isSelected ? (
                  [WIDGET_TYPES.RANDOMISER, WIDGET_TYPES.TRAFFIC_LIGHT, WIDGET_TYPES.TEXT_BANNER].includes(widgetType) ? 'bg-dusty-rose-500' :
                  [WIDGET_TYPES.TIMER, WIDGET_TYPES.TASK_CUE, WIDGET_TYPES.IMAGE_DISPLAY].includes(widgetType) ? 'bg-terracotta-500' :
                  'bg-sage-600'
                ) : 'bg-warm-gray-300 dark:bg-warm-gray-600'
              }`}>
                {React.cloneElement(Icon, { className: `w-5 h-5 ${isSelected ? 'text-white' : 'text-warm-gray-600'}` })}
              </div>
              <span className={`text-xs ${isSelected ? 'text-sage-700 dark:text-sage-300 font-medium' : 'text-warm-gray-700 dark:text-warm-gray-200'}`}>
                {component.name}
              </span>
              {isSelected && (
                <div className="text-xs text-sage-600">
                  ✓ Selected
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CustomizeToolbar;