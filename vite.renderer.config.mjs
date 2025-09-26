// vite.renderer.config.mjs

import { defineConfig } from 'vite';

export default defineConfig({
  // Adicione esta configuração
  esbuild: {
    loader: 'jsx',
    include: [
      // Adicione todos os padrões de arquivo que você deseja tratar como JSX
      'src/**/*.js',
      'src/**/*.jsx',
    ],
  },
});