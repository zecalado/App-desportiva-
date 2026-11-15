import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// npm run build        → versão online (dist/), publicada no GitHub Pages
// npm run build:local  → protótipo num único ficheiro (GestaoPlantel.html), dados só no browser
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'offline' ? [viteSingleFile()] : [])],
  build: mode === 'offline' ? { outDir: 'dist-local' } : undefined,
}));
