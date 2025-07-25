import React, { useRef, useEffect } from 'react';
import { FaSun, FaMoon } from 'react-icons/fa6';
import { ConnectionIndicator } from '../common';
import { useUIStore } from '../../store/uiStore';
import { useSessionStore } from '../../store/sessionStore';
import { useConnectionStore } from '../../store/connectionStore';

interface HeaderProps {
  onJoinSession?: () => void;
  onLeaveSession?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onJoinSession, onLeaveSession }) => {
  const headerRef = useRef<HTMLDivElement>(null);
  const { isDarkMode, toggleDarkMode, isScrolled, setScrolled, setHeaderHeight } = useUIStore();
  const { currentSession } = useSessionStore();
  const { isConnected } = useConnectionStore();
  
  // Constants for header behavior
  const SCROLL_THRESHOLD_ENTER = 100;
  const SCROLL_THRESHOLD_EXIT = 50;
  const COMPACT_HEADER_HEIGHT_MOBILE = 56;
  
  // Handle scroll state
  useEffect(() => {
    let rafId: number | null = null;
    
    const handleScroll = () => {
      if (rafId) return;
      
      rafId = requestAnimationFrame(() => {
        const scrollPosition = window.scrollY;
        
        if (!isScrolled && scrollPosition > SCROLL_THRESHOLD_ENTER) {
          setScrolled(true);
        } else if (isScrolled && scrollPosition < SCROLL_THRESHOLD_EXIT) {
          setScrolled(false);
        }
        
        rafId = null;
      });
    };
    
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isScrolled, setScrolled]);
  
  // Update header height
  useEffect(() => {
    if (!headerRef.current) return;
    
    const updateHeaderHeight = () => {
      if (!headerRef.current) return;
      
      const height = headerRef.current.offsetHeight;
      const isMobile = window.innerWidth <= 640;
      
      const finalHeight = (isMobile && isScrolled) 
        ? COMPACT_HEADER_HEIGHT_MOBILE 
        : height;
        
      setHeaderHeight(finalHeight);
    };
    
    const resizeObserver = new ResizeObserver(updateHeaderHeight);
    resizeObserver.observe(headerRef.current);
    
    window.addEventListener('resize', updateHeaderHeight);
    updateHeaderHeight();
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, [isScrolled, setHeaderHeight]);
  
  return (
    <div 
      ref={headerRef}
      className={`
        fixed top-0 left-0 right-0 z-[100] 
        bg-soft-white dark:bg-warm-gray-800 rounded-b-lg 
        border border-warm-gray-200 dark:border-warm-gray-700 border-t-0
        transition-all duration-300 ease-in-out
        ${isScrolled ? 'p-2 md:px-4 shadow-md' : 'p-4 shadow-sm'}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {!isScrolled ? (
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-warm-gray-700 dark:text-warm-gray-300 text-center">
                {currentSession ? (
                  <div className="flex items-center justify-center gap-2">
                    <ConnectionIndicator isConnected={isConnected} size="md" showLabel={false} />
                    <span>Connected to session {currentSession.code}</span>
                  </div>
                ) : (
                  'Join Classroom Session'
                )}
              </h1>
              {currentSession && (
                <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400 text-center mt-2">
                  Leave to join a different session.
                </p>
              )}
            </div>
          ) : (
            currentSession && (
              <div className="flex items-center justify-center gap-2">
                <ConnectionIndicator isConnected={isConnected} size="sm" showLabel={false} />
                <h2 className="text-base font-semibold text-warm-gray-700 dark:text-warm-gray-300">
                  Connected to session {currentSession.code}
                </h2>
              </div>
            )
          )}
        </div>
        
        {/* Dark mode toggle */}
        {!isScrolled && (
          <button 
            onClick={toggleDarkMode}
            className="bg-soft-white dark:bg-warm-gray-700 border border-warm-gray-200 dark:border-warm-gray-600 rounded-full w-9 h-9 flex items-center justify-center transition-all duration-200 shadow-sm text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600 hover:scale-105"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? <FaSun className="w-4 h-4" /> : <FaMoon className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
};

export default Header;