// src/main.js (VERSÃO MODIFICADA PARA INCLUIR O SERVIDOR)

const { app, BrowserWindow } = require('electron');
const path = require('path');
const server = require('../server.js'); // <-- PASSO 1: Importe seu servidor

// ... (resto da função createWindow não muda)
function createWindow() {
  const mainWindow = new BrowserWindow({
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
}

app.whenReady().then(() => {
  // <-- PASSO 2: Inicie o servidor antes de criar a janela.
  // Você pode adicionar uma lógica para pegar a porta do .env se necessário
  const PORT = process.env.PORT || 3001; 
  server.listen(PORT, () => {
    console.log(`Servidor Express rodando na porta ${PORT}`);
    createWindow(); // Crie a janela APÓS o servidor iniciar
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});