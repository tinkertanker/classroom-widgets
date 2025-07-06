import React from 'react';
// @ts-ignore
import { 
  FaThumbsUp, 
  FaHeart, 
  FaStar, 
  FaFaceSmile, 
  FaFaceSurprise,
  FaExclamation,
  FaFire,
  FaCheck
} from 'react-icons/fa6';

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
    { type: 'thumbsup', icon: FaThumbsUp, label: 'Thumbs Up' },
    { type: 'heart', icon: FaHeart, label: 'Heart' },
    { type: 'star', icon: FaStar, label: 'Star' },
    { type: 'smile', icon: FaFaceSmile, label: 'Smile' },
    { type: 'shocked', icon: FaFaceSurprise, label: 'Shocked' },
    { type: 'exclamation', icon: FaExclamation, label: 'Exclaim' },
    { type: 'fire', icon: FaFire, label: 'Fire' },
    { type: 'check', icon: FaCheck, label: 'Check' },
  ];

  return (
    <div className="p-6 max-w-2xl">
      <p className="text-sm text-warm-gray-600 dark:text-warm-gray-300 mb-4">
        Select a sticker type and click anywhere on the board to place it.
      </p>
      
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stickerTypes.map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            onClick={() => {
              setSelectedStickerType(type);
              setStickerMode(true);
              if (onClose) onClose();
            }}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-colors duration-200 ${
              selectedStickerType === type && stickerMode
                ? 'bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500'
                : 'hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 border-2 border-transparent'
            }`}
            title={label}
          >
            {React.createElement(Icon as any, { className: "w-8 h-8 text-warm-gray-700 dark:text-warm-gray-300" })}
            <span className="text-xs text-warm-gray-600 dark:text-warm-gray-400">{label}</span>
          </button>
        ))}
      </div>
      
      <div className="border-t border-warm-gray-200 dark:border-warm-gray-700 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
            {stickerMode ? (
              <span>Sticker mode is active. Press ESC to exit.</span>
            ) : (
              <span>Click a sticker to start stamping.</span>
            )}
          </div>
          {stickerMode && (
            <button
              onClick={() => {
                setStickerMode(false);
                if (onClose) onClose();
              }}
              className="px-3 py-1.5 bg-warm-gray-200 hover:bg-warm-gray-300 dark:bg-warm-gray-700 dark:hover:bg-warm-gray-600 text-warm-gray-700 dark:text-warm-gray-200 text-sm rounded transition-colors duration-200"
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