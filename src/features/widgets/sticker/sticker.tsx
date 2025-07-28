import React, { useState } from 'react';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { 
  CustomThumbsUp,
  CustomHeart,
  CustomStar,
  CustomSmile,
  CustomArrowUp,
  CustomLocationDot,
  CustomRainbow,
  CustomCheck
} from './CustomStickerIcons';

interface StickerProps {
  stickerType?: string; // Optional now, can be read from savedState
  savedState?: {
    colorIndex: number;
    stickerType?: string;
    stampType?: string; // For backward compatibility
    rotation?: number;
  };
  onStateChange?: (state: any) => void;
}

const Sticker: React.FC<StickerProps> = ({ stickerType: propStickerType, savedState, onStateChange }) => {
  // Get stickerType from props or savedState, with fallback to 'star'
  const stickerType = propStickerType || savedState?.stickerType || savedState?.stampType || 'star';
  // Initialize with random color if no saved state
  const getRandomColorIndex = () => Math.floor(Math.random() * 6);
  const [colorIndex, setColorIndex] = useState(savedState?.colorIndex ?? getRandomColorIndex());
  const [rotation, setRotation] = useState(savedState?.rotation || 0);
  
  // Subscribe to theme changes
  const theme = useWorkspaceStore((state) => state.theme);

  // Generate random rotation between -40 and 40 in steps of 5
  const getRandomRotation = () => {
    const steps = [];
    for (let i = -40; i <= 40; i += 5) {
      steps.push(i);
    }
    return steps[Math.floor(Math.random() * steps.length)];
  };

  // Ensure stickerType is saved in state on mount
  React.useEffect(() => {
    if (onStateChange && (!savedState || (savedState.stickerType !== stickerType && savedState.stampType !== stickerType))) {
      onStateChange({
        colorIndex: colorIndex,
        stickerType: stickerType,
        rotation: rotation
      });
    }
  }, [stickerType]);

  // Define more vibrant color schemes for cycling
  const colorSchemes = [
    'text-pink-500',      // Bright pink
    'text-orange-500',    // Vibrant orange
    'text-emerald-500',   // Bright green
    'text-blue-500',      // Bright blue
    'text-purple-500',    // Vibrant purple
    'text-yellow-500'     // Bright yellow
  ];

  // Handle click to cycle colors and rotation
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent widget selection
    const newColorIndex = (colorIndex + 1) % colorSchemes.length;
    const newRotation = getRandomRotation();
    
    setColorIndex(newColorIndex);
    setRotation(newRotation);
    
    if (onStateChange) {
      onStateChange({ 
        colorIndex: newColorIndex,
        stickerType: stickerType,  // Preserve the sticker type
        rotation: newRotation
      });
    }
  };

  // Get the appropriate icon based on sticker type
  const getStickerIcon = () => {
    const iconClass = `w-full h-full ${colorSchemes[colorIndex]} transition-colors duration-200`;
    
    // Use theme from store instead of checking DOM
    const borderColor = theme === 'dark' ? '#3d3835' : 'white';
    
    
    // Standardized drop-shadow approach for all icon stamps
    const dropShadowStyle = {
      filter: `
        drop-shadow(2px 0 0 ${borderColor})
        drop-shadow(-2px 0 0 ${borderColor})
        drop-shadow(0 2px 0 ${borderColor})
        drop-shadow(0 -2px 0 ${borderColor})
        drop-shadow(1.5px 1.5px 0 ${borderColor})
        drop-shadow(-1.5px -1.5px 0 ${borderColor})
        drop-shadow(1.5px -1.5px 0 ${borderColor})
        drop-shadow(-1.5px 1.5px 0 ${borderColor})
        drop-shadow(6px 6px 8px rgba(0, 0, 0, 0.3))
      `
    };
    
    const renderIconWithBorder = () => {
      switch (stickerType) {
        case 'thumbsup':
          return React.createElement(CustomThumbsUp, { className: iconClass, style: dropShadowStyle });
        case 'heart':
          return React.createElement(CustomHeart, { className: iconClass, style: dropShadowStyle });
        case 'star':
          return React.createElement(CustomStar, { className: iconClass, style: dropShadowStyle });
        case 'smile':
          return React.createElement(CustomSmile, { className: iconClass, style: dropShadowStyle });
        case 'arrow':
          return React.createElement(CustomArrowUp, { className: iconClass, style: dropShadowStyle });
        case 'marker':
          return React.createElement(CustomLocationDot, { className: iconClass, style: dropShadowStyle });
        case 'fire':
          return React.createElement(CustomRainbow, { className: iconClass, style: dropShadowStyle });
        case 'check':
          return React.createElement(CustomCheck, { className: iconClass, style: dropShadowStyle });
        default:
          return React.createElement(CustomStar, { className: iconClass, style: dropShadowStyle });
      }
    };

    return (
      <div className="relative w-full h-full">
        {/* Special scaling for rainbow icon */}
        {stickerType === 'fire' ? (
          <div className="scale-150">
            {renderIconWithBorder()}
          </div>
        ) : (
          renderIconWithBorder()
        )}
      </div>
    );
  };

  return (
    <div 
      className="w-full h-full cursor-pointer p-4"
      onClick={handleClick}
      title="Click to change color and rotation"
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: 'transform 0.3s ease'
      }}
    >
      {getStickerIcon()}
    </div>
  );
};

export default Sticker;