import React from 'react';
import Toolbar from './toolbar';
import { useWorkspace } from '../../store/WorkspaceContext';
import { WidgetInstance, BackgroundType } from '../../types/app.types';
import { v4 as uuidv4 } from 'uuid';

interface ToolbarAdapterProps {
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  hoveringTrash: string | null;
}

/**
 * Adapter component to make the existing Toolbar work with the new context API
 */
const ToolbarAdapter: React.FC<ToolbarAdapterProps> = ({ darkMode, setDarkMode, hoveringTrash }) => {
  const { 
    state, 
    addWidget, 
    setActiveWidget, 
    setBackground, 
    setStickerMode, 
    resetWorkspace 
  } = useWorkspace();

  // Adapter function to handle setComponentList calls from toolbar
  const handleSetComponentList = (updater: any) => {
    if (typeof updater === 'function') {
      // This is when toolbar adds a widget
      // We need to intercept and use our context method
      const fakeList: WidgetInstance[] = [];
      const result = updater(fakeList);
      if (result.length > 0) {
        const newWidget = result[0];
        addWidget(newWidget.index);
      }
    } else if (Array.isArray(updater) && updater.length === 0) {
      // Reset workspace
      resetWorkspace();
    }
  };

  return (
    <Toolbar
      setComponentList={handleSetComponentList}
      activeIndex={state.activeWidgetId}
      setActiveIndex={(value) => {
        if (typeof value === 'function') {
          setActiveWidget(value(state.activeWidgetId));
        } else {
          setActiveWidget(value);
        }
      }}
      hoveringTrash={hoveringTrash}
      backgroundType={state.backgroundType}
      setBackgroundType={(value) => {
        if (typeof value === 'function') {
          setBackground(value(state.backgroundType));
        } else {
          setBackground(value);
        }
      }}
      darkMode={darkMode}
      setDarkMode={setDarkMode}
      stickerMode={state.stickerMode}
      setStickerMode={(value) => {
        if (typeof value === 'function') {
          setStickerMode(value(state.stickerMode));
        } else {
          setStickerMode(value);
        }
      }}
      selectedStickerType={state.selectedStickerType}
      setSelectedStickerType={(value) => {
        if (typeof value === 'function') {
          const newType = value(state.selectedStickerType);
          setStickerMode(true, newType);
        } else {
          setStickerMode(true, value);
        }
      }}
    />
  );
};

export default ToolbarAdapter;