// Loaded into sandboxed renderers (host, launcher, widget panels): only the
// sandboxed preload API is available, i.e. `electron` renderer modules and a
// limited `process`. A sandboxed renderer skips starting Node.js, which makes
// each one start faster and use less memory.
import { contextBridge, ipcRenderer } from 'electron';

const args = process.argv;
const versionArg = args.find((arg) => arg.startsWith('--classroom-app-version='));
const appVersion = versionArg ? versionArg.slice('--classroom-app-version='.length) : '';

contextBridge.exposeInMainWorld('classroomNativeBridge', {
  postMessage: (message: unknown) => ipcRenderer.send('native-message', message),
});
contextBridge.exposeInMainWorld('__CLASSROOM_WIDGETS_LINUX__', true);
contextBridge.exposeInMainWorld('__CLASSROOM_WIDGETS_LINUX_VERSION__', appVersion);
