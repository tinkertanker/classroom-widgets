// Refactored Toolbar component using the centralized store

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { FaBars, FaWifi, FaStamp } from 'react-icons/fa6';
import { useToolbar } from '../../../shared/hooks/useWorkspace';
import { useCreateWidget } from '../../../shared/hooks/useWidget';
import { useServerConnection } from '../../../shared/hooks/useWorkspace';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { WidgetType } from '../../../shared/types';
import WidgetButton from './WidgetButton';
import ToolbarMenu from './ToolbarMenu';
import Clock from './Clock';
import MoreWidgetsDialog from './MoreWidgetsDialog';
import Button from '../../../components/ui/Button';
import { useModal } from '../../../contexts/ModalContext';
import TrashZone from '../../board/components/TrashZone';
import StickerPalette from './StickerPalette';
import LaunchpadIcon from './LaunchpadIcon';

const Toolbar: React.FC = () => {
  const { visibleWidgets, showClock, showConnectionStatus } = useToolbar();
  const { connected } = useServerConnection();
  const createWidget = useCreateWidget();
  const { showModal, hideModal } = useModal();
  const [showMenu, setShowMenu] = useState(false);
  const [stickerMode, setStickerMode] = useState(false);
  const [selectedStickerType, setSelectedStickerType] = useState<string>('');
  
  const handleAddWidget = (type: WidgetType) => {
    createWidget(type);
  };
  
  const handleShowMoreWidgets = () => {
    showModal({
      title: 'Add Widget',
      content: (
        <MoreWidgetsDialog
          onClose={hideModal}
          onSelectWidget={(type) => {
            handleAddWidget(type);
            hideModal();
          }}
        />
      ),
      className: 'max-w-3xl'
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
      <div className="bg-soft-white dark:bg-warm-gray-800 border border-warm-gray-200 dark:border-warm-gray-700 rounded-full px-6 py-2 shadow-lg relative">
        <div className="flex items-center space-x-3">
          {/* Widget buttons */}
          {visibleConfigs.map((config) => (
            <WidgetButton
              key={config!.type}
              config={config!}
              onClick={() => handleAddWidget(config!.type)}
            />
          ))}
          
          {/* More button */}
          <Button
            variant="ghost"
            size="medium"
            icon={<LaunchpadIcon size={18} />}
            onClick={handleShowMoreWidgets}
            className="opacity-80 hover:opacity-100"
            title="Add widgets"
          >
            More
          </Button>
          
          {/* Divider */}
          <div className="w-px h-6 bg-warm-gray-300 dark:bg-warm-gray-600" />
          
          {/* Stickers button */}
          <Button
            variant="ghost"
            size="medium"
            icon={<FaStamp />}
            onClick={handleShowStickers}
            className="opacity-80 hover:opacity-100"
            title="Place stickers"
          >
            Stickers
          </Button>
          
          {/* Right side - Clock, connection status, menu */}
          <div className="flex items-center space-x-3 ml-auto">
            {showClock && <Clock />}
            
            {showConnectionStatus && (
              <div className={clsx(
                'transition-colors duration-200',
                connected ? 'text-sage-600' : 'text-warm-gray-400'
              )}>
                <FaWifi className="text-lg" />
              </div>
            )}
            
            <Button
              variant="ghost"
              size="medium"
              icon={<FaBars />}
              onClick={() => setShowMenu(!showMenu)}
              className="relative"
            />
          </div>
        </div>
      </div>
      
      {/* Trash Zone - positioned separately */}
      <TrashZone />
      
      {/* Menu dropdown */}
      {showMenu && (
        <ToolbarMenu onClose={() => setShowMenu(false)} />
      )}
    </>
  );
};

export default Toolbar;