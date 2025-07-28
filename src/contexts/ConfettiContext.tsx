import React, { createContext, useContext, useState, useCallback } from 'react';
import ConfettiExplosion from 'react-confetti-explosion';

interface ConfettiContextType {
  triggerConfetti: () => void;
}

const ConfettiContext = createContext<ConfettiContextType | undefined>(undefined);

export const useConfetti = () => {
  const context = useContext(ConfettiContext);
  if (!context) {
    throw new Error('useConfetti must be used within a ConfettiProvider');
  }
  return context;
};

interface ConfettiProviderProps {
  children: React.ReactNode;
}

export const ConfettiProvider: React.FC<ConfettiProviderProps> = ({ children }) => {
  const [explosions, setExplosions] = useState<number[]>([]);

  const triggerConfetti = useCallback(() => {
    const id = Date.now();
    setExplosions(prev => [...prev, id]);
    
    // Remove the explosion after it completes
    setTimeout(() => {
      setExplosions(prev => prev.filter(e => e !== id));
    }, 3000);
  }, []);

  return (
    <ConfettiContext.Provider value={{ triggerConfetti }}>
      {children}
      {explosions.map(id => (
        <div 
          key={id}
          style={{ 
            position: 'fixed', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)', 
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        >
          <ConfettiExplosion
            force={0.8}
            duration={3000}
            particleCount={200}
            width={1600}
          />
        </div>
      ))}
    </ConfettiContext.Provider>
  );
};