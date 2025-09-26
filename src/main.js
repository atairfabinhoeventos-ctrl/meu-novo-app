// src/main.js (Com Aceleração de Hardware Desativada)

const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');

// --- CORREÇÃO ADICIONADA AQUI ---
// Esta linha desativa a aceleração de hardware e resolve problemas de "congelamento" da tela.
app.disableHardwareAcceleration();
// ------------------------------------

if (require('electron-squirrel-startup')) {
  app.quit();
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } },
]);

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true, 
    },
  });

  if (app.isPackaged) {
    mainWindow.loadURL(`app://./index.html`);
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }
  
  mainWindow.maximize();
};

app.whenReady().then(() => {
  if (app.isPackaged) {
    protocol.registerFileProtocol('app', (request, callback) => {
      const url = request.url.substr(6);
      callback({ path: path.join(__dirname, '../dist', url) });
    });
  }
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});