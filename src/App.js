import logo from './logo.svg';
import './App.css';
import Jason from './components/jason/json.tsx';
import Arnav from './components/arnav/arnav.tsx';
import Boaz from './components/boaz/boaz.tsx';
import TrafficLight from './components/boaz/boazbutbad.tsx';
import AudioVolumeMonitor from './components/boaz/volumeLevel.tsx';
import ShortenLink from './components/boaz/filename.tsx';
import { ChakraProvider } from '@chakra-ui/react'; import { useEffect } from 'react';
import { createSwapy } from 'swapy';

function App() {
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
              <ChakraProvider>
                <Jason />
            </div>
          </div>

          <div className="section-2" data-swapy-slot="slot2">
            <div className="content-b" data-swapy-item="itemB">
              <Arnav />
            </div>
          </div>

          <div className="section-3" data-swapy-slot="slot3">
            <div className="content-c" data-swapy-item="itemC">
              <Arnav />
            </div>
          </div>

          <div className="section-4" data-swapy-slot="slot4">
            <div className="content-d" data-swapy-item="itemD">
              <Arnav />
            </div>
          </div>
        </div>
        <AudioVolumeMonitor />
        <TrafficLight />
        <ShortenLink />
      </ChakraProvider>
    </header>
    </div >
  );
}

export default App;
