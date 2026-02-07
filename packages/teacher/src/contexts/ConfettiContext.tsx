import React, { createContext, useContext, useState, useCallback } from 'react';
import ConfettiExplosion from 'react-confetti-explosion';

interface ConfettiPosition {
  x: number;
  y: number;
}

interface ConfettiExplosion {
  id: number;
  position?: ConfettiPosition;
}

interface ConfettiContextType {
  triggerConfetti: (element?: HTMLElement | null) => void;
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
  const [explosions, setExplosions] = useState<ConfettiExplosion[]>([]);

  const triggerConfetti = useCallback((element?: HTMLElement | null) => {
    const id = Date.now();
    let position: ConfettiPosition | undefined;
    
    if (element) {
      const rect = element.getBoundingClientRect();
      // Position at the top center of the element
      position = {
        x: rect.left + rect.width / 2,
        y: rect.top
      };
    }
    
    setExplosions(prev => [...prev, { id, position }]);
    
    // Remove the explosion after it completes
    setTimeout(() => {
      setExplosions(prev => prev.filter(e => e.id !== id));
    }, 3000);
  }, []);

  return (
    <ConfettiContext.Provider value={{ triggerConfetti }}>
      {children}
      {explosions.map(explosion => (
        <div 
          key={explosion.id}
          style={{ 
            position: 'fixed', 
            top: explosion.position ? `${explosion.position.y}px` : '50%', 
            left: explosion.position ? `${explosion.position.x}px` : '50%', 
            transform: explosion.position ? 'translate(-50%, 0)' : 'translate(-50%, -50%)', 
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