import React from 'react';
import { WIDGET_TYPES } from '../../constants/widgetTypes';

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
    <div className="p-6 max-w-2xl">
      <p className="text-sm text-warm-gray-600 dark:text-warm-gray-300 mb-4">
        Select up to 5 widgets to appear in the toolbar. You can always access all widgets from the "More" button.
      </p>
      
      <div className="grid grid-cols-3 gap-3 mb-6">
        {Object.entries(WIDGET_TYPES).map(([key, widgetType]) => {
          const component = AllComponentData[widgetType];
          if (!component) return null;
          const Icon = component.icon;
          const isSelected = selectedToolbarWidgets.includes(widgetType);
          
          return (
            <button
              key={widgetType}
              onClick={() => {
                if (isSelected) {
                  setSelectedToolbarWidgets(prev => prev.filter(id => id !== widgetType));
                } else if (selectedToolbarWidgets.length < 5) {
                  setSelectedToolbarWidgets(prev => [...prev, widgetType]);
                }
              }}
              disabled={!isSelected && selectedToolbarWidgets.length >= 5}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-all duration-200 ${
                isSelected 
                  ? 'bg-sage-100 border-2 border-sage-500' 
                  : 'bg-warm-gray-50 dark:bg-warm-gray-700 border-2 border-warm-gray-200 dark:border-warm-gray-600 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600'
              } ${!isSelected && selectedToolbarWidgets.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isSelected ? (
                  [WIDGET_TYPES.RANDOMISER, WIDGET_TYPES.TRAFFIC_LIGHT, WIDGET_TYPES.TEXT_BANNER].includes(widgetType) ? 'bg-dusty-rose-500' :
                  [WIDGET_TYPES.TIMER, WIDGET_TYPES.WORK_SYMBOLS, WIDGET_TYPES.IMAGE_DISPLAY].includes(widgetType) ? 'bg-terracotta-500' :
                  'bg-sage-600'
                ) : 'bg-warm-gray-300 dark:bg-warm-gray-600'
              }`}>
                {React.createElement(Icon as any, { className: `w-6 h-6 ${isSelected ? 'text-white' : 'text-warm-gray-600'}` })}
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
      
      <div className="flex flex-wrap gap-2 pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
        <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400">Selected widgets ({selectedToolbarWidgets.length}/5):</span>
        {selectedToolbarWidgets.length === 0 ? (
          <span className="text-sm text-warm-gray-500 dark:text-warm-gray-500 italic">None selected</span>
        ) : (
          selectedToolbarWidgets.map(widgetType => {
            const component = AllComponentData[widgetType];
            return component ? (
              <span key={widgetType} className="text-sm bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300 px-2 py-1 rounded">
                {component.name}
              </span>
            ) : null;
          })
        )}
      </div>
      
      <div className="flex justify-between items-center pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
        <button
          onClick={() => {
            setSelectedToolbarWidgets([
              WIDGET_TYPES.RANDOMISER, 
              WIDGET_TYPES.TIMER, 
              WIDGET_TYPES.LIST, 
              WIDGET_TYPES.WORK_SYMBOLS, 
              WIDGET_TYPES.SOUND_MONITOR
            ]);
          }}
          className="px-4 py-2 text-sm bg-warm-gray-200 hover:bg-warm-gray-300 dark:bg-warm-gray-700 dark:hover:bg-warm-gray-600 text-warm-gray-700 dark:text-warm-gray-200 rounded-md transition-colors duration-200"
        >
          Reset to Default
        </button>
        {onSave && (
          <button
            onClick={onSave}
            className="px-4 py-2 text-sm bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-md transition-colors duration-200"
          >
            Save Changes
          </button>
        )}
      </div>
    </div>
  );
};

export default CustomizeToolbar;