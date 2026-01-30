// Clock - Displays current time with optional class end time and progress indicator

import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { FaClock, FaXmark } from 'react-icons/fa6';

// Color thresholds (in minutes)
const WARNING_THRESHOLD = 15;
const URGENT_THRESHOLD = 5;

const Clock: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const [showColon, setShowColon] = useState(true);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Blink colon every 500ms
  useEffect(() => {
    const colonTimer = setInterval(() => {
      setShowColon(prev => !prev);
    }, 500);
    return () => clearInterval(colonTimer);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Calculate remaining time
  const getRemainingTime = (): { minutes: number; display: string } | null => {
    if (!endTime) return null;

    const diffMs = endTime.getTime() - time.getTime();
    if (diffMs <= 0) {
      return { minutes: 0, display: 'Time!' };
    }

    const diffMinutes = Math.ceil(diffMs / 60000);
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;

    if (hours > 0) {
      return { minutes: diffMinutes, display: `${hours}h ${mins}m` };
    }
    return { minutes: diffMinutes, display: `${mins}m` };
  };

  // Get color class based on remaining time
  const getColorClass = (): string => {
    const remaining = getRemainingTime();
    if (!remaining) return 'text-warm-gray-600 dark:text-warm-gray-300';

    if (remaining.minutes <= 0) {
      return 'text-dusty-rose-600 dark:text-dusty-rose-400 animate-pulse';
    }
    if (remaining.minutes <= URGENT_THRESHOLD) {
      return 'text-dusty-rose-600 dark:text-dusty-rose-400';
    }
    if (remaining.minutes <= WARNING_THRESHOLD) {
      return 'text-amber-600 dark:text-amber-400';
    }
    return 'text-warm-gray-600 dark:text-warm-gray-300';
  };

  // Set end time from custom time input
  const handleSetCustomTime = () => {
    const hours = parseInt(customHours) || 0;
    const mins = parseInt(customMinutes) || 0;

    if (hours === 0 && mins === 0) return;

    const newEndTime = new Date();
    newEndTime.setHours(hours, mins, 0, 0);

    // If the time is earlier than now, assume it's for tomorrow
    if (newEndTime <= time) {
      newEndTime.setDate(newEndTime.getDate() + 1);
    }

    setEndTime(newEndTime);
    setIsDropdownOpen(false);
    setCustomHours('');
    setCustomMinutes('');
  };

  // Clear end time
  const handleClearEndTime = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEndTime(null);
  };

  // Format current time
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = (hours % 12 || 12).toString();
  const displayMinutes = minutes.toString().padStart(2, '0');

  const remaining = getRemainingTime();
  const colorClass = getColorClass();

  return (
    <div ref={dropdownRef} className="relative">
      {/* Clock Display - Clickable */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={clsx(
          'flex items-center gap-2 font-mono tabular-nums transition-colors duration-300',
          colorClass
        )}
        title={endTime ? `Class ends at ${endTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Click to set class end time'}
      >
        {/* Current Time */}
        <span className="text-sm font-medium">
          {displayHours}
          <span className={showColon ? 'opacity-100' : 'opacity-0'}>:</span>
          {displayMinutes}
          <span className="ml-1 text-xs opacity-75">{ampm}</span>
        </span>

        {/* Remaining Time Badge */}
        {remaining && (
          <>
            <span className="text-warm-gray-400 dark:text-warm-gray-500">·</span>
            <span className={clsx(
              'text-xs font-medium',
              remaining.minutes <= URGENT_THRESHOLD && 'font-bold'
            )}>
              {remaining.display}
            </span>
            {/* Clear button */}
            <button
              onClick={handleClearEndTime}
              className="p-0.5 rounded hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 transition-colors"
              title="Clear end time"
            >
              <FaXmark className="w-2.5 h-2.5 opacity-60 hover:opacity-100" />
            </button>
          </>
        )}
      </button>

      {/* Dropdown for setting end time */}
      {isDropdownOpen && (
        <div className={clsx(
          'absolute top-full left-0 mt-2 w-56',
          'bg-soft-white/95 dark:bg-warm-gray-800/95',
          'backdrop-blur-sm rounded-lg shadow-lg',
          'border border-warm-gray-200 dark:border-warm-gray-700',
          'p-3 z-50'
        )}>
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">
            <FaClock className="w-3.5 h-3.5" />
            <span>Set Class End Time</span>
          </div>

          {/* Custom Time Input */}
          <div>
            <div className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mb-1.5">
              Set end time:
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="23"
                placeholder="HH"
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                className={clsx(
                  'w-12 px-2 py-1 text-sm text-center rounded',
                  'bg-warm-gray-100 dark:bg-warm-gray-700',
                  'border border-warm-gray-300 dark:border-warm-gray-600',
                  'text-warm-gray-800 dark:text-warm-gray-200',
                  'focus:outline-none focus:ring-1 focus:ring-sage-500'
                )}
                onKeyDown={(e) => e.key === 'Enter' && handleSetCustomTime()}
              />
              <span className="text-warm-gray-500">:</span>
              <input
                type="number"
                min="0"
                max="59"
                placeholder="MM"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                className={clsx(
                  'w-12 px-2 py-1 text-sm text-center rounded',
                  'bg-warm-gray-100 dark:bg-warm-gray-700',
                  'border border-warm-gray-300 dark:border-warm-gray-600',
                  'text-warm-gray-800 dark:text-warm-gray-200',
                  'focus:outline-none focus:ring-1 focus:ring-sage-500'
                )}
                onKeyDown={(e) => e.key === 'Enter' && handleSetCustomTime()}
              />
              <button
                onClick={handleSetCustomTime}
                className={clsx(
                  'px-2 py-1 text-xs rounded',
                  'bg-sage-500 hover:bg-sage-600',
                  'text-white',
                  'transition-colors'
                )}
              >
                Set
              </button>
            </div>
          </div>

          {/* Current End Time Display */}
          {endTime && (
            <>
              <div className="h-px bg-warm-gray-200 dark:bg-warm-gray-700 my-3" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-warm-gray-500 dark:text-warm-gray-400">
                  Ends at: {endTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
                <button
                  onClick={handleClearEndTime}
                  className="text-dusty-rose-600 dark:text-dusty-rose-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Clock;
