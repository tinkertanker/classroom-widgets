import logo from './logo.svg';
import './App.css';
import Jason from './components/jason/json.tsx';
import Arnav from './components/arnav/arnav.tsx';
import List from './components/list/list.tsx'
import Boaz from './components/boaz/boaz.js';
import { useEffect, useState } from 'react';
import { createSwapy } from 'swapy';
import Confetti from 'react-confetti';

function App() {
  const [useconfetti, setUseconfetti] = useState(false);

  const toggleConfetti = (hi) => {
    setUseconfetti(hi);
  };

  useEffect(() => {
    const container = document.querySelector('.container');
    const swapy = createSwapy(container, {
      animation: 'dynamic' // or spring or none
    });
    swapy.enable(true);

    // Clean up on unmount
    return () => {
      swapy.enable(false);
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        
        <div className="container">
          <div className="section-1" data-swapy-slot="slot1">
            <div className="content-a" data-swapy-item="itemA">
              <Jason toggleConfetti={toggleConfetti}/>
            </div>
          </div>

          <div className="section-2" data-swapy-slot="slot2">
            <div className="content-b" data-swapy-item="itemB">
              <Arnav />
            </div>
          </div>

          <div className="section-3" data-swapy-slot="slot3">
            <div className="content-c" data-swapy-item="itemC">
              <List toggleConfetti={toggleConfetti} useConfetti={useconfetti} />
            </div>
          </div>

          <div className="section-4" data-swapy-slot="slot4">
            <div className="content-d" data-swapy-item="itemD">
              <Arnav />
            </div>
          </div>
        </div>
      </header>
      {useconfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
          wind={0.01}
          colors={["#FFC700", "#FF0000", "#2E3192", "#41BBC7"]}
          confettiSource={{x: 0, y: 0, w: window.innerWidth, h:0}}
        />
      )}
    </div>
  );
}

export default App;