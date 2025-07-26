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
import SessionBanner from '../features/session/components/SessionBanner';
import WidgetRenderer from '../features/board/components/WidgetRenderer';
import Confetti from 'react-confetti';
import GlobalErrorBoundary from '../shared/components/GlobalErrorBoundary';
import { WidgetType } from '../shared/types';
import io from 'socket.io-client';

// Audio import for trash sound
import trashSound from '../sounds/trash-crumple.mp3';
const trashAudio = new Audio(trashSound);

// Socket connection setup
const setupSocketConnection = (serverUrl: string, setServerStatus: any) => {
  const socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });
  
  socket.on('connect', () => {
    console.log('Connected to server');
    setServerStatus({ connected: true });
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    setServerStatus({ connected: false });
  });
  
  socket.on('connect_error', (error: any) => {
    console.error('Connection error:', error);
    setServerStatus({ connected: false, error: error.message });
  });
  
  return socket;
};

function App() {
  const { theme } = useWorkspace();
  const { url, setServerStatus } = useServerConnection();
  const sessionCode = useWorkspaceStore((state) => state.sessionCode);
  const setSessionCode = useWorkspaceStore((state) => state.setSessionCode);
  const widgets = useWorkspaceStore((state) => state.widgets);
  const addWidget = useWorkspaceStore((state) => state.addWidget);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [stickerMode, setStickerMode] = useState(false);
  const [selectedStickerType, setSelectedStickerType] = useState<string | null>(null);
  
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
  
  // Confetti trigger function for widgets
  useEffect(() => {
    (window as any).toggleConfetti = (show: boolean) => {
      setShowConfetti(show);
      if (show) {
        setTimeout(() => setShowConfetti(false), 5000);
      }
    };
    
    return () => {
      delete (window as any).toggleConfetti;
    };
  }, []);
  
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
  }, []);
  
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
      // Get click coordinates relative to the board
      const board = e.currentTarget;
      const rect = board.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Add stamp widget at click position (stickers are stamps in this app)
      addWidget(WidgetType.STAMP, { x, y });
      
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
    
    return () => {
      delete (window as any).setStickerMode;
    };
  }, []);
  
  return (
    <GlobalErrorBoundary>
      <ModalProvider>
        <div className="h-screen bg-[#f7f5f2] dark:bg-warm-gray-900 overflow-hidden relative">
          {/* Confetti */}
          {showConfetti && (
            <Confetti
              width={window.innerWidth}
              height={window.innerHeight}
              recycle={false}
              numberOfPieces={200}
            />
          )}
          
          {/* Top Controls */}
          <TopControls />
          
          {/* Session Banner */}
          {sessionCode && (
            <SessionBanner
              sessionCode={sessionCode}
              onClose={() => setSessionCode(null)}
            />
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
    </GlobalErrorBoundary>
  );
}

export default App;