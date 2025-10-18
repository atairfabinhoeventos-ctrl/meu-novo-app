// src/preload.js (VERSÃO ATUALIZADA E COMBINADA)

const { contextBridge, ipcRenderer } = require('electron');

// MENSAGEM DE TESTE: Se esta mensagem aparecer no console, o preload está funcionando.
console.log('--- SCRIPT PRELOAD CARREGADO COM SUCESSO ---');


// --- SUA FUNÇÃO EXISTENTE PARA SALVAR PDF ---
// Expõe a função 'savePdf' para o React
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Invoca a função 'save-pdf' no processo principal do Electron.
   * @param {Buffer} pdfData - Os dados do PDF gerado.
   * @param {string} defaultPath - O nome de arquivo sugerido.
   * @returns {Promise<{success: boolean, error?: string}>} - Uma promessa que resolve com o resultado da operação de salvamento.
   */
  savePdf: (pdfData, defaultPath) => ipcRenderer.invoke('save-pdf', pdfData, defaultPath),
});


// --- ADIÇÃO PARA DETECTAR O ELECTRON (CORREÇÃO DA TELA BRANCA) ---
// Expõe uma "bandeira" (flag) que o seu config.jsx usará para
// decidir qual URL de API chamar (Render ou Localhost).
contextBridge.exposeInMainWorld('electron', {
  isElectron: true
});