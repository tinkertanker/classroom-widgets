// BottomBarMenu - Dropdown menu for bottom bar settings

import React, { useRef, useEffect } from 'react';
import {
  FaRotateLeft,
  FaMoon,
  FaSun,
  FaCircle,
  FaShapes,
  FaBrush,
  FaGripLines,
  FaMountain,
  FaWater,
  FaCircleInfo,
  FaMicrophone
} from 'react-icons/fa6';
import { clsx } from 'clsx';
import { useWorkspace, useTheme, useBottomBar } from '../../../shared/hooks/useWorkspace';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { useWidgets } from '../../../shared/hooks/useWidget';
import { BackgroundType } from '../../../shared/types';
import { dropdownContainer, zIndex } from '../../../shared/utils/styles';
import { MenuItem, MenuDivider, MenuSectionHeader } from '../../../components/ui';

interface BottomBarMenuProps {
  onClose: () => void;
}

const BottomBarMenu: React.FC<BottomBarMenuProps> = ({ onClose }) => {
  const { setBackground } = useWorkspace();
  const { theme, toggleTheme } = useTheme();
  const { removeAll } = useWidgets();
  const menuRef = useRef<HTMLDivElement>(null);
  const bottomBar = useWorkspaceStore((state) => state.bottomBar);
  const updateBottomBar = useWorkspaceStore((state) => state.updateBottomBar);

  const voiceControlEnabled = bottomBar.voiceControlEnabled ?? false;

  const handleToggleVoiceControl = () => {
    updateBottomBar({ voiceControlEnabled: !voiceControlEnabled });
  };

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

  // Toggle switch component for voice control
  const VoiceToggle = (
    <div
      className={clsx(
        'ml-auto w-9 h-5 rounded-full transition-colors duration-200 relative',
        voiceControlEnabled
          ? 'bg-sage-500 dark:bg-sage-600'
          : 'bg-warm-gray-300 dark:bg-warm-gray-600'
      )}
    >
      <div
        className={clsx(
          'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
          voiceControlEnabled ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </div>
  );

  return (
    <div
      ref={menuRef}
      className={clsx(
        'absolute right-4 bottom-16 min-w-[200px] py-2',
        dropdownContainer,
        zIndex.hudDropdown
      )}
    >
      {/* Theme Toggle */}
      <MenuItem
        onClick={toggleTheme}
        icon={theme === 'light' ? FaMoon : FaSun}
      >
        {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
      </MenuItem>

      <MenuDivider />

      {/* Background Options */}
      <MenuSectionHeader>Background</MenuSectionHeader>

      <MenuItem
        onClick={() => handleBackgroundChange(BackgroundType.GEOMETRIC)}
        icon={FaShapes}
      >
        Geometric
      </MenuItem>

      <MenuItem
        onClick={() => handleBackgroundChange(BackgroundType.GRADIENT)}
        icon={FaBrush}
      >
        Gradient
      </MenuItem>

      <MenuItem
        onClick={() => handleBackgroundChange(BackgroundType.LINES)}
        icon={FaGripLines}
      >
        Lines
      </MenuItem>

      <MenuItem
        onClick={() => handleBackgroundChange(BackgroundType.DOTS)}
        icon={FaCircle}
      >
        Dots
      </MenuItem>

      <MenuItem
        onClick={() => handleBackgroundChange(BackgroundType.LOWPOLY)}
        icon={FaMountain}
      >
        Low Poly
      </MenuItem>

      <MenuItem
        onClick={() => handleBackgroundChange(BackgroundType.SEAWAVE)}
        icon={FaWater}
      >
        Sea Wave
      </MenuItem>

      <MenuDivider />

      {/* Actions */}
      <MenuItem
        onClick={handleReset}
        icon={FaRotateLeft}
        variant="danger"
      >
        Reset Workspace
      </MenuItem>

      <MenuDivider />

      {/* Alpha Features */}
      <MenuSectionHeader>Alpha Features</MenuSectionHeader>

      <MenuItem
        onClick={handleToggleVoiceControl}
        icon={FaMicrophone}
        rightContent={VoiceToggle}
      >
        Voice Control
      </MenuItem>

      <MenuDivider />

      {/* About Link */}
      <a
        href="/about"
        onClick={onClose}
        className="w-full flex items-center px-4 py-2 text-sm text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 transition-colors"
      >
        <FaCircleInfo className="mr-3 w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">About</span>
      </a>
    </div>
  );
};

export default BottomBarMenu;
