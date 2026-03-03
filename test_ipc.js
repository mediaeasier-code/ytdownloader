const { app, BrowserWindow, ipcMain } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadURL('data:text/html;charset=utf-8,<html><body><script>const {ipcRenderer} = require("electron"); ipcRenderer.on("test", (e, info) => console.log("Received info:", info, "version:", info ? info.version : "UNDEFINED"));</script></body></html>');

  win.webContents.once('did-finish-load', () => {
    class UpdateInfo {
      constructor() {
        this.version = "1.0.4";
      }
    }
    const info = new UpdateInfo();
    console.log("Sending:", info);
    try {
      win.webContents.send('test', info);
    } catch(e) {
      console.error("Send error:", e);
    }
    setTimeout(() => app.quit(), 2000);
  });
});
