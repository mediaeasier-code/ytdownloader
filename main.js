const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 550,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    resizable: false,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active'
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler for downloading
ipcMain.on('download-video', (event, url) => {
  const desktopPath = path.join(app.getPath('home'), 'Desktop');
  
  // Decide the path for yt-dlp and ffmpeg
  const ytdlpPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'yt-dlp_macos')
    : path.join(__dirname, 'yt-dlp_macos');
    
  const ffmpegPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'ffmpeg')
    : path.join(__dirname, 'ffmpeg');

  // Verify yt-dlp exists
  if (!fs.existsSync(ytdlpPath)) {
    event.reply('download-error', `yt-dlp binary not found at ${ytdlpPath}`);
    return;
  }

  // yt-dlp arguments for highest quality video+audio, saving to Desktop
  // %(title)s.%(ext)s
  const outputTemplate = path.join(desktopPath, '%(title)s.%(ext)s');
  const args = [
    url,
    '-f', 'bestvideo[vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
    '--merge-output-format', 'mp4',
    '--ffmpeg-location', ffmpegPath,
    '-o', outputTemplate,
    '--newline' // Ensure newlines to parse progress easily
  ];

  const child = spawn(ytdlpPath, args);

  child.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);
    event.reply('download-log', `[stdout] ${output}`);
    
    // Parse progress if possible
    // Example: [download]  12.3% of ~ 15.00MiB at  1.23MiB/s ETA 00:10
    if (output.includes('[download]')) {
      const match = output.match(/(\d+\.\d+)%/);
      if (match && match[1]) {
        event.reply('download-progress', { percent: parseFloat(match[1]) });
      }
    }
  });

  child.stderr.on('data', (data) => {
    const errOutput = data.toString();
    console.error(`stderr: ${errOutput}`);
    event.reply('download-log', `[stderr] ${errOutput}`);
  });

  child.on('close', (code) => {
    if (code === 0) {
      event.reply('download-complete', 'Download finished successfully!');
    } else {
      event.reply('download-error', `Process exited with code ${code}`);
    }
  });
  
  child.on('error', (err) => {
    event.reply('download-error', `Failed to start subprocess: ${err.message}`);
  });
});
