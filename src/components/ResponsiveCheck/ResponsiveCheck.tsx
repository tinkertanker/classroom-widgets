import React, { useEffect, useState } from 'react';
import { FaChalkboardUser, FaPuzzlePiece } from 'react-icons/fa6';

const ResponsiveCheck: React.FC = () => {
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 768 || window.innerHeight < 600);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  if (!isSmallScreen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-soft-white dark:bg-warm-gray-900 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        {/* Logo */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <FaChalkboardUser className="w-16 h-16 text-sage-500" />
            <FaPuzzlePiece className="w-8 h-8 text-terracotta-500 absolute -bottom-1 -right-1" />
          </div>
        </div>
        
        <h1 className="text-2xl font-semibold text-warm-gray-800 dark:text-warm-gray-200 mb-4">
          Welcome to Classroom Widgets!
        </h1>
        
        <p className="text-warm-gray-600 dark:text-warm-gray-400 mb-4">
          Thank you for visiting Classroom Widgets. This application is designed to enhance classroom 
          engagement with interactive tools for teachers and students.
        </p>
        
        <p className="text-warm-gray-600 dark:text-warm-gray-400 mb-6">
          For the best experience, please access Classroom Widgets from a desktop computer or tablet 
          with a screen width of at least 768px. The interactive widgets and drag-and-drop features 
          require a larger display to function properly.
        </p>
        
        <div className="text-sm text-warm-gray-500 dark:text-warm-gray-500">
          Current screen: {window.innerWidth} × {window.innerHeight}px
        </div>
      </div>
    </div>
  );
};

export default ResponsiveCheck;