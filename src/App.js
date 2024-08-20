import logo from './logo.svg';
import './App.css';
import Jason from './components/jason/json.tsx';
import Arnav from './components/arnav/arnav.tsx';
import Boaz from './components/boaz/boaz.js';

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
        <Jason />
        <Arnav />
        <Boaz />
      </header>
    </div>
  );
}

export default App;
