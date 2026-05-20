const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  checkSystem: () => ipcRenderer.invoke('check-system'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  startMacOS: (config: any) => ipcRenderer.invoke('start-macos', config),
  stopMacOS: () => ipcRenderer.invoke('stop-macos'),
  checkExistingImage: () => ipcRenderer.invoke('check-existing-image'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  onStatusUpdate: (callback: any) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('status-update', subscription);
    return () => ipcRenderer.removeListener('status-update', subscription);
  },
  onDockerLogs: (callback: any) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('docker-logs', subscription);
    return () => ipcRenderer.removeListener('docker-logs', subscription);
  },
});
