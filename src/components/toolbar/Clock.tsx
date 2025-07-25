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
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  
  return (
    <div className="text-warm-gray-600 dark:text-warm-gray-400 font-mono text-sm">
      {displayHours}
      <span className={showColon ? 'opacity-100' : 'opacity-0'}>:</span>
      {displayMinutes} {ampm}
    </div>
  );
};

export default Clock;