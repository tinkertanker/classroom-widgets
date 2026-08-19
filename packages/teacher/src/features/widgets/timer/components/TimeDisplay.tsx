import React from 'react';
import { cn, text } from '@shared/utils/styles';
import { secondsToTimeSegments } from '../clockTime';

interface TimeDisplayProps {
  time: number;
  isEditing: boolean;
  onPause?: () => void;
}

const getDisplayValues = (time: number) => {
  const { hoursText, minutesText, secondsText } = secondsToTimeSegments(time);

  return [hoursText, minutesText, secondsText];
};

export const TimeDisplay: React.FC<TimeDisplayProps> = ({ time, isEditing, onPause }) => {
  if (isEditing) return null;

  const baseClasses = cn("leading-none font-bold", text.primary);
  const values = getDisplayValues(time);

  return (
    <div className="flex items-center justify-center w-full h-full cursor-pointer" onClick={onPause}>
      {time >= 3600 ? (
        <div className="flex items-center" style={{ fontSize: 'clamp(1rem, 12cqmin, 3rem)' }}>
          <span className={baseClasses}>{values[0]}</span>
          <span className={baseClasses}>:</span>
          <span className={baseClasses}>{values[1]}</span>
          <span className={baseClasses}>:</span>
          <span className={baseClasses}>{values[2]}</span>
        </div>
      ) : time >= 60 ? (
        <div className="flex items-center" style={{ fontSize: 'clamp(1.5rem, 20cqmin, 5rem)' }}>
          <span className={baseClasses}>{values[1]}</span>
          <span className={baseClasses}>:</span>
          <span className={baseClasses}>{values[2]}</span>
        </div>
      ) : (
        <div className="flex items-center" style={{ fontSize: 'clamp(2rem, 28cqmin, 7rem)' }}>
          <span className={baseClasses}>{time}</span>
        </div>
      )}
    </div>
  );
};
