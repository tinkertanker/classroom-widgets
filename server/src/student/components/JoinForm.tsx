import React, { useState, useEffect } from 'react';
import { FaSun, FaMoon } from 'react-icons/fa6';

interface JoinFormProps {
  onJoin: (code: string, name: string) => Promise<void>;
  defaultName?: string;
  onNameChange?: (name: string) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  isCompact?: boolean;
}

const JoinForm: React.FC<JoinFormProps> = ({ onJoin, defaultName = '', onNameChange, isDarkMode, onToggleDarkMode, isCompact = false }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Update local name when defaultName changes
  useEffect(() => {
    setName(defaultName);
  }, [defaultName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!/^[23456789ACDEFHJKMNPQRTUWXY]{5}$/i.test(code)) {
      setError('Please enter a valid 5-character session code');
      return;
    }

    // Name is now optional, use default if empty
    const finalName = name.trim() || 'Anonymous';

    setIsLoading(true);
    try {
      await onJoin(code, finalName);
      // Clear the code field on success but keep the name
      setCode('');
      // Update parent's name state
      if (onNameChange) {
        onNameChange(finalName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow safe characters
    const value = e.target.value.toUpperCase().replace(/[^23456789ACDEFHJKMNPQRTUWXY]/g, '');
    setCode(value);
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    // Update parent immediately
    if (onNameChange) {
      onNameChange(value);
    }
    // Clear error when user starts typing
    if (error) setError('');
  };

  return (
    <div className={`max-w-full relative ${isCompact ? 'join-form-compact' : ''}`}>
      {/* Dark mode toggle - only visible when not in compact mode */}
      {onToggleDarkMode && !isCompact && (
        <button 
          onClick={onToggleDarkMode}
          className={`bg-soft-white dark:bg-warm-gray-700 border border-warm-gray-200 dark:border-warm-gray-600 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer transition-all duration-200 shadow-sm flex-shrink-0 text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600 hover:scale-105 absolute z-10 top-3 right-0`}
          aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDarkMode ? <FaSun className="w-4 h-4" /> : <FaMoon className="w-4 h-4" />}
        </button>
      )}
      
      {!isCompact && (
        <div className="animate-fadeIn">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-semibold text-warm-gray-700 dark:text-warm-gray-300 m-0 text-center pr-12">Join Classroom Session</h1>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className={`w-full ${isCompact ? 'pr-12' : ''}`}>
        <div className={`flex gap-4 ${isCompact ? 'items-center flex-col sm:flex-row' : 'flex-col sm:flex-row sm:items-end sm:justify-center'}`}>
          {/* Name field - visible in compact mode on mobile, always visible on desktop */}
          <div className={`flex flex-col ${isCompact ? 'flex-1 sm:flex-[0_0_180px] sm:order-1' : 'sm:flex-[0_0_180px] sm:order-1'}`}>
            <label htmlFor="name" className={`text-sm font-semibold text-warm-gray-700 dark:text-warm-gray-300 mb-2 ${isCompact ? 'hidden' : ''}`}>Your Name <span className="font-normal text-warm-gray-600 dark:text-warm-gray-400 text-xs">(optional)</span></label>
            <input
              type="text"
              id="name"
              className={`border border-warm-gray-300 dark:border-warm-gray-600 rounded-md text-base font-medium bg-white dark:bg-warm-gray-700 transition-all duration-200 outline-none text-warm-gray-800 dark:text-warm-gray-200 focus:border-sage-500 focus:shadow-[0_0_0_2px_rgba(94,139,94,0.2)] ${isCompact ? 'py-1 px-2 sm:py-2.5 sm:px-4' : 'py-2.5 px-4'}`}
              placeholder="Enter your name"
              value={name}
              onChange={handleNameChange}
              autoComplete="name"
              maxLength={50}
            />
          </div>
          
          {/* Session code field - hidden in compact mode on mobile, visible on desktop */}
          <div className={`flex flex-col ${isCompact ? 'hidden sm:flex sm:flex-[0_0_160px] sm:order-2 sm:mx-4' : 'sm:flex-[0_0_160px] sm:order-2 sm:mx-4'}`}>
            <label htmlFor="code" className={`text-sm font-semibold text-warm-gray-700 dark:text-warm-gray-300 mb-2 ${isCompact ? 'hidden' : ''}`}>Session Code</label>
            <input
              type="text"
              id="code"
              className={`border border-warm-gray-300 dark:border-warm-gray-600 rounded-md font-bold bg-[#fafafa] dark:bg-warm-gray-700 transition-all duration-200 outline-none text-warm-gray-800 dark:text-warm-gray-200 text-center uppercase tracking-[0.15em] font-mono focus:border-sage-500 focus:shadow-[0_0_0_2px_rgba(94,139,94,0.2)] ${isCompact ? 'py-1 px-2 text-sm h-8 sm:py-2.5 sm:px-4 sm:text-[1.125rem] sm:h-auto' : 'py-2.5 px-4 text-[1.125rem]'}`}
              maxLength={5}
              pattern="[23456789ACDEFHJKMNPQRTUWXY]{5}"
              placeholder="123AB"
              value={code}
              onChange={handleCodeChange}
              required
              autoComplete="off"
              aria-describedby={error ? "error-message" : undefined}
            />
          </div>
          
          {/* Join button - hidden in compact mode on mobile since session code is hidden */}
          <button 
            type="submit" 
            className={`py-2.5 px-4 bg-sage-500 text-white border-0 rounded-md text-sm font-semibold cursor-pointer transition-colors duration-200 outline-none h-auto flex items-center justify-center hover:bg-sage-600 disabled:opacity-50 disabled:cursor-not-allowed ${isCompact ? 'hidden sm:flex py-2 px-4 text-sm h-auto leading-[1.4] sm:flex-[0_0_120px] sm:order-3' : 'sm:flex-[0_0_120px] sm:order-3'}`}
            disabled={isLoading || !code}
          >
            {isLoading ? 'Joining...' : 'Join Session'}
          </button>
        </div>
        
        {error && (
          <div id="error-message" className="bg-dusty-rose-50 text-dusty-rose-700 py-3 px-4 rounded-md text-sm mt-4 border border-dusty-rose-200" role="alert">
            {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default JoinForm;