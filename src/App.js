import logo from './logo.svg';
import './App.css';
import Jason from './components/jason/json.tsx';
import Arnav from './components/arnav/arnav.tsx';
import Boaz from './components/boaz/boaz.tsx';
import TrafficLight from './components/boaz/boazbutbad.tsx';
import AudioVolumeMonitor from './components/boaz/volumeLevel.tsx';
import ShortenLink from './components/boaz/filename.tsx';
import { Box, ChakraProvider, Heading } from '@chakra-ui/react'; import { useEffect } from 'react';
import { createSwapy } from 'swapy';
import InitialPopup from './components/boaz/InitialPopup.tsx';
function App() {
  return (
    <Box className="App" width="100%">
      <Heading className="App-header" width="100%" >
        <ChakraProvider>
          <InitialPopup />
          <Boaz />
          <AudioVolumeMonitor />
          <TrafficLight />
          <ShortenLink />
        </ChakraProvider>
      </Heading>
    </Box >
  );
}

export default App;
