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

contextBridge.exposeInMainWorld('certificates', Object.freeze({
  generate: (record: unknown) => ipcRenderer.invoke('certificate.generate', record),
  verify: (cert: unknown) => ipcRenderer.invoke('certificate.verify', cert),
  save: (suggestedName: string, content: string) => ipcRenderer.invoke('certificate.save', { suggestedName, content }),
}));

contextBridge.exposeInMainWorld('secureErase', Object.freeze({
  prepareBinary: () => ipcRenderer.invoke('secureErase.prepareBinary'),
  listDevices: () => ipcRenderer.invoke('secureErase.listDevices'),
  getCapabilities: (device: string) => ipcRenderer.invoke('secureErase.getCapabilities', device),
  eraseDevice: (device: string, options: { confirmation: string; allowFormatFallback: boolean }) => ipcRenderer.invoke('secureErase.eraseDevice', device, options),
  listBlockDevices: () => ipcRenderer.invoke('secureErase.listBlockDevices'),
  isElevated: () => ipcRenderer.invoke('secureErase.isElevated'),
  csprngErase: (device: string, options: { confirmation: string; dryRun: boolean }) => ipcRenderer.invoke('secureErase.csprngErase', device, options),
  onProgress: (callback: (event: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on('secureErase.progress', listener);
    return () => ipcRenderer.removeListener('secureErase.progress', listener);
  },
  onDownloadProgress: (callback: (message: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(String(payload));
    ipcRenderer.on('secureErase.downloadProgress', listener);
    return () => ipcRenderer.removeListener('secureErase.downloadProgress', listener);
  },
}));

