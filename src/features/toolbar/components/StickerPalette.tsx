import React from 'react';
import { 
  CustomThumbsUp,
  CustomHeart,
  CustomStar,
  CustomSmile,
  CustomArrowUp,
  CustomLocationDot,
  CustomRainbow,
  CustomCheck
} from '../../widgets/sticker/CustomStickerIcons';

interface StickerPaletteProps {
  selectedStickerType: string;
  setSelectedStickerType: (type: string) => void;
  setStickerMode: (mode: boolean) => void;
  stickerMode: boolean;
  onClose?: () => void;
}

const StickerPalette: React.FC<StickerPaletteProps> = ({
  selectedStickerType,
  setSelectedStickerType,
  setStickerMode,
  stickerMode,
  onClose
}) => {
  const stickerTypes = [
    { type: 'thumbsup', icon: CustomThumbsUp, label: 'Thumbs Up' },
    { type: 'heart', icon: CustomHeart, label: 'Heart' },
    { type: 'star', icon: CustomStar, label: 'Star' },
    { type: 'smile', icon: CustomSmile, label: 'Smile' },
    { type: 'arrow', icon: CustomArrowUp, label: 'Arrow' },
    { type: 'marker', icon: CustomLocationDot, label: 'Marker' },
    { type: 'fire', icon: CustomRainbow, label: 'Rainbow' },
    { type: 'check', icon: CustomCheck, label: 'Check' },
  ];

  const iconColor = 'text-warm-gray-600 dark:text-warm-gray-400';

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-center mb-2 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
        🎨 Choose Your Sticker! 🎉
      </h2>
      <p className="text-center text-warm-gray-600 dark:text-warm-gray-400 mb-6">
        Click a sticker to start decorating!
      </p>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stickerTypes.map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            onClick={() => {
              setSelectedStickerType(type);
              setStickerMode(true);
              // Also set the global sticker mode with the type
              (window as any).setStickerMode?.(true, type);
              if (onClose) onClose();
            }}
            className={`group relative flex items-center justify-center p-4 rounded-xl transition-all duration-300 transform hover:scale-110 ${
              selectedStickerType === type && stickerMode
                ? 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-500 shadow-lg shadow-amber-200 dark:shadow-amber-900/50 scale-110'
                : 'hover:bg-gradient-to-br hover:from-warm-gray-50 hover:to-warm-gray-100 dark:hover:from-warm-gray-700 dark:hover:to-warm-gray-600 border-2 border-warm-gray-200 dark:border-warm-gray-600 hover:border-warm-gray-300 dark:hover:border-warm-gray-500 hover:shadow-md'
            }`}
            title={label}
          >
            <div className="transition-transform duration-200 group-hover:rotate-12">
              {React.createElement(Icon as any, {
                className: `w-12 h-12 ${iconColor} transition-all duration-200 group-hover:drop-shadow-lg`,
                style: (type === 'fire' || type === 'smile') ? { filter: 'grayscale(100%)' } : undefined
              })}
            </div>
            {selectedStickerType === type && stickerMode && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold animate-bounce">
                ✓
              </div>
            )}
          </button>
        ))}
      </div>
      
      <div className="border-t border-warm-gray-200 dark:border-warm-gray-700 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400 flex items-center gap-2">
            {stickerMode && (
              <>
                <span className="animate-pulse">🎯</span>
                <span>Click anywhere to place stickers! Press S to exit.</span>
              </>
            )}
          </div>
          {stickerMode && (
            <button
              onClick={() => {
                setStickerMode(false);
                if (onClose) onClose();
              }}
              className="px-4 py-2 bg-gradient-to-r from-dusty-rose-500 to-dusty-rose-600 hover:from-dusty-rose-600 hover:to-dusty-rose-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md"
            >
              Exit Sticker Mode
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StickerPalette;