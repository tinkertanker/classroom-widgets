// ToolbarMenu - Dropdown menu for toolbar settings

import React, { useRef, useEffect } from 'react';
import { 
  FaRotateLeft, 
  FaPalette, 
  FaWrench, 
  FaMoon, 
  FaSun,
  FaCircle,
  FaShapes,
  FaBrush,
  FaGripLines,
  FaBorderNone,
  FaMountain,
  FaWater
} from 'react-icons/fa6';
import { useWorkspace, useTheme } from '../../../shared/hooks/useWorkspace';
import { useWidgets } from '../../../shared/hooks/useWidget';
import { BackgroundType } from '../../../shared/types';

interface ToolbarMenuProps {
  onClose: () => void;
}

const ToolbarMenu: React.FC<ToolbarMenuProps> = ({ onClose }) => {
  const { setBackground } = useWorkspace();
  const { theme, toggleTheme } = useTheme();
  const { removeAll } = useWidgets();
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);
  
  const handleReset = () => {
    if (window.confirm('Are you sure you want to clear all widgets?')) {
      removeAll();
      onClose();
    }
  };
  
  const handleBackgroundChange = (type: BackgroundType) => {
    setBackground(type);
    onClose();
  };
  
  const handleCustomize = () => {
    // TODO: Open toolbar customization dialog
    console.log('Customize toolbar');
    onClose();
  };
  
  return (
    <div
      ref={menuRef}
      className="absolute right-4 bottom-16 bg-white dark:bg-warm-gray-800 rounded-lg shadow-xl border border-warm-gray-200 dark:border-warm-gray-700 py-2 z-50 min-w-[200px]"
    >
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="w-full flex items-center px-4 py-2 text-sm text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
      >
        {theme === 'light' ? <FaMoon className="mr-3" /> : <FaSun className="mr-3" />}
        {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
      </button>
      
      <div className="h-px bg-warm-gray-200 dark:bg-warm-gray-700 my-1" />
      
      {/* Background Options */}
      <div className="px-4 py-1 text-xs font-medium text-warm-gray-500 dark:text-warm-gray-400">
        Background
      </div>
      
      <button
        onClick={() => handleBackgroundChange(BackgroundType.NONE)}
        className="w-full flex items-center px-4 py-2 text-sm text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
      >
        <FaBorderNone className="mr-3" />
        None
      </button>
      
      <button
        onClick={() => handleBackgroundChange(BackgroundType.GEOMETRIC)}
        className="w-full flex items-center px-4 py-2 text-sm text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
      >
        <FaShapes className="mr-3" />
        Geometric
      </button>
      
      <button
        onClick={() => handleBackgroundChange(BackgroundType.GRADIENT)}
        className="w-full flex items-center px-4 py-2 text-sm text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
      >
        <FaBrush className="mr-3" />
        Gradient
      </button>
      
      <button
        onClick={() => handleBackgroundChange(BackgroundType.LINES)}
        className="w-full flex items-center px-4 py-2 text-sm text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
      >
        <FaGripLines className="mr-3" />
        Lines
      </button>
      
      <button
        onClick={() => handleBackgroundChange(BackgroundType.DOTS)}
        className="w-full flex items-center px-4 py-2 text-sm text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
      >
        <FaCircle className="mr-3" />
        Dots
      </button>
      
      <button
        onClick={() => handleBackgroundChange(BackgroundType.LOWPOLY)}
        className="w-full flex items-center px-4 py-2 text-sm text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
      >
        <FaMountain className="mr-3" />
        Low Poly
      </button>
      
      <button
        onClick={() => handleBackgroundChange(BackgroundType.SEAWAVE)}
        className="w-full flex items-center px-4 py-2 text-sm text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
      >
        <FaWater className="mr-3" />
        Sea Wave
      </button>
      
      <div className="h-px bg-warm-gray-200 dark:bg-warm-gray-700 my-1" />
      
      {/* Actions */}
      <button
        onClick={handleCustomize}
        className="w-full flex items-center px-4 py-2 text-sm text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
      >
        <FaWrench className="mr-3" />
        Customize Toolbar
      </button>
      
      <button
        onClick={handleReset}
        className="w-full flex items-center px-4 py-2 text-sm text-dusty-rose-600 dark:text-dusty-rose-400 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
      >
        <FaRotateLeft className="mr-3" />
        Reset Workspace
      </button>
    </div>
  );
};

export default ToolbarMenu;