import { contextBridge, ipcRenderer } from 'electron';
import { createRecoveryApi } from './recovery-api.js';

const api = createRecoveryApi({
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  subscribe: (channel, listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});

contextBridge.exposeInMainWorld('recoveryApi', api);
contextBridge.exposeInMainWorld('deletionApi', {
  runScript: (scriptName: string) => ipcRenderer.invoke('deletion.run', scriptName)
});

