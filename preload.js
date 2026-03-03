const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    downloadVideo: (url) => ipcRenderer.send('download-video', url),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, value) => callback(value)),
    onDownloadComplete: (callback) => ipcRenderer.on('download-complete', (_event, value) => callback(value)),
    onDownloadError: (callback) => ipcRenderer.on('download-error', (_event, value) => callback(value)),
    onDownloadLog: (callback) => ipcRenderer.on('download-log', (_event, value) => callback(value)),
    checkUpdate: () => ipcRenderer.invoke('check-update'),
    openExternalUrl: (url) => ipcRenderer.send('open-external', url)
});
