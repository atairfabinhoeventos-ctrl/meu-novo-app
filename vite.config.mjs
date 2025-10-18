// vite.config.js (VERSÃO CORRETA PARA ELECTRON)

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // --- CORREÇÃO ADICIONADA AQUI ---
  // Esta linha é a mais importante. Ela força o Vite a usar caminhos relativos.
  base: './', 

  build: {
    // Define o diretório de saída como 'dist', que o electron-builder já espera.
    outDir: 'dist'
  }
});