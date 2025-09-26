// vite.config.js

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // --- A CORREÇÃO CRÍTICA ESTÁ AQUI ---
  // Esta linha força o Vite a usar caminhos relativos nos arquivos de build,
  // o que permite que o Electron os encontre no modo de produção.
  base: './', 
});