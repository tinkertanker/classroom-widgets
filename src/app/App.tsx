// Main App component - Refactored for better architecture

import React, { useEffect, useState } from 'react';
import './App.css';
import { ModalProvider } from '../contexts/ModalContext';
import { useWorkspace, useServerConnection } from '../shared/hooks/useWorkspace';
import { useWorkspaceStore } from '../store/workspaceStore.simple';
import { migrateFromOldFormat } from '../shared/utils/migration';
import Board from '../features/board/components';
import Toolbar from '../features/toolbar/components';
import TopControls from '../features/toolbar/components/TopControls';
import WidgetRenderer from '../features/board/components/WidgetRenderer';
import GlobalErrorBoundary from '../shared/components/GlobalErrorBoundary';
import SmallScreenWarning from '../shared/components/SmallScreenWarning';
import { WidgetType, WidgetCategory } from '../shared/types';
import { widgetRegistry } from '../services/WidgetRegistry';
import io from 'socket.io-client';
import { ConfettiProvider } from '../contexts/ConfettiContext';

// Audio import for trash sound
import trashSound from '../sounds/trash-crumple.mp3';
const trashAudio = new Audio(trashSound);

// Socket connection setup
const setupSocketConnection = (serverUrl: string, setServerStatus: any) => {
  const socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity, // Keep trying forever
    timeout: 20000
  });
  
  socket.on('connect', () => {
    setServerStatus({ connected: true });
  });
  
  socket.on('disconnect', () => {
    setServerStatus({ connected: false });
  });
  
  socket.on('connect_error', (error: any) => {
    console.error('Connection error:', error);
    setServerStatus({ connected: false, error: error.message });
  });
  
  socket.on('reconnect_attempt', (attemptNumber: number) => {
    console.log(`Reconnecting... (attempt ${attemptNumber})`);
  });
  
  return socket;
};

function App() {
  const { theme, scale } = useWorkspace();
  const { url, setServerStatus } = useServerConnection();
  const sessionCode = useWorkspaceStore((state) => state.sessionCode);
  const setSessionCode = useWorkspaceStore((state) => state.setSessionCode);
  const widgets = useWorkspaceStore((state) => state.widgets);
  const addWidget = useWorkspaceStore((state) => state.addWidget);
  const updateWidgetState = useWorkspaceStore((state) => state.updateWidgetState);
  const scrollPosition = useWorkspaceStore((state) => state.scrollPosition);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [stickerMode, setStickerMode] = useState(false);
  const [selectedStickerType, setSelectedStickerType] = useState<string | null>(null);
  const [screenTooSmall, setScreenTooSmall] = useState(window.innerWidth < 768);
  
  // Note: Session code management is now handled by the networked widgets themselves
  // via the useNetworkedWidget hook. They will set/clear the session code as needed.
  
  // Run migration on first load
  useEffect(() => {
    try {
      migrateFromOldFormat();
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }, []); // Empty deps - only run once on mount
  
  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  
  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setScreenTooSmall(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  // Setup socket connection
  useEffect(() => {
    // Prevent multiple socket connections
    if ((window as any).socket) {
      return;
    }
    
    const socket = setupSocketConnection(url, setServerStatus);
    
    // Store socket in window for widgets to access
    (window as any).socket = socket;
    
    return () => {
      if ((window as any).socket) {
        socket.disconnect();
        delete (window as any).socket;
      }
    };
  }, [url]); // setServerStatus is stable from zustand, doesn't need to be in deps
  
  
  // Trash sound effect
  useEffect(() => {
    (window as any).playTrashSound = () => {
      trashAudio.play().catch(err => console.error('Error playing trash sound:', err));
    };
    
    return () => {
      delete (window as any).playTrashSound;
    };
  }, []);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Exit sticker mode with S or Escape key
      if (stickerMode && (e.key.toLowerCase() === 's' || e.key === 'Escape')) {
        e.preventDefault();
        setStickerMode(false);
        setSelectedStickerType(null);
        return;
      }
      
      // Open widget launcher with Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Trigger the LaunchpadDialog by clicking the More button
        const moreButton = document.querySelector('[title*="More widgets"]') as HTMLButtonElement;
        if (moreButton) {
          moreButton.click();
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [stickerMode]);
  
  // Prevent swipe navigation
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = (e: PopStateEvent) => {
      window.history.pushState(null, '', window.location.href);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle board clicks for sticker mode
  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (stickerMode && selectedStickerType) {
      // Get the scroll container (board-scroll-container)
      const scrollContainer = document.querySelector('.board-scroll-container') as HTMLElement;
      
      if (!scrollContainer) {
        console.error('Could not find scroll container');
        return;
      }
      
      // Get positions relative to viewport
      const scrollRect = scrollContainer.getBoundingClientRect();
      
      // Calculate click position relative to the scroll container
      const clickX = e.clientX - scrollRect.left;
      const clickY = e.clientY - scrollRect.top;
      
      // Add current scroll position to get board coordinates
      const boardX = (clickX + scrollContainer.scrollLeft) / scale;
      const boardY = (clickY + scrollContainer.scrollTop) / scale;
      
      // Center the sticker (actual rendered size: 150x150)
      const stickerWidth = 150;
      const stickerHeight = 150;
      const x = boardX - stickerWidth / 2;
      const y = boardY - stickerHeight / 2;
      
      // Add stamp widget at click position (stickers are stamps in this app)
      const widgetId = addWidget(WidgetType.STAMP, { x, y });
      
      // Set the sticker type in the widget's state
      updateWidgetState(widgetId, { stickerType: selectedStickerType });
      
      // Exit sticker mode after placing
      setStickerMode(false);
      setSelectedStickerType(null);
    }
  };

  // Make sticker mode functions available globally for toolbar
  useEffect(() => {
    (window as any).setStickerMode = (mode: boolean, type?: string) => {
      setStickerMode(mode);
      if (type) {
        setSelectedStickerType(type);
      } else if (!mode) {
        setSelectedStickerType(null);
      }
    };
    
    // Also expose a getter for the toolbar to check state
    (window as any).getStickerMode = () => stickerMode;
    
    return () => {
      delete (window as any).setStickerMode;
      delete (window as any).getStickerMode;
    };
  }, [stickerMode]);
  
  return (
    <GlobalErrorBoundary>
      {screenTooSmall ? (
        <SmallScreenWarning />
      ) : (
        <ConfettiProvider>
          <ModalProvider>
            <div className="h-screen bg-[#f7f5f2] dark:bg-warm-gray-900 overflow-hidden relative">
          
          {/* Top Controls */}
          <TopControls />
          
          {/* Sticker Mode Banner */}
          {stickerMode && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[999] animate-in slide-in-from-top-2 duration-300">
              <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 relative overflow-hidden">
                <div className="absolute inset-0 bg-white opacity-20 animate-pulse" />
                <div className="relative flex items-center gap-2">
                  <span className="text-xl animate-bounce">✨</span>
                  <div className="text-sm font-bold">
                    Sticker Mode Active - Click anywhere to place {selectedStickerType || 'a sticker'}!
                  </div>
                </div>
                <div className="relative text-xs opacity-90">
                  Press <kbd className="bg-white/20 px-1 rounded">S</kbd> or <kbd className="bg-white/20 px-1 rounded">Esc</kbd> to exit
                </div>
                <button
                  onClick={() => {
                    setStickerMode(false);
                    setSelectedStickerType(null);
                  }}
                  className="ml-2 text-amber-200 hover:text-white transition-colors"
                  title="Exit sticker mode"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          
          {/* Main Board */}
          <div className="h-full relative overflow-hidden">
            <Board onBoardClick={handleBoardClick} stickerMode={stickerMode}>
              {widgets.map((widget) => (
                <WidgetRenderer key={widget.id} widgetId={widget.id} />
              ))}
            </Board>
          </div>
          
          {/* Toolbar at bottom */}
          <div className="toolbar-container">
            <Toolbar />
          </div>
          </div>
          </ModalProvider>
        </ConfettiProvider>
      )}
    </GlobalErrorBoundary>
  );
}

export default App;