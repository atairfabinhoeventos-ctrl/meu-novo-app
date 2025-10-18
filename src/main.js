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

    // --- AQUI ESTÁ A CORREÇÃO ---
    // Trocamos '0.0.0.0' por '127.0.0.1' (localhost explícito)
    // Isso evita problemas de firewall e garante que o front-end
    // (chamando localhost:10000) consiga se conectar.
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Servidor Express iniciado pelo Electron (localhost) na porta ${PORT}`);
      createWindow(); 
    });
    // --- FIM DA CORREÇÃO ---

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