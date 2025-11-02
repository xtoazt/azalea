import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  executeCommand: (command: string, cwd?: string) =>
    ipcRenderer.invoke('execute-command', command, cwd),
  executeCommandStream: (command: string, cwd?: string) =>
    ipcRenderer.invoke('execute-command-stream', command, cwd),
  getCurrentDirectory: () => ipcRenderer.invoke('get-current-directory'),
  changeDirectory: (dir: string) => ipcRenderer.invoke('change-directory', dir),
  getHomeDirectory: () => ipcRenderer.invoke('get-home-directory'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
});

