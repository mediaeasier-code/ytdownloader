const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

app.setName('YT Downloader');

let mainWindow;

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

  mainWindow = win;
  win.loadFile('index.html');
}

// Auto Updater Setup
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
  // Explicitly avoid same-version trigger loops and serialize safely for IPC
  if (info && info.version === app.getVersion()) return;
  
  const safeInfo = { version: info ? info.version : 'Unknown' };
  if (mainWindow) mainWindow.webContents.send('update-available', safeInfo);
});

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) mainWindow.webContents.send('update-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  const safeInfo = { version: info ? info.version : 'Unknown' };
  if (mainWindow) mainWindow.webContents.send('update-downloaded', safeInfo);
});

autoUpdater.on('error', (err) => {
  const safeError = err ? err.message || err.toString() : 'Unknown AutoUpdater Error';
  if (mainWindow) mainWindow.webContents.send('update-error', safeError);
});

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();

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

// IPC handler to install downloaded update
ipcMain.on('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

// IPC handler to open external URLs
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
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
    '-f', 'bestvideo+bestaudio/best',
    '--concurrent-fragments', '10', // Increase download speed via concurrent connections
    '--hls-prefer-native', // Use native HLS downloader if available
    '--merge-output-format', 'mkv',
    '--recode-video', 'mp4',
    // Hardware H.264 encode for Premiere, forcing SDR colorspace so 10-bit HDR 4K doesn't crash ffmpeg
    '--postprocessor-args', 'VideoConvertor:-c:v h264_videotoolbox -allow_sw 1 -b:v 30M -vf format=yuv420p -color_trc bt709 -color_primaries bt709 -colorspace bt709',
    '--embed-metadata', // Embedded YouTube title replaces ffmpeg's default "electron" process handler name in Premiere!
    '--ffmpeg-location', ffmpegPath,
    '--force-overwrites',
    '-o', outputTemplate,
    '--newline' // Ensure newlines to parse progress easily
  ];

  const child = spawn(ytdlpPath, args);

  let isConverting = false;

  child.stdout.on('data', (data) => {
    let output = data.toString();
    
    if (output.includes('[VideoConvertor]')) {
      isConverting = true;
      output = output.replace(/\[VideoConvertor\]/g, '[yt downloader]');
    }

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
    
    if (isConverting && output.includes('Converting video')) {
        event.reply('download-progress', { percent: 100, isConverting: true });
    }
  });

  child.stderr.on('data', (data) => {
    const errOutput = data.toString();
    console.error(`stderr: ${errOutput}`);
    event.reply('download-log', `[stderr] ${errOutput}`);
  });

  child.on('close', (code) => {
    if (code === 0) {
      event.reply('download-complete', { msg: isConverting ? 'Converted and ready for Premiere Pro!' : 'Downloaded successfully!', wasConverted: isConverting });
    } else {
      event.reply('download-error', `Process exited with code ${code}`);
    }
  });

  child.on('error', (err) => {
    event.reply('download-error', `Failed to start subprocess: ${err.message}`);
  });
});
