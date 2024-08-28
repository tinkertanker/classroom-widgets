import logo from './logo.svg';
import './App.css';
import Jason from './components/jason/json.js';
import Arnav from './components/arnav/arnav.js';
import Boaz from './components/boaz/boaz.tsx';
import TrafficLight from './components/boaz/boazbutbad.tsx';
import AudioVolumeMonitor from './components/boaz/volumeLevel.tsx';
import ShortenLink from './components/boaz/filename.tsx';
import { ChakraProvider } from '@chakra-ui/react';
function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          hello world! <br></br>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        <ChakraProvider>
          <Jason />
          <Arnav />
          <Boaz />
          <AudioVolumeMonitor />
          <TrafficLight />
          <ShortenLink />
        </ChakraProvider>
      </header>
    </div>
  );
}

export default App;
