// Clock - Displays current time in the toolbar

import React, { useState, useEffect } from 'react';

const Clock: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const [showColon, setShowColon] = useState(true);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  useEffect(() => {
    const colonTimer = setInterval(() => {
      setShowColon(prev => !prev);
    }, 500);
    
    return () => clearInterval(colonTimer);
  }, []);
  
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
  const displayMinutes = minutes.toString().padStart(2, '0');
  
  return (
    <div className="flex items-center justify-center gap-1.5 text-warm-gray-600 dark:text-warm-gray-400 font-mono">
      <div className="flex flex-col leading-none">
        <div className="text-base font-semibold leading-tight">{displayHours}</div>
        <div className="text-base font-semibold leading-tight">{displayMinutes}</div>
      </div>
      <div className="flex items-center text-[8px] font-medium self-center">
        {ampm}
      </div>
    </div>
  );
};

export default Clock;