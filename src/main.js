// src/main.js (VERSÃO FINAL COM '127.0.0.1')

const { app, BrowserWindow } = require('electron');
const path = require('path');
const server = require('../server.js'); // Importa o app Express exportado

// --- CONTROLE DE JANELA ÚNICA ---
let mainWindow;

// Função para criar a janela
function createWindow() {
  mainWindow = new BrowserWindow({ 
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // --- Verificação de ambiente ---
  if (!app.isPackaged) {
    // Modo Desenvolvimento (npm run dev)
    mainWindow.loadURL('http://localhost:5173');
    // Mantenha o DevTools aberto no 'dev' para depurar
    mainWindow.webContents.openDevTools(); 
  } else {
    // Modo Produção (.exe)
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- CONTROLE DE INSTÂNCIA ÚNICA ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // --- INICIALIZAÇÃO PRINCIPAL ---
  app.whenReady().then(() => {
    const PORT = process.env.PORT || 10000;

    // --- GARANTA QUE ESTA É A VERSÃO ATUAL ---
    // Ele DEVE escutar em '127.0.0.1' para corresponder ao config.jsx
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Servidor Express iniciado pelo Electron (localhost) na porta ${PORT}`);
      createWindow(); 
    });
    // --- FIM DA VERIFICAÇÃO ---

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// Encerra o aplicativo quando todas as janelas são fechadas.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});