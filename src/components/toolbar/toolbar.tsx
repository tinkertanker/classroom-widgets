import React, { useState, useEffect, useRef } from 'react';
import { WIDGET_TYPES } from '../../constants/widgetTypes';
import { useModal } from '../../contexts/ModalContext';
import { useWorkspace } from '../../store/WorkspaceContext';
import CustomizeToolbarWrapper from './CustomizeToolbarWrapper';
import StickerPalette from './StickerPalette';
import { 
  FaDice,           // Randomiser
  FaClock,          // Timer
  FaListCheck,      // List
  FaUserGroup,      // Task Cue icon
  FaTrafficLight,   // Traffic Light
  FaVolumeHigh,     // Sound Monitor
  FaLink,           // Link Shortener
  FaArrowRotateLeft,// Reset icon
  FaTableCells,     // Grid icon for more widgets
  FaTextWidth,      // Text Banner
  FaImage,          // Image Display
  FaMusic,          // Sound Effects
  FaPalette,        // Background icon
  FaWrench,         // Customize icon
  FaMoon,           // Dark mode
  FaSun,            // Light mode
  FaStamp,          // Stamp icon
  FaChartColumn,    // Poll icon
  FaWifi,           // Network indicator
  FaQrcode,         // QR Code icon
  FaPaperclip,      // Data Share icon
  FaVideo,          // Visualiser icon
  FaPlus,           // Plus icon for more widgets
  FaCaretUp         // Upward caret for popup indicator
} from 'react-icons/fa6';

interface ToolbarProps {
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  hoveringTrash: string | null;
}

export default function Toolbar({ darkMode, setDarkMode, hoveringTrash }: ToolbarProps) {
  const { 
    state, 
    addWidget, 
    setBackground, 
    setStickerMode, 
    resetWorkspace 
  } = useWorkspace();

  const { showModal, hideModal } = useModal();
  const [customWidgets, setCustomWidgets] = useState<number[]>(() => {
    const saved = localStorage.getItem('customToolbarWidgets');
    if (saved) {
      return JSON.parse(saved);
    }
    return [
      WIDGET_TYPES.RANDOMISER,
      WIDGET_TYPES.TIMER,
      WIDGET_TYPES.LIST,
      WIDGET_TYPES.TRAFFIC_LIGHT,
      WIDGET_TYPES.POLL,
      WIDGET_TYPES.TEXT_BANNER
    ];
  });

  const backgroundOptions = ['geometric', 'gradient', 'lines', 'dots'] as const;
  const [showMenu, setShowMenu] = useState(false);
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
  const [showAllWidgets, setShowAllWidgets] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const menuRef = useRef<HTMLDivElement>(null);
  const moreWidgetsRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [serverConnected, setServerConnected] = useState(false);

  // Check server connection (used by Poll and Data Share widgets)
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'}/api/health`);
        setServerConnected(response.ok);
      } catch (error) {
        setServerConnected(false);
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);


  // Handle clicks outside the menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMenu && menuRef.current && menuButtonRef.current &&
          !menuRef.current.contains(event.target as Node) &&
          !menuButtonRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      
      if (showAllWidgets && moreWidgetsRef.current && moreButtonRef.current &&
          !moreWidgetsRef.current.contains(event.target as Node) &&
          !moreButtonRef.current.contains(event.target as Node)) {
        setShowAllWidgets(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu, showAllWidgets]);

  const getWidgetIcon = (widgetType: number): React.ReactElement => {
    switch (widgetType) {
      case WIDGET_TYPES.RANDOMISER: return <FaDice /> as React.ReactElement;
      case WIDGET_TYPES.TIMER: return <FaClock /> as React.ReactElement;
      case WIDGET_TYPES.LIST: return <FaListCheck /> as React.ReactElement;
      case WIDGET_TYPES.TASK_CUE: return <FaUserGroup /> as React.ReactElement;
      case WIDGET_TYPES.TRAFFIC_LIGHT: return <FaTrafficLight /> as React.ReactElement;
      case WIDGET_TYPES.SOUND_MONITOR: return <FaVolumeHigh /> as React.ReactElement;
      case WIDGET_TYPES.LINK_SHORTENER: return <FaLink /> as React.ReactElement;
      case WIDGET_TYPES.TEXT_BANNER: return <FaTextWidth /> as React.ReactElement;
      case WIDGET_TYPES.IMAGE_DISPLAY: return <FaImage /> as React.ReactElement;
      case WIDGET_TYPES.SOUND_EFFECTS: return <FaMusic /> as React.ReactElement;
      case WIDGET_TYPES.POLL: return <FaChartColumn /> as React.ReactElement;
      case WIDGET_TYPES.QRCODE: return <FaQrcode /> as React.ReactElement;
      case WIDGET_TYPES.DATA_SHARE: return <FaPaperclip /> as React.ReactElement;
      case WIDGET_TYPES.VISUALISER: return <FaVideo /> as React.ReactElement;
      default: return <FaDice /> as React.ReactElement;
    }
  };

  const widgetNames: Record<number, string> = {
    [WIDGET_TYPES.RANDOMISER]: "Randomiser",
    [WIDGET_TYPES.TIMER]: "Timer",
    [WIDGET_TYPES.LIST]: "List",
    [WIDGET_TYPES.TASK_CUE]: "Task Cue",
    [WIDGET_TYPES.TRAFFIC_LIGHT]: "Traffic Light",
    [WIDGET_TYPES.SOUND_MONITOR]: "Volume Level",
    [WIDGET_TYPES.LINK_SHORTENER]: "Shorten Link",
    [WIDGET_TYPES.TEXT_BANNER]: "Text Banner",
    [WIDGET_TYPES.IMAGE_DISPLAY]: "Image Display",
    [WIDGET_TYPES.SOUND_EFFECTS]: "Sound Effects",
    [WIDGET_TYPES.POLL]: "Poll",
    [WIDGET_TYPES.QRCODE]: "QR Code",
    [WIDGET_TYPES.DATA_SHARE]: "Data Share",
    [WIDGET_TYPES.VISUALISER]: "Visualiser"
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return { displayHours, minutes, ampm };
  };

  const { displayHours, minutes, ampm } = formatTime(currentTime);
  const showColon = currentTime.getSeconds() % 2 === 0;

  const handleAddWidget = (widgetType: number) => {
    if (!state.stickerMode) {
      addWidget(widgetType);
      setShowAllWidgets(false);
    }
  };

  const handleResetWorkspace = () => {
    resetWorkspace();
    setShowMenu(false);
  };

  const handleBackgroundChange = (type: typeof backgroundOptions[number]) => {
    setBackground(type);
    setShowBackgroundMenu(false);
    setShowMenu(false);
  };

  const handleCustomizeToolbar = () => {
    setShowMenu(false);
    showModal({
      title: 'Customize Toolbar',
      content: (
        <CustomizeToolbarWrapper
          customWidgets={customWidgets}
          setCustomWidgets={setCustomWidgets}
          widgetNames={widgetNames}
          getWidgetIcon={getWidgetIcon}
          onClose={hideModal}
        />
      ),
      className: "bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-2xl"
    });
  };

  const handleToggleStickerMode = () => {
    if (!state.stickerMode) {
      // Show sticker palette modal
      setShowMenu(false);
      showModal({
        title: 'Sticker Palette',
        content: (
          <StickerPalette
            selectedStickerType={state.selectedStickerType}
            setSelectedStickerType={(type: string) => setStickerMode(true, type)}
            setStickerMode={setStickerMode}
            stickerMode={state.stickerMode}
            onClose={hideModal}
          />
        ),
        className: "bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-2xl"
      });
    } else {
      // Exit sticker mode
      setStickerMode(false);
      setShowMenu(false);
    }
  };

  const allWidgets = [
    WIDGET_TYPES.RANDOMISER,
    WIDGET_TYPES.TIMER,
    WIDGET_TYPES.LIST,
    WIDGET_TYPES.TASK_CUE,
    WIDGET_TYPES.TRAFFIC_LIGHT,
    WIDGET_TYPES.SOUND_MONITOR,
    WIDGET_TYPES.LINK_SHORTENER,
    WIDGET_TYPES.TEXT_BANNER,
    WIDGET_TYPES.IMAGE_DISPLAY,
    WIDGET_TYPES.SOUND_EFFECTS,
    WIDGET_TYPES.POLL,
    WIDGET_TYPES.QRCODE,
    WIDGET_TYPES.DATA_SHARE,
    WIDGET_TYPES.VISUALISER
  ];

  const otherWidgets = allWidgets.filter(widget => !customWidgets.includes(widget));

  return (
    <div className={`flex flex-col space-y-4 px-4 pt-4 pb-0 bg-warm-white shadow-sm ${state.activeWidgetId ? 'z-50' : 'z-50'} relative transition-colors duration-200`}>
      {/* Main widget buttons */}
      <div className="flex space-x-3 items-end">
        {/* Trash icon - prominent on left with large hit area */}
        <div
          id="trash"
          className={`w-16 h-16 cursor-pointer transition-all duration-200 p-3 rounded-lg flex items-center justify-center ${
            hoveringTrash 
              ? 'bg-dusty-rose-500 transform scale-105' 
              : 'bg-transparent'
          }`}
          title="Drag widgets here to delete"
        >
          <svg
            className={`w-10 h-10 transition-all duration-200 ${
              hoveringTrash 
                ? 'text-white' 
                : 'text-warm-gray-600 dark:text-warm-gray-300'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </div>

        {/* More widgets button - prominent on left */}
        {otherWidgets.length > 0 && (
          <div className="relative">
            <button
              ref={moreButtonRef}
              onClick={() => setShowAllWidgets(!showAllWidgets)}
              className={`w-16 h-16 p-2 rounded-lg text-white bg-terracotta-500 hover:bg-terracotta-600 transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg flex flex-col items-center justify-center gap-0.5 relative ${
                state.stickerMode ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                showAllWidgets ? 'ring-2 ring-terracotta-600 ring-offset-2 ring-offset-warm-white dark:ring-offset-warm-gray-900' : ''
              }`}
              disabled={state.stickerMode}
              title="More widgets"
            >
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
                <FaCaretUp className="text-sm" />
              </div>
              <FaPlus className="text-xl" />
              <span className="text-[10px] font-medium">MORE</span>
            </button>

            {showAllWidgets && (
              <div 
                ref={moreWidgetsRef}
                className="absolute bottom-full left-0 mb-2 bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-lg p-4 z-50"
              >
                <div className="grid grid-cols-3 gap-2 min-w-[200px]">
                  {otherWidgets.map((widgetType) => (
                    <button
                      key={widgetType}
                      onClick={() => handleAddWidget(widgetType)}
                      className={`flex flex-col items-center p-3 rounded hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 transition-colors ${
                        (widgetType === WIDGET_TYPES.POLL || widgetType === WIDGET_TYPES.DATA_SHARE) && !serverConnected ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      disabled={(widgetType === WIDGET_TYPES.POLL || widgetType === WIDGET_TYPES.DATA_SHARE) && !serverConnected}
                      title={widgetNames[widgetType]}
                    >
                      <div className="text-2xl mb-1 text-warm-gray-700 dark:text-warm-gray-300 relative">
                        {getWidgetIcon(widgetType)}
                        {(widgetType === WIDGET_TYPES.POLL || widgetType === WIDGET_TYPES.DATA_SHARE) && !serverConnected && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-dusty-rose-500 rounded-full" />
                        )}
                      </div>
                      <span className="text-xs text-warm-gray-600 dark:text-warm-gray-400 text-center">
                        {widgetNames[widgetType]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Separator */}
        <div className="w-px h-8 bg-warm-gray-300 dark:bg-warm-gray-600"></div>

        {customWidgets.map((widgetType) => (
          <button
            key={widgetType}
            onClick={() => handleAddWidget(widgetType)}
            className={`px-3 py-2 rounded-lg text-warm-gray-700 bg-soft-white dark:bg-warm-gray-800 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 transition-all duration-200 group relative flex flex-col items-center gap-1 min-w-[80px] ${
              hoveringTrash ? 'scale-95 opacity-50' : ''
            } ${state.stickerMode ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={state.stickerMode || ((widgetType === WIDGET_TYPES.POLL || widgetType === WIDGET_TYPES.DATA_SHARE) && !serverConnected)}
            title={widgetNames[widgetType]}
          >
            <div className="text-lg relative">
              {getWidgetIcon(widgetType)}
              {(widgetType === WIDGET_TYPES.POLL || widgetType === WIDGET_TYPES.DATA_SHARE) && !serverConnected && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-dusty-rose-500 rounded-full" title="Server offline" />
              )}
            </div>
            <span className="text-xs text-center leading-tight">{widgetNames[widgetType]}</span>
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sticker Mode Toggle */}
        <button
          onClick={handleToggleStickerMode}
          className={`px-3 py-2 rounded-lg transition-all duration-200 flex flex-col items-center gap-1 min-w-[80px] ${
            state.stickerMode 
              ? 'bg-terracotta-500 text-white hover:bg-terracotta-600' 
              : 'text-warm-gray-700 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-800/40'
          }`}
          title={state.stickerMode ? "Exit sticker mode" : "Enter sticker mode"}
        >
          <FaStamp className="text-lg" />
          <span className="text-xs text-center leading-tight">Stickers</span>
        </button>

        {/* Clock */}
        <div className="flex items-center px-4 py-2 bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm">
          <span className="font-mono text-lg text-warm-gray-700 dark:text-warm-gray-300">
            {displayHours}
            <span className={`${showColon ? 'opacity-100' : 'opacity-0'} transition-opacity duration-100`}>:</span>
            {minutes} {ampm}
          </span>
        </div>

        {/* Server connection indicator */}
        <div 
          className={`p-3 rounded-lg transition-all duration-200 ${
            serverConnected 
              ? 'text-sage-600 dark:text-sage-400' 
              : 'text-warm-gray-400 dark:text-warm-gray-500'
          }`}
          title={serverConnected ? 'Server connected' : 'Server offline'}
        >
          <FaWifi className="text-xl" />
        </div>

        {/* Menu button */}
        <div className="relative">
          <button
            ref={menuButtonRef}
            onClick={() => setShowMenu(!showMenu)}
            className="p-3 rounded-lg text-warm-gray-700 bg-soft-white dark:bg-warm-gray-800 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 transition-colors"
            title="Menu"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Menu dropdown */}
          {showMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 bottom-full mb-2 bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-lg py-2 z-[100] min-w-[200px]"
            >
            <button
              onClick={handleResetWorkspace}
              className="w-full px-4 py-2 text-left text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 flex items-center space-x-2"
            >
              <FaArrowRotateLeft className="text-sm" />
              <span>Reset Workspace</span>
            </button>
            
            <div className="relative">
              <button
                onClick={() => setShowBackgroundMenu(!showBackgroundMenu)}
                className="w-full px-4 py-2 text-left text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 flex items-center space-x-2"
              >
                <FaPalette className="text-sm" />
                <span>Background</span>
                <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              {showBackgroundMenu && (
                <div className="absolute left-full top-0 ml-2 bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-lg py-2 min-w-[150px]">
                  {backgroundOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleBackgroundChange(option)}
                      className={`w-full px-4 py-2 text-left text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 capitalize ${
                        state.backgroundType === option ? 'bg-warm-gray-100 dark:bg-warm-gray-700' : ''
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={handleCustomizeToolbar}
              className="w-full px-4 py-2 text-left text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 flex items-center space-x-2"
            >
              <FaWrench className="text-sm" />
              <span>Customize Toolbar</span>
            </button>
            
            <div className="border-t border-warm-gray-200 dark:border-warm-gray-700 my-2" />
            
            <button
              onClick={() => {
                setDarkMode(!darkMode);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 flex items-center space-x-2"
            >
              {darkMode ? <FaSun className="text-sm" /> : <FaMoon className="text-sm" />}
              <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        )}
        </div>
      </div>

    </div>
  );
}