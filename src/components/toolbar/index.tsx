// Refactored Toolbar component using the centralized store

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { FaPlus, FaBars, FaWifi } from 'react-icons/fa6';
import { useToolbar } from '../../hooks/useWorkspace';
import { useCreateWidget } from '../../hooks/useWidget';
import { useServerConnection } from '../../hooks/useWorkspace';
import { widgetRegistry } from '../../services/WidgetRegistry';
import { WidgetType } from '../../types';
import WidgetButton from './WidgetButton';
import ToolbarMenu from './ToolbarMenu';
import Clock from './Clock';
import MoreWidgetsDialog from './MoreWidgetsDialog';
import Button from '../ui/Button';

const Toolbar: React.FC = () => {
  const { visibleWidgets, showClock, showConnectionStatus } = useToolbar();
  const { connected } = useServerConnection();
  const createWidget = useCreateWidget();
  const [showMenu, setShowMenu] = useState(false);
  const [showMoreWidgets, setShowMoreWidgets] = useState(false);
  
  const handleAddWidget = (type: WidgetType) => {
    createWidget(type);
  };
  
  const visibleConfigs = visibleWidgets
    .map(type => widgetRegistry.get(type))
    .filter(Boolean);
  
  return (
    <>
      <div className="bg-soft-white dark:bg-warm-gray-800 border-b border-warm-gray-200 dark:border-warm-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Left side - Widget buttons */}
          <div className="flex items-center space-x-2">
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
              icon={<FaPlus />}
              onClick={() => setShowMoreWidgets(true)}
              className="opacity-80 hover:opacity-100"
              title="Add widgets"
            >
              More
            </Button>
          </div>
          
          {/* Right side - Clock, connection status, menu */}
          <div className="flex items-center space-x-3">
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
      
      {/* Menu dropdown */}
      {showMenu && (
        <ToolbarMenu onClose={() => setShowMenu(false)} />
      )}
      
      {/* More widgets dialog */}
      {showMoreWidgets && (
        <MoreWidgetsDialog
          onClose={() => setShowMoreWidgets(false)}
          onSelectWidget={handleAddWidget}
        />
      )}
    </>
  );
};

export default Toolbar;