import { contextBridge, ipcRenderer } from 'electron';

const args = process.argv;
const versionArg = args.find((arg) => arg.startsWith('--classroom-app-version='));
const appVersion = versionArg ? versionArg.slice('--classroom-app-version='.length) : '';

contextBridge.exposeInMainWorld('classroomNativeBridge', {
  postMessage: (message: unknown) => ipcRenderer.send('native-message', message),
});
contextBridge.exposeInMainWorld('__CLASSROOM_WIDGETS_LINUX__', true);
contextBridge.exposeInMainWorld('__CLASSROOM_WIDGETS_LINUX_VERSION__', appVersion);
if (args.includes('--classroom-widget-panel')) {
  contextBridge.exposeInMainWorld('__CLASSROOM_WIDGET_PANEL__', true);
}
