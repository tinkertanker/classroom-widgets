// WidgetLaunchpad - Combined widget selector with search and categories

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { WidgetType, WidgetCategory } from '../../../shared/types';
import { FaWifi } from 'react-icons/fa6';
import { useServerConnection } from '../../../shared/hooks/useWorkspace';

interface WidgetLaunchpadProps {
  onClose: () => void;
  onSelectWidget: (type: WidgetType) => void;
}

const categoryTitles: Record<WidgetCategory, string> = {
  [WidgetCategory.TEACHING_TOOLS]: 'Teaching Tools',
  [WidgetCategory.INTERACTIVE]: 'Interactive',
  [WidgetCategory.NETWORKED]: 'Networked',
  [WidgetCategory.FUN]: 'Fun'
};

const WidgetLaunchpad: React.FC<WidgetLaunchpadProps> = ({ onClose, onSelectWidget }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<WidgetCategory | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { connected: serverConnected } = useServerConnection();
  
  // Auto-focus search input
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  
  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  // Filter widgets based on search and category
  const filteredWidgets = useMemo(() => {
    const allWidgets = widgetRegistry.getAll();
    
    return allWidgets.filter(widget => {
      // Category filter
      if (selectedCategory && widget.category !== selectedCategory) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = widget.name.toLowerCase();
        const category = widget.category?.toLowerCase() || '';
        
        return name.includes(query) || category.includes(query);
      }
      
      return true;
    });
  }, [searchQuery, selectedCategory]);
  
  // Group widgets by category
  const widgetsByCategory = useMemo(() => {
    const grouped = new Map<WidgetCategory, typeof filteredWidgets>();
    
    filteredWidgets.forEach(widget => {
      const category = widget.category || WidgetCategory.TEACHING_TOOLS;
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(widget);
    });
    
    return grouped;
  }, [filteredWidgets]);
  
  const handleWidgetClick = (type: WidgetType) => {
    onSelectWidget(type);
    onClose();
  };
  
  const isNetworkedWidget = (type: WidgetType) => {
    const widget = widgetRegistry.get(type);
    return widget?.category === WidgetCategory.NETWORKED;
  };
  
  return (
    <div className="flex flex-col h-[600px] max-h-[80vh] -mx-6 -my-4">
      {/* Header with search */}
      <div className="px-6 py-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
        {/* Search input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-warm-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search widgets..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-warm-gray-200 dark:border-warm-gray-600 
                     bg-white dark:bg-warm-gray-800 text-warm-gray-800 dark:text-warm-gray-200
                     focus:outline-none focus:border-sage-500 dark:focus:border-sage-400 focus:ring-2 focus:ring-sage-500/20
                     placeholder-warm-gray-400 dark:placeholder-warm-gray-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-warm-gray-400 hover:text-warm-gray-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Category filters */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              !selectedCategory
                ? 'bg-sage-500 text-white'
                : 'bg-warm-gray-100 dark:bg-warm-gray-700 text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600'
            }`}
          >
            All
          </button>
          {Object.entries(categoryTitles).map(([category, title]) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category as WidgetCategory)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedCategory === category
                  ? 'bg-sage-500 text-white'
                  : 'bg-warm-gray-100 dark:bg-warm-gray-700 text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600'
              }`}
            >
              {title}
            </button>
          ))}
        </div>
        
        {/* Server status warning */}
        {!serverConnected && (
          <div className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs">
            <FaWifi className="w-3 h-3" />
            <span>Some widgets require server connection</span>
          </div>
        )}
      </div>
      
      {/* Widget grid */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filteredWidgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-warm-gray-300 dark:text-warm-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-lg font-medium text-warm-gray-600 dark:text-warm-gray-400 mb-1">
              No widgets found
            </p>
            <p className="text-sm text-warm-gray-500">
              Try a different search term or category
            </p>
          </div>
        ) : selectedCategory ? (
          // Show widgets in selected category
          <div className="grid grid-cols-4 gap-3">
            {filteredWidgets.map((widget) => {
              const Icon = widget.icon;
              const isDisabled = isNetworkedWidget(widget.type) && !serverConnected;
              
              return (
                <button
                  key={widget.type}
                  onClick={() => !isDisabled && handleWidgetClick(widget.type)}
                  disabled={isDisabled}
                  className={`group relative flex flex-col items-center p-4 rounded-lg transition-all ${
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed bg-warm-gray-50 dark:bg-warm-gray-700'
                      : 'bg-warm-gray-50 dark:bg-warm-gray-700 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  {isNetworkedWidget(widget.type) && (
                    <div className={`absolute top-2 right-2 ${
                      serverConnected ? 'text-sage-500' : 'text-dusty-rose-500'
                    }`}>
                      <FaWifi className="w-3 h-3" />
                    </div>
                  )}
                  <Icon className="text-2xl mb-2 text-warm-gray-600 dark:text-warm-gray-400" />
                  <span className="text-xs text-center text-warm-gray-700 dark:text-warm-gray-300">
                    {widget.name}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          // Show widgets grouped by category
          <div className="space-y-6">
            {Array.from(widgetsByCategory.entries()).map(([category, widgets]) => (
              <div key={category}>
                <h3 className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-3">
                  {categoryTitles[category]}
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {widgets.map((widget) => {
                    const Icon = widget.icon;
                    const isDisabled = isNetworkedWidget(widget.type) && !serverConnected;
                    
                    return (
                      <button
                        key={widget.type}
                        onClick={() => !isDisabled && handleWidgetClick(widget.type)}
                        disabled={isDisabled}
                        className={`group relative flex flex-col items-center p-4 rounded-lg transition-all ${
                          isDisabled
                            ? 'opacity-50 cursor-not-allowed bg-warm-gray-50 dark:bg-warm-gray-700'
                            : 'bg-warm-gray-50 dark:bg-warm-gray-700 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600 hover:shadow-md hover:-translate-y-0.5'
                        }`}
                      >
                        {isNetworkedWidget(widget.type) && (
                          <div className={`absolute top-2 right-2 ${
                            serverConnected ? 'text-sage-500' : 'text-dusty-rose-500'
                          }`}>
                            <FaWifi className="w-3 h-3" />
                          </div>
                        )}
                        <Icon className="text-2xl mb-2 text-warm-gray-600 dark:text-warm-gray-400" />
                        <span className="text-xs text-center text-warm-gray-700 dark:text-warm-gray-300">
                          {widget.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WidgetLaunchpad;