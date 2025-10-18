// src/main.js (VERSÃO FINAL COM CONTROLE DE INSTÂNCIA ÚNICA)

const { app, BrowserWindow } = require('electron');
const path = require('path');
const server = require('../server.js'); // Importa o app Express exportado

// --- CONTROLE DE JANELA ÚNICA ---
// Adicionamos uma variável global para guardar a janela principal
let mainWindow;

// Função para criar a janela (levemente modificada)
function createWindow() {
  mainWindow = new BrowserWindow({ // Salva na variável global
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
  
  // Limpa a variável ao fechar
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- CONTROLE DE INSTÂNCIA ÚNICA ---
// Solicitamos um "bloqueio" para garantir que esta é a única instância
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Se não conseguimos o bloqueio, outra instância já está rodando.
  // Então, fechamos esta nova instância imediatamente.
  app.quit();
} else {
  // Esta é a primeira instância.
  // Configuramos um "ouvinte" para quando uma segunda instância tentar abrir.
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Alguém tentou rodar uma segunda instância.
    // Nós devemos focar a nossa janela que já está aberta.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // --- INICIALIZAÇÃO PRINCIPAL (SÓ RODA NA PRIMEIRA INSTÂNCIA) ---
  app.whenReady().then(() => {
    const PORT = process.env.PORT || 10000;

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor Express iniciado pelo Electron na porta ${PORT}`);
      createWindow(); // Cria a janela DEPOIS que o servidor iniciou
    });

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