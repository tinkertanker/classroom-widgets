import React from 'react';

interface SmallScreenWarningProps {
  minWidth?: number;
  currentWidth?: number;
  scale?: number;
}

const SmallScreenWarning: React.FC<SmallScreenWarningProps> = ({
  minWidth = 768,
  currentWidth,
  scale = 1
}) => {
  const [internalWidth, setInternalWidth] = React.useState(() => window.innerWidth);
  const windowWidth = currentWidth ?? internalWidth;
  const effectiveWidth = Math.round(windowWidth / (scale || 1));

  React.useEffect(() => {
    if (currentWidth !== undefined) {
      return;
    }

    const handleResize = () => {
      setInternalWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentWidth]);

  return (
    <div className="fixed inset-0 bg-warm-gray-900 text-white flex items-center justify-center p-4 z-[9999]">
      <div className="text-center max-w-md">
        <svg className="w-24 h-24 mx-auto mb-6 text-warm-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h1 className="text-2xl font-bold mb-4">Screen Too Small</h1>
        <p className="text-warm-gray-300 mb-6">
          Classroom Widgets requires a larger screen to function properly.
          Please use a desktop or laptop computer with a minimum screen width of {minWidth} pixels.
        </p>
        <div className="text-sm text-warm-gray-400">
          Current screen width: {Math.round(windowWidth)}px
        </div>
        {scale !== 1 && (
          <div className="text-xs text-warm-gray-500 mt-1">
            Effective width at {Math.round(scale * 100)}%: {effectiveWidth}px
          </div>
        )}
      </div>
    </div>
  );
};

export default SmallScreenWarning;
