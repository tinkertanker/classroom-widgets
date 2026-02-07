// Clock - Displays current time with optional class end time and progress indicator

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { clsx } from 'clsx';
import { FaClock, FaXmark } from 'react-icons/fa6';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';

// Color thresholds (in minutes)
const WARNING_THRESHOLD = 15;
const URGENT_THRESHOLD = 5;

const Clock: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const [showColon, setShowColon] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('PM');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get persisted class end time from store
  const classEndTime = useWorkspaceStore((state) => state.classEndTime);
  const setClassEndTime = useWorkspaceStore((state) => state.setClassEndTime);

  // Convert timestamp to Date object
  const endTime = useMemo(() => {
    if (!classEndTime) return null;
    return new Date(classEndTime);
  }, [classEndTime]);

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

  // Initialize picker with current end time when dropdown opens
  useEffect(() => {
    if (!isDropdownOpen) return;

    if (endTime) {
      const hours = endTime.getHours();
      setSelectedHour(hours % 12 || 12);
      setSelectedMinute(endTime.getMinutes());
      setSelectedPeriod(hours >= 12 ? 'PM' : 'AM');
    } else {
      // Default to current time + 1 hour (captured once when dropdown opens)
      const defaultTime = new Date();
      defaultTime.setHours(defaultTime.getHours() + 1);
      defaultTime.setMinutes(0);
      const hours = defaultTime.getHours();
      setSelectedHour(hours % 12 || 12);
      setSelectedMinute(0);
      setSelectedPeriod(hours >= 12 ? 'PM' : 'AM');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDropdownOpen]); // Only run when dropdown opens, not on every time tick

  // Set end time from picker
  const handleSetTime = () => {
    let hours24 = selectedHour;
    if (selectedPeriod === 'PM' && selectedHour !== 12) {
      hours24 = selectedHour + 12;
    } else if (selectedPeriod === 'AM' && selectedHour === 12) {
      hours24 = 0;
    }

    const newEndTime = new Date();
    newEndTime.setHours(hours24, selectedMinute, 0, 0);

    // If the time is earlier than now, assume it's for tomorrow
    if (newEndTime <= time) {
      newEndTime.setDate(newEndTime.getDate() + 1);
    }

    setClassEndTime(newEndTime.getTime());
    setIsDropdownOpen(false);
  };

  // Clear end time
  const handleClearEndTime = (e: React.MouseEvent) => {
    e.stopPropagation();
    setClassEndTime(null);
  };

  // Generate quick pick times (nearest half-hour, then 5 more)
  const getQuickPicks = useMemo(() => {
    const picks: Date[] = [];
    const now = new Date();

    // Round up to nearest half-hour
    const mins = now.getMinutes();
    const nextHalfHour = new Date(now);
    if (mins === 0 || mins === 30) {
      // Already on a half-hour, go to next one
      nextHalfHour.setMinutes(mins + 30);
    } else if (mins < 30) {
      nextHalfHour.setMinutes(30);
    } else {
      nextHalfHour.setHours(nextHalfHour.getHours() + 1);
      nextHalfHour.setMinutes(0);
    }
    nextHalfHour.setSeconds(0, 0);

    // Generate 6 half-hour increments
    for (let i = 0; i < 6; i++) {
      const pickTime = new Date(nextHalfHour);
      pickTime.setMinutes(pickTime.getMinutes() + i * 30);
      picks.push(pickTime);
    }

    return picks;
  }, [isDropdownOpen]); // Recalculate when dropdown opens

  // Format quick pick time for display
  const formatQuickPick = (date: Date) => {
    const h = date.getHours();
    const m = date.getMinutes();
    const hour12 = h % 12 || 12;
    const period = h >= 12 ? 'pm' : 'am';
    if (m === 0) {
      return `${hour12}${period}`;
    }
    return `${hour12}:${m.toString().padStart(2, '0')}${period}`;
  };

  // Handle quick pick selection
  const handleQuickPick = (pickTime: Date) => {
    setClassEndTime(pickTime.getTime());
    setIsDropdownOpen(false);
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
          'absolute top-full left-0 mt-2 w-72',
          'bg-soft-white/95 dark:bg-warm-gray-800/95',
          'backdrop-blur-sm rounded-lg shadow-lg',
          'border border-warm-gray-200 dark:border-warm-gray-700',
          'p-4 z-50'
        )}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">
              <FaClock className="w-3.5 h-3.5" />
              <span>Set Class End Time</span>
            </div>
            <button
              onClick={() => setIsDropdownOpen(false)}
              className="p-1 rounded hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 transition-colors"
            >
              <FaXmark className="w-3.5 h-3.5 text-warm-gray-500" />
            </button>
          </div>

          {/* Quick Picks */}
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {getQuickPicks.map((pickTime, index) => (
              <button
                key={index}
                onClick={() => handleQuickPick(pickTime)}
                className={clsx(
                  'px-2 py-1.5 text-sm font-medium rounded-md transition-colors',
                  'bg-warm-gray-100 dark:bg-warm-gray-700',
                  'hover:bg-sage-100 dark:hover:bg-sage-900/30',
                  'text-warm-gray-700 dark:text-warm-gray-300',
                  'hover:text-sage-700 dark:hover:text-sage-400',
                  'border border-warm-gray-200 dark:border-warm-gray-600',
                  'hover:border-sage-300 dark:hover:border-sage-700'
                )}
              >
                {formatQuickPick(pickTime)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px bg-warm-gray-200 dark:bg-warm-gray-700" />
            <span className="text-xs text-warm-gray-400 dark:text-warm-gray-500">or pick a time</span>
            <div className="flex-1 h-px bg-warm-gray-200 dark:bg-warm-gray-700" />
          </div>

          {/* Time Picker */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {/* Hour Select */}
            <select
              value={selectedHour}
              onChange={(e) => setSelectedHour(parseInt(e.target.value))}
              className={clsx(
                'w-16 px-2 py-2 text-lg font-medium text-center rounded-lg appearance-none cursor-pointer',
                'bg-warm-gray-100 dark:bg-warm-gray-700',
                'border border-warm-gray-300 dark:border-warm-gray-600',
                'text-warm-gray-800 dark:text-warm-gray-200',
                'focus:outline-none focus:ring-2 focus:ring-sage-500',
                'hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 transition-colors'
              )}
            >
              {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            <span className="text-2xl font-medium text-warm-gray-500">:</span>

            {/* Minute Select */}
            <select
              value={selectedMinute}
              onChange={(e) => setSelectedMinute(parseInt(e.target.value))}
              className={clsx(
                'w-16 px-2 py-2 text-lg font-medium text-center rounded-lg appearance-none cursor-pointer',
                'bg-warm-gray-100 dark:bg-warm-gray-700',
                'border border-warm-gray-300 dark:border-warm-gray-600',
                'text-warm-gray-800 dark:text-warm-gray-200',
                'focus:outline-none focus:ring-2 focus:ring-sage-500',
                'hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 transition-colors'
              )}
            >
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
              ))}
            </select>

            {/* AM/PM Toggle */}
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setSelectedPeriod('AM')}
                className={clsx(
                  'px-2 py-1 text-xs font-medium rounded-t-md transition-colors',
                  selectedPeriod === 'AM'
                    ? 'bg-sage-500 text-white'
                    : 'bg-warm-gray-100 dark:bg-warm-gray-700 text-warm-gray-600 dark:text-warm-gray-400 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600'
                )}
              >
                AM
              </button>
              <button
                onClick={() => setSelectedPeriod('PM')}
                className={clsx(
                  'px-2 py-1 text-xs font-medium rounded-b-md transition-colors',
                  selectedPeriod === 'PM'
                    ? 'bg-sage-500 text-white'
                    : 'bg-warm-gray-100 dark:bg-warm-gray-700 text-warm-gray-600 dark:text-warm-gray-400 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600'
                )}
              >
                PM
              </button>
            </div>
          </div>

          {/* Set Button */}
          <button
            onClick={handleSetTime}
            className={clsx(
              'w-full py-2 text-sm font-medium rounded-lg',
              'bg-sage-500 hover:bg-sage-600',
              'text-white',
              'transition-colors'
            )}
          >
            Set End Time
          </button>

          {/* Current End Time Display */}
          {endTime && (
            <>
              <div className="h-px bg-warm-gray-200 dark:bg-warm-gray-700 my-3" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-warm-gray-500 dark:text-warm-gray-400">
                  Currently set: {endTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
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
