// src/config.jsx
import packageJson from '../package.json';

// 1. Verifica se a "bandeira" que o preload.js expôs existe.
const isRunningInElectron = window.electron && window.electron.isElectron;

// 2. Define a API_URL dinamicamente:
//    - Se estiver no .exe (Electron), usa o servidor local.
//    - Se NÃO estiver (no Render, no navegador), usa o servidor da nuvem.
export const API_URL = isRunningInElectron
  ? 'http://127.0.0.1:3001' // Servidor Local (Electron)
  : 'https://sisfo-backend.onrender.com'; // Servidor Nuvem

// 3. Define a versão puxando direto do package.json
export const APP_VERSION = packageJson.version;

// Log para depuração
console.log(`[Config] Rodando no Electron? ${!!isRunningInElectron}`);
console.log(`[Config] API_URL definida para: ${API_URL}`);
console.log(`[Config] Versão do Sistema: ${APP_VERSION}`);