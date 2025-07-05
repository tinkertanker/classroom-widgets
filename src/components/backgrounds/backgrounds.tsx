import React from 'react';

export type BackgroundType = 'solid' | 'geometric' | 'gradient' | 'paper' | 'lines' | 'dots';

interface BackgroundProps {
  type: BackgroundType;
}

const Background: React.FC<BackgroundProps> = ({ type }) => {
  console.log('Background type:', type);
  switch (type) {
    case 'geometric':
      return (
        <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hexagons" x="0" y="0" width="60" height="70" patternUnits="userSpaceOnUse">
                <polygon points="30,0 60,17.5 60,52.5 30,70 0,52.5 0,17.5" 
                  fill="none" 
                  stroke="#d6d2cc" 
                  strokeWidth="0.5" 
                  opacity="0.1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#f7f5f2" />
            <rect width="100%" height="100%" fill="url(#hexagons)" />
          </svg>
        </div>
      );

    case 'gradient':
      return (
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <div className="absolute inset-0 bg-[#f7f5f2]" />
          <div 
            className="absolute top-0 left-0 w-[60%] h-[60%] blur-3xl" 
            style={{
              background: 'radial-gradient(circle, rgba(168, 195, 168, 0.2) 0%, transparent 70%)'
            }}
          />
          <div 
            className="absolute bottom-0 right-0 w-[50%] h-[50%] blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(217, 167, 157, 0.2) 0%, transparent 70%)'
            }}
          />
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(214, 210, 204, 0.3) 0%, transparent 70%)'
            }}
          />
        </div>
      );

    case 'paper':
      return (
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <div className="absolute inset-0 bg-[#f7f5f2]" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
            <filter id="paper">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise" />
              <feDiffuseLighting in="noise" lightingColor="white" surfaceScale="1">
                <feDistantLight azimuth="45" elevation="60" />
              </feDiffuseLighting>
            </filter>
            <rect width="100%" height="100%" filter="url(#paper)" />
          </svg>
        </div>
      );

    case 'lines':
      return (
        <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <div className="absolute inset-0 bg-[#f7f5f2]" />
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="waves" x="0" y="0" width="400" height="400" patternUnits="userSpaceOnUse">
                <path d="M0,200 Q100,150 200,200 T400,200" 
                  stroke="#d6d2cc" 
                  strokeWidth="0.5" 
                  fill="none" 
                  opacity="0.1"
                />
                <path d="M0,250 Q100,200 200,250 T400,250" 
                  stroke="#a8c3a8" 
                  strokeWidth="0.5" 
                  fill="none" 
                  opacity="0.08"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#waves)" />
          </svg>
        </div>
      );

    case 'dots':
      return (
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="0.5" fill="#d6d2cc" opacity="0.3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#f7f5f2" />
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>
      );

    case 'solid':
    default:
      return <div className="absolute inset-0 bg-[#f7f5f2]" />;
  }
};

export default Background;