const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let backendProcess = null;

function startBackend() {
  if (!isDev) {
    try {
      // In production packaged mode, backend is copied to resources folder (extraResources)
      const backendPath = path.join(process.resourcesPath, 'backend', 'index.js');
      console.log('🚀 Spawning backend from resources:', backendPath);
      
      backendProcess = fork(backendPath, [], {
        env: { 
          ...process.env, 
          PORT: process.env.PORT || 5000,
          NODE_ENV: 'production'
        }
      });
      
      backendProcess.on('error', (err) => {
        console.error('⚠️ Backend process error:', err);
      });
      
      backendProcess.on('exit', (code, signal) => {
        console.log(`📡 Backend process exited with code ${code} and signal ${signal}`);
      });
    } catch (err) {
      console.error('⚠️ Failed to start backend process:', err);
    }
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: "ProCure AI - Procurement Dashboard",
    icon: path.join(__dirname, 'public', 'favicon.svg'),
    autoHideMenuBar: true
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (backendProcess) {
    console.log('📡 Terminating backend process...');
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for local files dialogs if needed by frontend
ipcMain.handle('show-open-dialog', async (event, options) => {
  return await dialog.showOpenDialog(options);
});
