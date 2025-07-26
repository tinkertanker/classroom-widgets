import React, { useState, useEffect, useRef } from 'react';
import { WIDGET_TYPES } from '../../constants/widgetTypes';
// import { useSessionContext } from '../../contexts/SessionContext'; // Removed - not used in new architecture
import { 
  FaDice,
  FaClock,
  FaListCheck,
  FaUserGroup,
  FaTrafficLight,
  FaVolumeHigh,
  FaLink,
  FaTextWidth,
  FaImage,
  FaMusic,
  FaChartColumn,
  FaQrcode,
  FaPaperclip,
  FaVideo,
  FaGauge,
  FaTableCells,
  FaCircleQuestion,
  FaWifi
} from 'react-icons/fa6';

interface LaunchpadDialogProps {
  onAddWidget: (widgetType: number) => void;
  onClose: () => void;
  serverConnected: boolean;
}

const getWidgetIcon = (widgetType: number): React.ReactElement => {
  switch (widgetType) {
    case WIDGET_TYPES.RANDOMISER: return <FaDice />;
    case WIDGET_TYPES.TIMER: return <FaClock />;
    case WIDGET_TYPES.LIST: return <FaListCheck />;
    case WIDGET_TYPES.TASK_CUE: return <FaUserGroup />;
    case WIDGET_TYPES.TRAFFIC_LIGHT: return <FaTrafficLight />;
    case WIDGET_TYPES.SOUND_MONITOR: return <FaVolumeHigh />;
    case WIDGET_TYPES.LINK_SHORTENER: return <FaLink />;
    case WIDGET_TYPES.TEXT_BANNER: return <FaTextWidth />;
    case WIDGET_TYPES.IMAGE_DISPLAY: return <FaImage />;
    case WIDGET_TYPES.SOUND_EFFECTS: return <FaMusic />;
    case WIDGET_TYPES.POLL: return <FaChartColumn />;
    case WIDGET_TYPES.QRCODE: return <FaQrcode />;
    case WIDGET_TYPES.LINK_SHARE: return <FaPaperclip />;
    case WIDGET_TYPES.VISUALISER: return <FaVideo />;
    case WIDGET_TYPES.RT_FEEDBACK: return <FaGauge />;
    case WIDGET_TYPES.TIC_TAC_TOE: return <FaTableCells />;
    case WIDGET_TYPES.QUESTIONS: return <FaCircleQuestion />;
    default: return <FaDice />;
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
  [WIDGET_TYPES.LINK_SHARE]: "Link Share",
  [WIDGET_TYPES.VISUALISER]: "Visualiser",
  [WIDGET_TYPES.RT_FEEDBACK]: "RT Feedback",
  [WIDGET_TYPES.TIC_TAC_TOE]: "Tic-Tac-Toe",
  [WIDGET_TYPES.QUESTIONS]: "Questions"
};

const widgetDescriptions: Record<number, string> = {
  [WIDGET_TYPES.RANDOMISER]: "Pick random names or items",
  [WIDGET_TYPES.TIMER]: "Count down or track time",
  [WIDGET_TYPES.LIST]: "Create and check off tasks",
  [WIDGET_TYPES.TASK_CUE]: "Visual work mode indicators",
  [WIDGET_TYPES.TRAFFIC_LIGHT]: "Show status with colors",
  [WIDGET_TYPES.SOUND_MONITOR]: "Monitor classroom noise",
  [WIDGET_TYPES.LINK_SHORTENER]: "Create short URLs",
  [WIDGET_TYPES.TEXT_BANNER]: "Display custom text",
  [WIDGET_TYPES.IMAGE_DISPLAY]: "Show images on screen",
  [WIDGET_TYPES.SOUND_EFFECTS]: "Play sound effects",
  [WIDGET_TYPES.POLL]: "Live polls with students",
  [WIDGET_TYPES.QRCODE]: "Generate QR codes",
  [WIDGET_TYPES.LINK_SHARE]: "Collect links from students",
  [WIDGET_TYPES.VISUALISER]: "Visual effects display",
  [WIDGET_TYPES.RT_FEEDBACK]: "Real-time feedback",
  [WIDGET_TYPES.TIC_TAC_TOE]: "Play tic-tac-toe game",
  [WIDGET_TYPES.QUESTIONS]: "Collect student questions"
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
  WIDGET_TYPES.LINK_SHARE,
  WIDGET_TYPES.VISUALISER,
  WIDGET_TYPES.RT_FEEDBACK,
  WIDGET_TYPES.TIC_TAC_TOE,
  WIDGET_TYPES.QUESTIONS
];

// Widget categories for visual grouping
const widgetCategories: Record<string, number[]> = {
  'Classroom Management': [
    WIDGET_TYPES.RANDOMISER,
    WIDGET_TYPES.TIMER,
    WIDGET_TYPES.LIST,
    WIDGET_TYPES.TASK_CUE,
    WIDGET_TYPES.TRAFFIC_LIGHT,
    WIDGET_TYPES.SOUND_MONITOR
  ],
  'Interactive': [
    WIDGET_TYPES.POLL,
    WIDGET_TYPES.QUESTIONS,
    WIDGET_TYPES.LINK_SHARE,
    WIDGET_TYPES.RT_FEEDBACK,
    WIDGET_TYPES.TIC_TAC_TOE
  ],
  'Display & Media': [
    WIDGET_TYPES.TEXT_BANNER,
    WIDGET_TYPES.IMAGE_DISPLAY,
    WIDGET_TYPES.SOUND_EFFECTS,
    WIDGET_TYPES.VISUALISER
  ],
  'Utilities': [
    WIDGET_TYPES.LINK_SHORTENER,
    WIDGET_TYPES.QRCODE
  ]
};

const LaunchpadDialog: React.FC<LaunchpadDialogProps> = ({ onAddWidget, onClose, serverConnected }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const session = useSessionContext();

  // List of networked widget types
  const networkedWidgets = [
    WIDGET_TYPES.POLL,
    WIDGET_TYPES.LINK_SHARE,
    WIDGET_TYPES.RT_FEEDBACK,
    WIDGET_TYPES.QUESTIONS
  ];

  // Helper functions defined first
  const isWidgetDisabled = (widgetType: number) => {
    return networkedWidgets.includes(widgetType) && !session.isConnected;
  };

  const isWidgetVisible = (widgetType: number) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const widgetName = widgetNames[widgetType].toLowerCase();
    const widgetDesc = widgetDescriptions[widgetType].toLowerCase();
    return widgetName.includes(query) || widgetDesc.includes(query);
  };

  const handleWidgetClick = (widgetType: number) => {
    onAddWidget(widgetType);
  };

  useEffect(() => {
    // Auto-focus the search input when dialog opens with a slight delay
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Get visible widgets based on search
  const visibleWidgets = React.useMemo(
    () => allWidgets.filter(widgetType => isWidgetVisible(widgetType)),
    [searchQuery, serverConnected]
  );

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Reset hovered index when search changes
  useEffect(() => {
    setHoveredIndex(-1);
  }, [searchQuery]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 relative flex flex-col h-[600px] max-h-[80vh] p-6">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Flex container */}
      <div className="flex flex-col-reverse h-full gap-4 overflow-hidden">

        {/* Search input  */}
        <div className="">
          {/* Server status - only show if offline */}
          {!session.isConnected && (
            <div className="mb-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-800 text-xs">
                <FaWifi className="w-4 h-4" />
                <span className="font-medium">Some widgets require server connection</span>
              </div>
            </div>
          )}
          {searchQuery && (
            <div className="mb-2 flex items-center text-sm animate-in fade-in-0 slide-in-from-top-1 duration-200">
              <div className={`flex items-center transition-colors duration-300 ${
                visibleWidgets.length === 0 ? 'text-dusty-rose-600 dark:text-dusty-rose-400' : 'text-sage-600 dark:text-sage-400'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 transition-colors duration-300 ${
                  visibleWidgets.length === 0 ? 'bg-dusty-rose-500' : 'bg-sage-500'
                }`} />
                {visibleWidgets.length === 0 
                  ? 'No matches found'
                  : `${visibleWidgets.length} widget${visibleWidgets.length !== 1 ? 's' : ''} found`
                }
              </div>
            </div>
          )}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-warm-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search widgets by name or function..."
              className="w-full pl-11 pr-4 py-2.5 text-base rounded-xl border-2 border-warm-gray-200 dark:border-warm-gray-600 
                       bg-white dark:bg-warm-gray-800 text-warm-gray-800 dark:text-warm-gray-200
                       focus:outline-none focus:border-sage-500 dark:focus:border-sage-400 focus:ring-4 focus:ring-sage-500/10 dark:focus:ring-sage-400/10
                       placeholder-warm-gray-400 dark:placeholder-warm-gray-500 transition-all duration-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-warm-gray-400 hover:text-warm-gray-600 dark:hover:text-warm-gray-300 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Widget grid container  */}
        <div className="flex-1 min-h-0">
          <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-warm-gray-300 dark:scrollbar-thumb-warm-gray-600 hover:scrollbar-thumb-warm-gray-400 dark:hover:scrollbar-thumb-warm-gray-500 scrollbar-track-transparent flex flex-col-reverse px-2">
            <div className="flex flex-col-reverse min-h-full">
              <div className="grid grid-cols-4 gap-2.5 py-2 auto-rows-min">
            {visibleWidgets.length === 0 ? (
              <div className="col-span-4 py-12 text-center animate-in fade-in-0 zoom-in-95 duration-300">
                <div className="mb-4 flex justify-center">
                  <svg className="w-16 h-16 text-warm-gray-300 dark:text-warm-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-warm-gray-600 dark:text-warm-gray-400 mb-2">
                  No widgets match "{searchQuery}"
                </p>
                <p className="text-sm text-warm-gray-500 dark:text-warm-gray-500">
                  Try a different search term
                </p>
              </div>
            ) : visibleWidgets.map((widgetType, index) => {
              const isDisabled = isWidgetDisabled(widgetType);
              const isHovered = index === hoveredIndex;

              return (
                <button
                  key={widgetType}
                  onClick={() => !isDisabled && handleWidgetClick(widgetType)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(-1)}
                  className={`
                    group relative flex flex-col items-center p-2.5 rounded-xl transition-all duration-300 transform
                    ${isDisabled 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'cursor-pointer hover:scale-[1.03] hover:shadow-lg'
                    }
                    ${isHovered
                      ? 'bg-gradient-to-br from-sage-50 to-sage-100 dark:from-sage-900/20 dark:to-sage-800/20 ring-2 ring-sage-500 shadow-lg scale-[1.05] z-10'
                      : 'bg-warm-gray-50 dark:bg-warm-gray-800 hover:bg-gradient-to-br hover:from-warm-gray-50 hover:to-warm-gray-100 dark:hover:from-warm-gray-800 dark:hover:to-warm-gray-700'
                    }
                    border-2 ${isHovered ? 'border-sage-500' : 'border-transparent'}
                    animate-in fade-in-0 slide-in-from-bottom-2 duration-300
                  `}
                  disabled={isDisabled}
                  title={widgetNames[widgetType]}
                  tabIndex={-1}
                >
                  {networkedWidgets.includes(widgetType) && (
                    <div className={`absolute top-2 right-2 flex items-center justify-center ${
                      session.isConnected 
                        ? 'text-sage-500' 
                        : 'text-dusty-rose-500'
                    }`}
                         title={session.isConnected ? "Server connected" : "Server offline"}>
                      <FaWifi className="w-4 h-4" />
                    </div>
                  )}
                  <div className={`text-3xl mb-2 transition-all duration-300 ${
                    isHovered
                      ? 'text-sage-600 dark:text-sage-400 transform scale-110'
                      : 'text-warm-gray-600 dark:text-warm-gray-400 group-hover:text-warm-gray-700 dark:group-hover:text-warm-gray-300'
                  }`}>
                    {getWidgetIcon(widgetType)}
                  </div>
                  <div className="text-center space-y-0.5">
                    <span className={`text-sm font-semibold block transition-colors duration-300 ${
                      isHovered
                        ? 'text-sage-700 dark:text-sage-300'
                        : 'text-warm-gray-700 dark:text-warm-gray-200'
                    }`}>
                      {widgetNames[widgetType]}
                    </span>
                    <span className="text-xs text-warm-gray-500 dark:text-warm-gray-400 block leading-tight">
                      {widgetDescriptions[widgetType]}
                    </span>
                  </div>
                  {/* Hover effect overlay */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-transparent to-sage-500/5 dark:to-sage-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </button>
              );
            })}
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};

export default LaunchpadDialog;