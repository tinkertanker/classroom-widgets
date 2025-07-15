import React from 'react';
import lowpolyBg from './lowpoly-bg.jpg';
import seawaveBg from './seawave-bg.jpg';

export type BackgroundType = 'geometric' | 'gradient' | 'lines' | 'dots' | 'lowpoly' | 'seawave';

interface BackgroundProps {
  type: BackgroundType;
}

const Background: React.FC<BackgroundProps> = ({ type }) => {
  // Use state to track dark mode changes
  const [isDarkMode, setIsDarkMode] = React.useState(
    document.documentElement.classList.contains('dark')
  );

  React.useEffect(() => {
    // Observer to detect dark mode class changes
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);
  
  switch (type) {
    case 'geometric':
      return (
        <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hexagons" x="0" y="0" width="60" height="70" patternUnits="userSpaceOnUse">
                <polygon points="30,0 60,17.5 60,52.5 30,70 0,52.5 0,17.5" 
                  fill="none" 
                  stroke="var(--pattern-sage)" 
                  strokeWidth="1" 
                  opacity={isDarkMode ? "0.2" : "0.3"}
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="var(--bg-main)" />
            <rect width="100%" height="100%" fill="url(#hexagons)" />
          </svg>
        </div>
      );

    case 'gradient':
      return (
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-main)' }} />
          
          {/* Layer 1: Dusty rose gradient */}
          <div 
            className="absolute top-0 left-0 w-[80%] h-[80%] blur-3xl opacity-40" 
            style={{
              background: isDarkMode 
                ? 'radial-gradient(ellipse at top left, rgba(212, 132, 122, 0.3) 0%, rgba(168, 105, 97, 0.2) 40%, transparent 70%)'
                : 'radial-gradient(ellipse at top left, rgba(227, 155, 147, 0.3) 0%, rgba(212, 132, 122, 0.2) 40%, transparent 70%)'
            }}
          />
          
          {/* Layer 2: Sage gradient */}
          <div 
            className="absolute bottom-0 right-0 w-[70%] h-[70%] blur-3xl opacity-40"
            style={{
              background: isDarkMode
                ? 'radial-gradient(ellipse at bottom right, rgba(94, 139, 94, 0.3) 0%, rgba(74, 109, 74, 0.2) 40%, transparent 70%)'
                : 'radial-gradient(ellipse at bottom right, rgba(168, 195, 168, 0.3) 0%, rgba(138, 161, 138, 0.2) 40%, transparent 70%)'
            }}
          />
          
          {/* Layer 3: Terracotta gradient */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] blur-3xl opacity-30"
            style={{
              background: isDarkMode
                ? 'radial-gradient(circle at center, rgba(217, 167, 157, 0.25) 0%, rgba(186, 130, 119, 0.2) 30%, transparent 60%)'
                : 'radial-gradient(circle at center, rgba(237, 192, 183, 0.25) 0%, rgba(217, 167, 157, 0.2) 30%, transparent 60%)'
            }}
          />
          
          {/* Layer 4: Warm gray accent */}
          <div 
            className="absolute top-[20%] right-[20%] w-[40%] h-[40%] blur-2xl opacity-30"
            style={{
              background: isDarkMode
                ? 'radial-gradient(circle, rgba(214, 210, 204, 0.2) 0%, transparent 60%)'
                : 'radial-gradient(circle, rgba(242, 238, 232, 0.2) 0%, transparent 60%)'
            }}
          />
        </div>
      );

    case 'lines':
      return (
        <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-main)' }} />
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="waves" x="0" y="0" width="400" height="400" patternUnits="userSpaceOnUse">
                <path d="M0,50 Q100,25 200,50 T400,50" 
                  stroke="var(--pattern-sage)" 
                  strokeWidth="2" 
                  fill="none" 
                  opacity={isDarkMode ? "0.2" : "0.4"}
                />
                <path d="M0,100 Q100,75 200,100 T400,100" 
                  stroke="var(--pattern-terracotta)" 
                  strokeWidth="1.5" 
                  fill="none" 
                  opacity={isDarkMode ? "0.15" : "0.35"}
                />
                <path d="M0,150 Q100,125 200,150 T400,150" 
                  stroke="var(--pattern-gray)" 
                  strokeWidth="1.5" 
                  fill="none" 
                  opacity={isDarkMode ? "0.2" : "0.4"}
                />
                <path d="M0,200 Q100,175 200,200 T400,200" 
                  stroke="var(--pattern-sage)" 
                  strokeWidth="2" 
                  fill="none" 
                  opacity={isDarkMode ? "0.25" : "0.45"}
                />
                <path d="M0,250 Q100,225 200,250 T400,250" 
                  stroke="var(--pattern-terracotta)" 
                  strokeWidth="1.5" 
                  fill="none" 
                  opacity={isDarkMode ? "0.15" : "0.3"}
                />
                <path d="M0,300 Q100,275 200,300 T400,300" 
                  stroke="var(--pattern-gray)" 
                  strokeWidth="1" 
                  fill="none" 
                  opacity={isDarkMode ? "0.15" : "0.35"}
                />
                <path d="M0,350 Q100,325 200,350 T400,350" 
                  stroke="var(--pattern-sage)" 
                  strokeWidth="1.5" 
                  fill="none" 
                  opacity={isDarkMode ? "0.2" : "0.3"}
                />
                <path d="M0,25 Q100,50 200,25 T400,25" 
                  stroke="var(--pattern-terracotta)" 
                  strokeWidth="1" 
                  fill="none" 
                  opacity={isDarkMode ? "0.1" : "0.25"}
                />
                <path d="M0,375 Q100,350 200,375 T400,375" 
                  stroke="var(--pattern-gray)" 
                  strokeWidth="1.5" 
                  fill="none" 
                  opacity={isDarkMode ? "0.15" : "0.3"}
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
              <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="15" cy="15" r="3" fill="var(--pattern-sage)" opacity={isDarkMode ? "0.4" : "0.6"} />
                <circle cx="0" cy="0" r="2" fill="var(--pattern-terracotta)" opacity={isDarkMode ? "0.3" : "0.5"} />
                <circle cx="30" cy="0" r="2" fill="var(--pattern-terracotta)" opacity={isDarkMode ? "0.3" : "0.5"} />
                <circle cx="0" cy="30" r="2" fill="var(--pattern-terracotta)" opacity={isDarkMode ? "0.3" : "0.5"} />
                <circle cx="30" cy="30" r="2" fill="var(--pattern-terracotta)" opacity={isDarkMode ? "0.3" : "0.5"} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="var(--bg-main)" />
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>
      );

    case 'lowpoly':
      return (
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat" 
            style={{ 
              backgroundImage: `url(${lowpolyBg})`,
              filter: isDarkMode ? 'brightness(0.7)' : 'brightness(1)'
            }} 
          />
          <div 
            className="absolute inset-0" 
            style={{ 
              backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)' 
            }} 
          />
        </div>
      );

    case 'seawave':
      return (
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat" 
            style={{ 
              backgroundImage: `url(${seawaveBg})`,
              filter: isDarkMode ? 'brightness(0.6) contrast(0.9)' : 'brightness(1)'
            }} 
          />
          <div 
            className="absolute inset-0" 
            style={{ 
              backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.05)' 
            }} 
          />
        </div>
      );

    default:
      return (
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-main)' }} />
        </div>
      );
  }
};

export default Background;