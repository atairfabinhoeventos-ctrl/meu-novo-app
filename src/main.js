const { app, BrowserWindow, protocol, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();

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
      // ===== INÍCIO DA CORREÇÃO =====
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,  // Habilitado para segurança e para o preload funcionar
      nodeIntegration: false,  // Desabilitado por segurança quando contextIsolation é true
      // ===== FIM DA CORREÇÃO =====
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

ipcMain.handle('save-pdf', async (event, pdfData, defaultPath) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Salvar Recibo em PDF',
    defaultPath: defaultPath,
    filters: [
      { name: 'Arquivos PDF', extensions: ['pdf'] }
    ]
  });

  if (filePath) {
    try {
      fs.writeFileSync(filePath, pdfData);
      return { success: true, path: filePath };
    } catch (error) {
      console.error('Falha ao salvar o PDF:', error);
      return { success: false, error: error.message };
    }
  }
  
  return { success: false, error: 'Salvamento cancelado pelo usuário.' };
});