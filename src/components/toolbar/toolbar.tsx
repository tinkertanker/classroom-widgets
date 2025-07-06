import { v4 as uuidv4 } from 'uuid'; // Import UUID package
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { WIDGET_TYPES } from '../../constants/widgetTypes';
import { useModal } from '../../contexts/ModalContext';
import CustomizeToolbar from './CustomizeToolbar';
import StickerPalette from './StickerPalette';
// @ts-ignore
import { 
  FaDice,           // Randomiser
  FaClock,          // Timer
  FaListCheck,      // List
  FaUserGroup,      // Work Symbols
  FaTrafficLight,   // Traffic Light
  FaVolumeHigh,     // Sound Monitor
  FaLink,           // Link Shortener
  FaBars,           // Menu icon
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
  FaPaperclip       // Data Share icon
} from 'react-icons/fa6';

export default function Toolbar({setComponentList,activeIndex,setActiveIndex,hoveringTrash,backgroundType,setBackgroundType,darkMode,setDarkMode,stickerMode,setStickerMode,selectedStickerType,setSelectedStickerType}) {
  const [formattedTime, setFormattedTime] = useState("");
  const [colonVisible, setColonVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [launchpadOpen, setLaunchpadOpen] = useState(false);
  const { showModal, hideModal } = useModal();
  const [selectedToolbarWidgets, setSelectedToolbarWidgets] = useState(() => {
    // Load saved toolbar configuration from localStorage
    const saved = localStorage.getItem('toolbarWidgets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // If parsing fails, return default
      }
    }
    // Default toolbar widgets
    return [
      WIDGET_TYPES.RANDOMISER, 
      WIDGET_TYPES.TIMER, 
      WIDGET_TYPES.LIST, 
      WIDGET_TYPES.WORK_SYMBOLS, 
      WIDGET_TYPES.SOUND_MONITOR
    ];
  });

  useEffect(() => {
    const updateTime = () => {
      const date = new Date();
      const hours = date.getHours();
      const minutes = date.getMinutes();

      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? "0" + minutes : minutes;

      setFormattedTime(
        `${formattedHours}:${formattedMinutes}`
      );
    };

    updateTime(); // Initial update
    const interval = setInterval(updateTime, 500);

    return () => clearInterval(interval);
  }, []);

  // Separate effect for blinking colon
  useEffect(() => {
    const interval = setInterval(() => {
      setColonVisible(prev => !prev);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpen && !event.target.closest('.menu-container')) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Component data indexed by widget type
  const AllComponentData = [];
  AllComponentData[WIDGET_TYPES.RANDOMISER] = { name: "Randomiser", icon: FaDice };
  AllComponentData[WIDGET_TYPES.TIMER] = { name: "Timer", icon: FaClock };
  AllComponentData[WIDGET_TYPES.LIST] = { name: "List", icon: FaListCheck };
  AllComponentData[WIDGET_TYPES.WORK_SYMBOLS] = { name: "Task Cue", icon: FaUserGroup };
  AllComponentData[WIDGET_TYPES.TRAFFIC_LIGHT] = { name: "Traffic Light", icon: FaTrafficLight };
  AllComponentData[WIDGET_TYPES.SOUND_MONITOR] = { name: "Sound Monitor", icon: FaVolumeHigh };
  AllComponentData[WIDGET_TYPES.LINK_SHORTENER] = { name: "Link Shortener", icon: FaLink };
  AllComponentData[WIDGET_TYPES.TEXT_BANNER] = { name: "Text Banner", icon: FaTextWidth };
  AllComponentData[WIDGET_TYPES.IMAGE_DISPLAY] = { name: "Image", icon: FaImage };
  AllComponentData[WIDGET_TYPES.SOUND_EFFECTS] = { name: "Sound Effects", icon: FaMusic };
  AllComponentData[WIDGET_TYPES.STAMP] = { name: "Stamp", icon: FaStamp };
  AllComponentData[WIDGET_TYPES.POLL] = { name: "Poll", icon: FaChartColumn, requiresServer: true };
  AllComponentData[WIDGET_TYPES.QRCODE] = { name: "QR Code", icon: FaQrcode };
  AllComponentData[WIDGET_TYPES.DATA_SHARE] = { name: "Data Share", icon: FaPaperclip, requiresServer: true };
  
  // Use customized toolbar widget selection
  const ToolbarComponentData = selectedToolbarWidgets.map(index => AllComponentData[index]).filter(Boolean);

  return (
    <>
      <div className="w-[90%] h-full bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700">
        <div className="w-full h-full px-2 py-1.5">
        <div className="flex items-center justify-center w-full h-full overflow-x-auto overflow-y-visible space-x-1.5">
          {ToolbarComponentData.map((component, toolbarIndex) => {
            const Icon = component.icon;
            // Find the actual index in AllComponentData
            const actualIndex = AllComponentData.findIndex(c => c.name === component.name);
            return (
              <button
                key={component.name}
                onClick={() => {
                  const element = document.getElementById(activeIndex!);
                  if (element) {
                    const { x, y } = element.getBoundingClientRect();
                    if (x === 10 && y === 10) {
                      setActiveIndex(null);
                    }
                  }
                  const newId = uuidv4();
                  setComponentList((e) => [...e, { id: newId, index: actualIndex }]);
                  setActiveIndex(newId); // Set the new widget as active
                }}
                className="px-3 py-2 bg-sage-500 text-white rounded-md hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 transition-colors duration-200 text-xs flex-shrink-0 inline-flex items-center gap-1.5"
              >
                <div className="relative inline-flex items-center">
                  <Icon className="w-4 h-4" />
                  {component.requiresServer && (
                    React.createElement(FaWifi as any, { 
                      className: "w-2 h-2 absolute -top-1 -right-1 text-amber-300" 
                    })
                  )}
                </div>
                <span>{component.name}</span>
              </button>
            );
          })}
          
          {/* More widgets button */}
          <button
            onClick={() => setLaunchpadOpen(true)}
            className="px-3 py-2 bg-dusty-rose-500 text-white rounded-md hover:bg-dusty-rose-600 dark:bg-dusty-rose-600 dark:hover:bg-dusty-rose-700 transition-colors duration-200 text-xs flex-shrink-0 inline-flex items-center gap-1.5"
            title="More widgets"
          >
            {React.createElement(FaTableCells as any, { className: "w-4 h-4" })}
            <span>More</span>
          </button>
          
          {/* Sticker button */}
          <button
            onClick={() => showModal({
              title: 'Sticker Palette',
              content: (
                <StickerPalette
                  selectedStickerType={selectedStickerType}
                  setSelectedStickerType={setSelectedStickerType}
                  setStickerMode={setStickerMode}
                  stickerMode={stickerMode}
                  onClose={hideModal}
                />
              )
            })}
            className={`px-3 py-2 rounded-md transition-colors duration-200 text-xs flex-shrink-0 inline-flex items-center gap-1.5 ${
              stickerMode 
                ? 'bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700' 
                : 'bg-purple-500 text-white hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700'
            }`}
            title="Stickers"
          >
            {React.createElement(FaStamp as any, { className: "w-4 h-4" })}
            <span>Sticker</span>
          </button>
          
          {/* Menu button */}
          <div className="relative ml-2 menu-container">
            <button
              ref={menuButtonRef}
              onClick={() => {
                if (!menuOpen && menuButtonRef.current) {
                  const rect = menuButtonRef.current.getBoundingClientRect();
                  setMenuPosition({
                    top: rect.top - 8, // 8px gap
                    left: rect.left
                  });
                }
                setMenuOpen(!menuOpen);
              }}
              className="p-2 bg-warm-gray-200 hover:bg-warm-gray-300 dark:bg-warm-gray-700 dark:hover:bg-warm-gray-600 text-warm-gray-700 dark:text-warm-gray-200 rounded-md transition-colors duration-200"
              title="Menu"
            >
              {React.createElement(FaBars as any, { className: "w-4 h-4" })}
            </button>
          </div>
          
          {/* Popup menu - rendered as portal */}
          {menuOpen && ReactDOM.createPortal(
            <div 
              className="fixed bg-soft-white dark:bg-warm-gray-800 border border-warm-gray-200 dark:border-warm-gray-700 rounded-lg shadow-lg py-2 min-w-[200px] menu-container"
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                transform: 'translateY(-100%)',
                zIndex: 1000
              }}
            >
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to reset the workspace? This will remove all widgets.')) {
                    setComponentList([]);
                    setActiveIndex(null);
                    setMenuOpen(false);
                    localStorage.removeItem('workspaceState');
                  }
                }}
                className="w-full px-4 py-2 text-left hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 flex items-center gap-3 text-warm-gray-700 dark:text-warm-gray-200 transition-colors duration-150"
              >
                {React.createElement(FaArrowRotateLeft as any, { className: "w-4 h-4" })}
                <span>Reset Workspace</span>
              </button>
              <div className="border-t border-warm-gray-200 dark:border-warm-gray-600 my-2"></div>
              <div className="px-4 py-2">
                <div className="flex items-center gap-3 text-warm-gray-700 dark:text-warm-gray-200 mb-2">
                  {React.createElement(FaPalette as any, { className: "w-4 h-4" })}
                  <span className="font-medium">Background</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setBackgroundType('geometric');
                      setMenuOpen(false);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors duration-150 ${
                      backgroundType === 'geometric' 
                        ? 'bg-sage-500 text-white border-sage-600' 
                        : 'bg-white dark:bg-warm-gray-700 text-warm-gray-700 dark:text-warm-gray-200 border-warm-gray-300 dark:border-warm-gray-600 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600'
                    }`}
                  >
                    Geometric
                  </button>
                  <button
                    onClick={() => {
                      setBackgroundType('gradient');
                      setMenuOpen(false);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors duration-150 ${
                      backgroundType === 'gradient' 
                        ? 'bg-sage-500 text-white border-sage-600' 
                        : 'bg-white dark:bg-warm-gray-700 text-warm-gray-700 dark:text-warm-gray-200 border-warm-gray-300 dark:border-warm-gray-600 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600'
                    }`}
                  >
                    Gradient
                  </button>
                  <button
                    onClick={() => {
                      setBackgroundType('lines');
                      setMenuOpen(false);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors duration-150 ${
                      backgroundType === 'lines' 
                        ? 'bg-sage-500 text-white border-sage-600' 
                        : 'bg-white dark:bg-warm-gray-700 text-warm-gray-700 dark:text-warm-gray-200 border-warm-gray-300 dark:border-warm-gray-600 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600'
                    }`}
                  >
                    Lines
                  </button>
                  <button
                    onClick={() => {
                      setBackgroundType('dots');
                      setMenuOpen(false);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors duration-150 ${
                      backgroundType === 'dots' 
                        ? 'bg-sage-500 text-white border-sage-600' 
                        : 'bg-white dark:bg-warm-gray-700 text-warm-gray-700 dark:text-warm-gray-200 border-warm-gray-300 dark:border-warm-gray-600 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600'
                    }`}
                  >
                    Dots
                  </button>
                </div>
              </div>
              <div className="border-t border-warm-gray-200 dark:border-warm-gray-600 my-2"></div>
              <button
                onClick={() => {
                  showModal({
                    title: 'Customize Toolbar',
                    content: (
                      <CustomizeToolbar
                        selectedToolbarWidgets={selectedToolbarWidgets}
                        setSelectedToolbarWidgets={setSelectedToolbarWidgets}
                        AllComponentData={AllComponentData}
                        onSave={() => {
                          localStorage.setItem('toolbarWidgets', JSON.stringify(selectedToolbarWidgets));
                          hideModal();
                        }}
                      />
                    )
                  });
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 flex items-center gap-3 text-warm-gray-700 dark:text-warm-gray-200 transition-colors duration-150"
              >
                {React.createElement(FaWrench as any, { className: "w-4 h-4" })}
                <span>Customize Toolbar</span>
              </button>
              <div className="border-t border-warm-gray-200 dark:border-warm-gray-600 my-2"></div>
              <button
                onClick={() => {
                  setDarkMode(!darkMode);
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 flex items-center gap-3 text-warm-gray-700 dark:text-warm-gray-200 transition-colors duration-150"
              >
                {darkMode ? React.createElement(FaSun as any, { className: "w-4 h-4" }) : React.createElement(FaMoon as any, { className: "w-4 h-4" })}
                <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>,
            document.body
          )}
          
          <div className="flex items-center space-x-4 ml-auto">
            <div className="bg-warm-gray-200 dark:bg-warm-gray-900 text-terracotta-600 dark:text-sage-400 px-2.5 py-0.5 rounded font-mono text-sm tracking-wider whitespace-nowrap">
              {formattedTime.split(':').map((part, index) => (
                <React.Fragment key={index}>
                  {index > 0 && (
                    <span className={`${colonVisible ? 'opacity-100' : 'opacity-0'} transition-opacity duration-100`}>
                      :
                    </span>
                  )}
                  <span>{part}</span>
                </React.Fragment>
              ))}
            </div>
            <svg
              id="trash"
              className={`w-5 h-5 cursor-pointer transition-all duration-200 ${
                hoveringTrash 
                  ? 'text-dusty-rose-500 transform scale-125' 
                  : 'text-warm-gray-500 dark:text-warm-gray-400'
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
        </div>
      </div>
      
      {/* Launchpad Dialog */}
      {launchpadOpen && ReactDOM.createPortal(
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999]"
        onClick={() => setLaunchpadOpen(false)}
      >
        <div 
          className="bg-soft-white dark:bg-warm-gray-800 rounded-2xl shadow-2xl p-6 max-w-3xl max-h-[80vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setLaunchpadOpen(false)}
              className="text-warm-gray-500 hover:text-warm-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(WIDGET_TYPES).map(([key, widgetType]) => {
              const component = AllComponentData[widgetType];
              if (!component) return null;
              const Icon = component.icon;
              return (
                <button
                  key={widgetType}
                  onClick={() => {
                    const newId = uuidv4();
                    setComponentList((e) => [...e, { id: newId, index: widgetType }]);
                    setActiveIndex(newId);
                    setLaunchpadOpen(false);
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 transition-colors duration-200 group"
                >
                  <div className={`relative w-16 h-16 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                    [WIDGET_TYPES.RANDOMISER, WIDGET_TYPES.TRAFFIC_LIGHT, WIDGET_TYPES.TEXT_BANNER].includes(widgetType) ? 'bg-dusty-rose-500 group-hover:bg-dusty-rose-600' :
                    [WIDGET_TYPES.TIMER, WIDGET_TYPES.WORK_SYMBOLS, WIDGET_TYPES.IMAGE_DISPLAY].includes(widgetType) ? 'bg-terracotta-500 group-hover:bg-terracotta-600' :
                    'bg-sage-600 group-hover:bg-sage-700'
                  }`}>
                    <Icon className="w-8 h-8 text-white" />
                    {component.requiresServer && (
                      React.createElement(FaWifi as any, { 
                        className: "w-3 h-3 absolute top-1 right-1 text-amber-300" 
                      })
                    )}
                  </div>
                  <span className="text-sm text-warm-gray-700 dark:text-warm-gray-200">{component.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>,
      document.body
    )}
    </div>
    </>
  );

}
