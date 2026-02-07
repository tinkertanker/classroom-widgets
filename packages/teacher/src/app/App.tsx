// Main App component - Refactored for better architecture

import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import { ModalProvider } from '../contexts/ModalContext';
import { SocketProvider } from '../contexts/SocketProvider';
import { SessionProvider } from '../contexts/SessionContext';
import { useWorkspace, useServerConnection } from '@shared/hooks/useWorkspace';
import { useWorkspaceStore } from '../store/workspaceStore.simple';
import { migrateFromOldFormat } from '@shared/utils/migration';
import Board from '../features/board/components';
import BottomBar from '../features/hud/components';
import TopControls from '../features/hud/components/TopControls';
import WidgetList from '../features/board/components/WidgetList';
import GlobalErrorBoundary from '@shared/components/GlobalErrorBoundary';
import SmallScreenWarning from '@shared/components/SmallScreenWarning';
import VoiceInterface from '../features/voiceControl/components/VoiceInterface';
import { HudProximityProvider } from '@shared/hooks/useHudProximity';
import { WidgetType, WidgetCategory } from '@shared/types';
import { widgetRegistry } from '../services/WidgetRegistry';
import { APP_VERSION } from '../version';

import { ConfettiProvider } from '../contexts/ConfettiContext';

// Audio import for trash sound
import trashSound from '../sounds/trash-crumple.mp3';
const trashAudio = new Audio(trashSound);


function App() {
  const { theme, scale } = useWorkspace();
  const { url, setServerStatus } = useServerConnection();
  const sessionCode = useWorkspaceStore((state) => state.sessionCode);
  const setSessionCode = useWorkspaceStore((state) => state.setSessionCode);
  // Removed: widgets subscription moved to WidgetList component
  const addWidget = useWorkspaceStore((state) => state.addWidget);
  const updateWidgetState = useWorkspaceStore((state) => state.updateWidgetState);
  const resizeWidget = useWorkspaceStore((state) => state.resizeWidget);
  const scrollPosition = useWorkspaceStore((state) => state.scrollPosition);
  // Removed: focusedWidgetId subscription - use getState() where needed
  const setFocusedWidget = useWorkspaceStore((state) => state.setFocusedWidget);
  const voiceControlEnabled = useWorkspaceStore((state) => state.bottomBar.voiceControlEnabled ?? false);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [stickerMode, setStickerMode] = useState(false);
  const [selectedStickerType, setSelectedStickerType] = useState<string | null>(null);
  const [screenTooSmall, setScreenTooSmall] = useState(window.innerWidth < 768);

  // Voice control state
  const [isVoiceControlActive, setIsVoiceControlActive] = useState(false);
  const [lastCommandPress, setLastCommandPress] = useState<number | null>(null);
  const [voiceTimeout, setVoiceTimeout] = useState<NodeJS.Timeout | null>(null);
  
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

      // Open widget launcher with Cmd/Ctrl + K (handle this first to avoid triggering voice control)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Trigger the LaunchpadDialog by clicking the More button
        const moreButton = document.querySelector('[title*="More widgets"]') as HTMLButtonElement;
        if (moreButton) {
          moreButton.click();
        }
        return;
      }

      // Exit sticker mode with S or Escape key
      if (stickerMode && (e.key.toLowerCase() === 's' || e.key === 'Escape')) {
        e.preventDefault();
        setStickerMode(false);
        setSelectedStickerType(null);
        return;
      }

      // Handle Command/Ctrl key press for voice activation (only when Cmd is pressed alone)
      // This should NOT trigger for Cmd+letter combinations
      // Only enable when voice control alpha feature is enabled
      if (voiceControlEnabled &&
          (e.metaKey || e.ctrlKey) &&
          (e.key === 'Meta' || e.key === 'Control' || e.key === 'OS') &&
          !e.altKey && !e.shiftKey) {
        const now = Date.now();

        if (lastCommandPress && (now - lastCommandPress) < 500) {
          // Double press detected - activate voice control
          e.preventDefault();
          setIsVoiceControlActive(true);
          setLastCommandPress(null);

          // Clear any existing timeout
          if (voiceTimeout) {
            clearTimeout(voiceTimeout);
            setVoiceTimeout(null);
          }
        } else {
          // First press - set up timeout to detect double press
          setLastCommandPress(now);

          // Clear previous timeout if exists
          if (voiceTimeout) {
            clearTimeout(voiceTimeout);
          }

          // Set new timeout
          const timeout = setTimeout(() => {
            setLastCommandPress(null);
            setVoiceTimeout(null);
          }, 500);

          setVoiceTimeout(timeout);
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (voiceTimeout) {
        clearTimeout(voiceTimeout);
      }
    };
  }, [stickerMode, lastCommandPress, voiceTimeout, voiceControlEnabled]);

  // Global paste handler for creating widgets from clipboard content
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't handle if typing in input field or if any widget is focused
      const currentFocusedWidgetId = useWorkspaceStore.getState().focusedWidgetId;
      if (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          currentFocusedWidgetId !== null) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      // Helper to get center position for new widget
      const getCenterPosition = (widgetWidth: number, widgetHeight: number) => {
        const scrollContainer = document.querySelector('.board-scroll-container') as HTMLElement;
        if (scrollContainer) {
          const scrollRect = scrollContainer.getBoundingClientRect();
          const centerX = (scrollContainer.scrollLeft + scrollRect.width / 2) / scale;
          const centerY = (scrollContainer.scrollTop + scrollRect.height / 2) / scale;
          return {
            x: centerX - widgetWidth / 2,
            y: centerY - widgetHeight / 2
          };
        }
        return { x: 100, y: 100 };
      };

      // Check for image first (higher priority)
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();

            // Convert image to data URL
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
              const imageUrl = loadEvent.target?.result as string;

              // Load image to get dimensions for aspect ratio
              const img = new Image();
              img.onload = () => {
                // Get default/max size constraints
                const imageWidgetConfig = widgetRegistry.get(WidgetType.IMAGE_DISPLAY);
                const maxWidth = imageWidgetConfig?.defaultSize.width || 350;
                const maxHeight = imageWidgetConfig?.defaultSize.height || 350;

                // Calculate size maintaining aspect ratio, fitting within max bounds
                const aspectRatio = img.width / img.height;
                let widgetWidth: number;
                let widgetHeight: number;

                if (aspectRatio > 1) {
                  // Landscape: constrain by width
                  widgetWidth = Math.min(img.width, maxWidth);
                  widgetHeight = widgetWidth / aspectRatio;
                  // If height still exceeds max, constrain by height instead
                  if (widgetHeight > maxHeight) {
                    widgetHeight = maxHeight;
                    widgetWidth = widgetHeight * aspectRatio;
                  }
                } else {
                  // Portrait or square: constrain by height
                  widgetHeight = Math.min(img.height, maxHeight);
                  widgetWidth = widgetHeight * aspectRatio;
                  // If width still exceeds max, constrain by width instead
                  if (widgetWidth > maxWidth) {
                    widgetWidth = maxWidth;
                    widgetHeight = widgetWidth / aspectRatio;
                  }
                }

                // Ensure minimum size
                const minSize = imageWidgetConfig?.minSize || { width: 200, height: 200 };
                widgetWidth = Math.max(widgetWidth, minSize.width);
                widgetHeight = Math.max(widgetHeight, minSize.height);

                // Get center position for the calculated size
                const position = getCenterPosition(widgetWidth, widgetHeight);

                // Create the image widget
                const widgetId = addWidget(WidgetType.IMAGE_DISPLAY, position);

                // Resize to match image aspect ratio
                resizeWidget(widgetId, { width: widgetWidth, height: widgetHeight });

                // Set the image data in the widget's state
                updateWidgetState(widgetId, { imageUrl });

                // Set the new widget as focused
                setFocusedWidget(widgetId);
              };
              img.src = imageUrl;
            };
            reader.readAsDataURL(file);
            return; // Exit after handling image
          }
        }
      }

      // Check for text if no image found
      const text = e.clipboardData?.getData('text/plain');
      if (text && text.trim()) {
        e.preventDefault();

        // Get text banner config
        const textBannerConfig = widgetRegistry.get(WidgetType.TEXT_BANNER);
        const widgetWidth = textBannerConfig?.defaultSize.width || 400;
        const widgetHeight = textBannerConfig?.defaultSize.height || 300;

        // Get center position
        const position = getCenterPosition(widgetWidth, widgetHeight);

        // Create the text banner widget
        const widgetId = addWidget(WidgetType.TEXT_BANNER, position);

        // Set the text in the widget's state
        updateWidgetState(widgetId, { text: text.trim(), colorIndex: 0 });

        // Set the new widget as focused
        setFocusedWidget(widgetId);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [scale, addWidget, updateWidgetState, resizeWidget, setFocusedWidget]);

  // Voice command processing handler
  const handleVoiceCommand = useCallback(async (transcript: string) => {
    try {
      console.log('Voice command received:', transcript);

      // Import services dynamically to avoid server-side rendering issues
      const { voiceCommandService } = await import('../features/voiceControl/services/VoiceCommandService');
      const { voiceCommandExecutor } = await import('../features/voiceControl/services/VoiceCommandExecutor');

      // 🚀 OPTIMIZATION: Read current state on demand instead of dependencies
      const currentWidgets = useWorkspaceStore.getState().widgets;
      const currentFocusedId = useWorkspaceStore.getState().focusedWidgetId;
      const setFocusedWidget = useWorkspaceStore.getState().setFocusedWidget;

      // Get current widget context
      const context = {
        activeWidgets: currentWidgets.map(widget => ({
          id: widget.id,
          type: widget.type,
          state: widget.state,
          isFocused: widget.id === currentFocusedId
        })),
        availableWidgets: ['timer', 'list', 'poll', 'randomiser', 'questions', 'image'],
        screenPosition: { x: 0, y: 0 }
      };

      // Process command through LLM service
      const commandResponse = await voiceCommandService.processCommand(transcript, context);

      // Execute the command
      if (commandResponse.command.action !== 'UNKNOWN' && commandResponse.command.action !== 'ERROR') {
        const executionResult = await voiceCommandExecutor.executeCommand(commandResponse);

        if (executionResult.success) {
          console.log('Voice command executed successfully:', executionResult);

          // Focus the newly created widget if applicable
          if (executionResult.widgetId) {
            setFocusedWidget(executionResult.widgetId);
          }

          return {
            ...commandResponse,
            success: true,
            feedback: {
              ...commandResponse.feedback,
              message: commandResponse.feedback.message || 'Command executed successfully'
            }
          };
        } else {
          console.error('Voice command execution failed:', executionResult.error);

          return {
            ...commandResponse,
            success: false,
            feedback: {
              message: executionResult.error || 'Failed to execute command',
              type: 'error' as const,
              shouldSpeak: true
            }
          };
        }
      } else {
        // Return the LLM response for unknown/error commands
        return commandResponse;
      }
    } catch (error) {
      console.error('Voice command processing failed:', error);

      return {
        success: false,
        command: {
          action: 'ERROR',
          target: 'unknown',
          parameters: {},
          confidence: 0
        },
        feedback: {
          message: error instanceof Error ? error.message : 'Failed to process voice command',
          type: 'error' as const,
          shouldSpeak: false
        }
      };
    }
  }, []); // 🎉 Empty dependency array - function never recreates!

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

  // Make voice control functions available globally for toolbar
  useEffect(() => {
    (window as any).activateVoiceControl = () => {
      setIsVoiceControlActive(true);
    };

    (window as any).getVoiceControlActive = () => isVoiceControlActive;

    return () => {
      delete (window as any).activateVoiceControl;
      delete (window as any).getVoiceControlActive;
    };
  }, [isVoiceControlActive]);
  
  return (
    <GlobalErrorBoundary>
      {screenTooSmall ? (
        <SmallScreenWarning />
      ) : (
        <SocketProvider>
          <SessionProvider>
            <ConfettiProvider>
              <ModalProvider>
              <HudProximityProvider>
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
                  <WidgetList />
                </Board>
          </div>
          
          {/* Toolbar at bottom */}
          <div className="toolbar-container">
            <BottomBar />
          </div>

          {/* Version label */}
          <div className="fixed bottom-2 left-2 text-xs text-warm-gray-400 dark:text-warm-gray-600 opacity-50 pointer-events-none select-none z-10">
            v{APP_VERSION}
          </div>

          {/* Voice Control Interface */}
          <VoiceInterface
            isOpen={isVoiceControlActive}
            onClose={() => setIsVoiceControlActive(false)}
            onTranscriptComplete={handleVoiceCommand}
          />
              </div>
              </HudProximityProvider>
            </ModalProvider>
          </ConfettiProvider>
          </SessionProvider>
        </SocketProvider>
      )}
    </GlobalErrorBoundary>
  );
}

export default App;