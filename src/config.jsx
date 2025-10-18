// src/config.jsx (VERSÃO INTELIGENTE FINAL E CORRIGIDA)

// 1. Verifica se a "bandeira" que o preload.js expôs existe.
const isRunningInElectron = window.electron && window.electron.isElectron;

// 2. Define a API_URL dinamicamente:
//    - Se estiver no .exe (Electron), usa o servidor local.
//    - Se NÃO estiver (no Render, no navegador), usa o servidor da nuvem.
export const API_URL = isRunningInElectron
  ? 'http://127.0.0.1:3001' // <-- CORREÇÃO: Alterado de 'localhost' para o IP exato
  : 'https://sisfo-backend.onrender.com';

// Log para depuração
console.log(`[Config] Rodando no Electron? ${!!isRunningInElectron}`);
console.log(`[Config] API_URL definida para: ${API_URL}`);