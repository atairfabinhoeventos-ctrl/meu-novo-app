const { contextBridge, ipcRenderer } = require('electron');

// MENSAGEM DE TESTE: Se esta mensagem aparecer no console, o preload está funcionando.
console.log('--- SCRIPT PRELOAD CARREGADO COM SUCESSO ---');

// Expõe um objeto chamado 'electronAPI' para a janela do seu aplicativo (o código React).
// Este objeto contém a função 'savePdf'.
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Invoca a função 'save-pdf' no processo principal do Electron.
   * @param {Buffer} pdfData - Os dados do PDF gerado.
   * @param {string} defaultPath - O nome de arquivo sugerido.
   * @returns {Promise<{success: boolean, error?: string}>} - Uma promessa que resolve com o resultado da operação de salvamento.
   */
  savePdf: (pdfData, defaultPath) => ipcRenderer.invoke('save-pdf', pdfData, defaultPath),
});