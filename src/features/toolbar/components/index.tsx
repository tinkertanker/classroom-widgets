// Refactored Toolbar component using the centralized store

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { FaBars, FaStamp } from 'react-icons/fa6';
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

const Toolbar: React.FC = () => {
  const { visibleWidgets, showClock } = useToolbar();
  const createWidget = useCreateWidget();
  const { showModal, hideModal } = useModal();
  const [showMenu, setShowMenu] = useState(false);
  const [stickerMode, setStickerMode] = useState(false);
  const [selectedStickerType, setSelectedStickerType] = useState<string>('');
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
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
            if (mode && selectedStickerType) {
              (window as any).setStickerMode?.(mode, selectedStickerType);
            } else {
              (window as any).setStickerMode?.(mode);
            }
          }}
          stickerMode={stickerMode}
          onClose={hideModal}
        />
      ),
      className: 'max-w-2xl'
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
                : 'text-warm-gray-700 bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600'
            )}
            title={stickerMode ? "Exit sticker mode" : "Enter sticker mode"}
          >
            <FaStamp className="text-lg" />
            <span className="text-xs text-center leading-tight">Stickers</span>
          </button>
          
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