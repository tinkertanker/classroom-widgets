// Refactored Toolbar component using the centralized store

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { FaBars, FaStamp, FaBug } from 'react-icons/fa6';
import { useToolbar } from '../../../shared/hooks/useWorkspace';
import { useCreateWidget } from '../../../shared/hooks/useWidget';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { WidgetType } from '../../../shared/types';
import WidgetButton from './WidgetButton';
import ToolbarMenu from './ToolbarMenu';
import Clock from './Clock';
import WidgetLaunchpad from './WidgetLaunchpad';
import Button from '../../../components/ui/Button';
import { useModal } from '../../../contexts/ModalContext';
import TrashZone from '../../board/components/TrashZone';
import StickerPalette from './StickerPalette';
import LaunchpadIcon from './LaunchpadIcon';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';

const Toolbar: React.FC = () => {
  const { visibleWidgets, showClock } = useToolbar();
  const createWidget = useCreateWidget();
  const { showModal, hideModal } = useModal();
  const [showMenu, setShowMenu] = useState(false);
  const [stickerMode, setStickerMode] = useState(false);
  const [selectedStickerType, setSelectedStickerType] = useState<string>('');
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  // Sync with global sticker mode state
  useEffect(() => {
    const checkStickerMode = () => {
      const globalStickerMode = (window as any).getStickerMode?.();
      if (globalStickerMode !== undefined && globalStickerMode !== stickerMode) {
        setStickerMode(globalStickerMode);
      }
    };
    
    // Check periodically for state changes
    const interval = setInterval(checkStickerMode, 100);
    
    return () => clearInterval(interval);
  }, [stickerMode]);
  
  // Add keyboard shortcut for debug launch all
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd/Ctrl + Shift + D
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        handleDebugLaunchAll();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  const handleAddWidget = (type: WidgetType) => {
    createWidget(type);
  };
  
  const handleShowMoreWidgets = () => {
    showModal({
      title: 'Add Widget',
      content: (
        <WidgetLaunchpad
          onClose={hideModal}
          onSelectWidget={(type) => {
            handleAddWidget(type);
          }}
        />
      ),
      className: 'max-w-4xl bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl',
      noPadding: true
    });
  };
  
  const handleShowStickers = () => {
    showModal({
      title: 'Place Stickers',
      content: (
        <StickerPalette
          selectedStickerType={selectedStickerType}
          setSelectedStickerType={setSelectedStickerType}
          setStickerMode={(mode) => {
            setStickerMode(mode);
            // Always pass the current selectedStickerType to the global function
            (window as any).setStickerMode?.(mode, selectedStickerType);
          }}
          stickerMode={stickerMode}
          onClose={hideModal}
        />
      ),
      className: 'max-w-2xl bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl'
    });
  };
  
  // Debug function to launch all widgets
  const handleDebugLaunchAll = () => {
    const addWidget = useWorkspaceStore.getState().addWidget;
    const allWidgetTypes = widgetRegistry.getAll();
    
    // Grid configuration
    const MARGIN = 50; // Margin from edges
    const SPACING = 30; // Spacing between widgets
    const COLUMNS = 5; // Number of columns
    
    // Sort widgets by category for better organization
    const sortedWidgets = [...allWidgetTypes].sort((a, b) => {
      const categoryOrder = ['TEACHING_TOOLS', 'INTERACTIVE', 'FUN', 'NETWORKED'];
      const aIndex = categoryOrder.indexOf(a.category || '');
      const bIndex = categoryOrder.indexOf(b.category || '');
      return aIndex - bIndex;
    });
    
    // Track row heights for proper vertical spacing
    let currentY = MARGIN;
    let rowMaxHeight = 0;
    let currentRow = -1;
    
    // Calculate positions for all widgets
    sortedWidgets.forEach((config, index) => {
      const row = Math.floor(index / COLUMNS);
      const col = index % COLUMNS;
      
      // Get the widget's default size
      const size = config.defaultSize || { width: 350, height: 350 };
      
      // Start new row if needed
      if (row !== currentRow) {
        currentY += rowMaxHeight + SPACING;
        rowMaxHeight = 0;
        currentRow = row;
      }
      
      // Track max height in current row
      rowMaxHeight = Math.max(rowMaxHeight, size.height);
      
      // Calculate position
      const x = MARGIN + col * (Math.max(size.width, 350) + SPACING);
      const y = currentY;
      
      // Add the widget at the calculated position
      // Use setTimeout to ensure unique timestamps even with the improved ID generation
      setTimeout(() => {
        addWidget(config.type, { x, y });
      }, index * 10); // Small delay between each widget
    });
    
    // Calculate total area needed
    const totalWidth = MARGIN * 2 + COLUMNS * (350 + SPACING);
    const totalHeight = currentY + rowMaxHeight + MARGIN;
    
    // Show a notification
    showModal({
      title: 'Debug: All Widgets Launched',
      content: (
        <div className="p-4">
          <p className="text-warm-gray-700 dark:text-warm-gray-300">
            Launched {sortedWidgets.length} widgets in a grid layout.
          </p>
          <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mt-2">
            Widgets are arranged in {COLUMNS} columns with {SPACING}px spacing.
          </p>
          <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mt-1">
            Total area: {totalWidth} × {totalHeight} pixels
          </p>
          <div className="mt-3 text-xs text-warm-gray-500 dark:text-warm-gray-400">
            <p className="font-semibold">Widgets by category:</p>
            <ul className="mt-1 space-y-1">
              <li>• Teaching Tools: {sortedWidgets.filter(w => w.category === 'TEACHING_TOOLS').length}</li>
              <li>• Interactive: {sortedWidgets.filter(w => w.category === 'INTERACTIVE').length}</li>
              <li>• Fun: {sortedWidgets.filter(w => w.category === 'FUN').length}</li>
              <li>• Networked: {sortedWidgets.filter(w => w.category === 'NETWORKED').length}</li>
            </ul>
          </div>
        </div>
      ),
      className: 'max-w-md bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl'
    });
  };
  
  const visibleConfigs = visibleWidgets
    .map(type => widgetRegistry.get(type))
    .filter(Boolean);
  
  return (
    <>
      <div className="inline-flex flex-col space-y-4 px-4 pt-4 pb-2 bg-warm-white dark:bg-warm-gray-800 rounded-lg shadow-lg transition-colors duration-200">
        {/* Main widget buttons */}
        <div className="flex space-x-3 items-center justify-center">
          {/* Trash icon */}
          <TrashZone />
          
          {/* More widgets button */}
          <button
            onClick={handleShowMoreWidgets}
            className={clsx(
              'w-16 h-16 p-2 rounded-lg',
              'bg-gradient-to-br from-sage-50 to-sage-100',
              'dark:from-sage-900/20 dark:to-sage-800/30',
              'hover:from-sage-100 hover:to-sage-200',
              'dark:hover:from-sage-800/30 dark:hover:to-sage-700/40',
              'transition-all duration-300 transform hover:scale-110',
              'shadow-lg hover:shadow-xl',
              'flex flex-col items-center justify-center gap-1',
              'relative group',
              'border-2 border-sage-200 dark:border-sage-700',
              stickerMode ? 'opacity-50 cursor-not-allowed' : ''
            )}
            disabled={stickerMode}
            title="More widgets (⌘K)"
          >
            <div className="text-sage-700 dark:text-sage-300 group-hover:text-sage-800 dark:group-hover:text-sage-200 transition-colors duration-300">
              <LaunchpadIcon size={32} />
            </div>
            <span className="text-[10px] font-bold text-sage-700 dark:text-sage-300 group-hover:text-sage-800 dark:group-hover:text-sage-200 transition-colors duration-300">MORE</span>
            {/* Keyboard shortcut indicator */}
            <div className="absolute -bottom-1 -right-1 bg-sage-600 dark:bg-sage-500 text-white text-[9px] font-bold px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {isMac ? '⌘K' : 'Ctrl+K'}
            </div>
          </button>
          
          {/* Separator */}
          <div className="w-px h-8 bg-warm-gray-300 dark:bg-warm-gray-600" />
          
          {/* Widget buttons */}
          {visibleConfigs.map((config) => (
            <WidgetButton
              key={config!.type}
              config={config!}
              onClick={() => handleAddWidget(config!.type)}
              className={stickerMode ? 'opacity-50 cursor-not-allowed' : ''}
            />
          ))}
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Stickers button */}
          <button
            onClick={handleShowStickers}
            className={clsx(
              'px-3 py-2 rounded-lg transition-all duration-200',
              'flex flex-col items-center gap-1 min-w-[80px]',
              stickerMode
                ? 'bg-terracotta-500 text-white hover:bg-terracotta-600'
                : 'text-warm-gray-700 dark:text-warm-gray-300 bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600'
            )}
            title={stickerMode ? "Exit sticker mode" : "Enter sticker mode"}
          >
            <FaStamp className="text-lg" />
            <span className="text-xs text-center leading-tight">Stickers</span>
          </button>
          
          {/* Debug button */}
          <>
            <div className="w-px h-8 bg-warm-gray-300 dark:bg-warm-gray-600" />
            <button
              onClick={handleDebugLaunchAll}
              className={clsx(
                'px-3 py-2 rounded-lg transition-all duration-200',
                'flex flex-col items-center gap-1 min-w-[80px]',
                'text-warm-gray-700 dark:text-warm-gray-300',
                'bg-yellow-100 dark:bg-yellow-900/30',
                'hover:bg-yellow-200 dark:hover:bg-yellow-800/40',
                'border border-yellow-300 dark:border-yellow-700',
                'relative group'
              )}
              title="Debug: Launch all widgets in a grid (⌘⇧D)"
            >
              <FaBug className="text-lg text-yellow-600 dark:text-yellow-400" />
              <span className="text-xs text-center leading-tight">Debug All</span>
              {/* Keyboard shortcut indicator */}
              <div className="absolute -bottom-1 -right-1 bg-yellow-600 dark:bg-yellow-500 text-white text-[9px] font-bold px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {isMac ? '⌘⇧D' : 'Ctrl+Shift+D'}
              </div>
            </button>
          </>
          
          {/* Clock */}
          {showClock && (
            <div className="flex items-center px-4 py-2 bg-soft-white/80 dark:bg-warm-gray-800/80 rounded-lg shadow-sm">
              <Clock />
            </div>
          )}
          
          {/* Menu button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-3 rounded-lg text-warm-gray-700 bg-soft-white/80 dark:bg-warm-gray-800/80 dark:text-warm-gray-300 hover:bg-warm-gray-100/80 dark:hover:bg-warm-gray-700/80 transition-colors"
              title="Menu"
            >
              <FaBars className="w-5 h-5" />
            </button>
            
            {/* Menu dropdown */}
            {showMenu && (
              <ToolbarMenu onClose={() => setShowMenu(false)} />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Toolbar;