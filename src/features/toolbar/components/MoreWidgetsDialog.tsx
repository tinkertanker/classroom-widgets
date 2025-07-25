// MoreWidgetsDialog - Dialog content for selecting widgets not in the toolbar

import React from 'react';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { WidgetType, WidgetCategory } from '../../../shared/types';
import { Button } from '../../../components/ui';

interface MoreWidgetsDialogProps {
  onClose: () => void;
  onSelectWidget: (type: WidgetType) => void;
}

const MoreWidgetsDialog: React.FC<MoreWidgetsDialogProps> = ({ onClose, onSelectWidget }) => {
  const categories = [
    { key: WidgetCategory.TEACHING_TOOLS, title: 'Teaching Tools' },
    { key: WidgetCategory.INTERACTIVE, title: 'Interactive' },
    { key: WidgetCategory.NETWORKED, title: 'Networked' },
    { key: WidgetCategory.FUN, title: 'Fun' }
  ];
  
  return (
    <div className="space-y-6">
      {categories.map(({ key, title }) => {
        const widgets = widgetRegistry.getByCategory(key);
        if (widgets.length === 0) return null;
        
        return (
          <div key={key}>
            <h3 className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-3">
              {title}
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {widgets.map((widget) => {
                const Icon = widget.icon;
                return (
                  <button
                    key={widget.type}
                    onClick={() => {
                      onSelectWidget(widget.type);
                      onClose();
                    }}
                    className="flex flex-col items-center p-4 bg-warm-gray-50 dark:bg-warm-gray-700 rounded-lg hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600 transition-colors"
                  >
                    <Icon className="text-2xl mb-2 text-warm-gray-600 dark:text-warm-gray-400" />
                    <span className="text-xs text-center text-warm-gray-700 dark:text-warm-gray-300">
                      {widget.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      
      <div className="flex justify-center mt-6">
        <Button
          variant="ghost"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default MoreWidgetsDialog;