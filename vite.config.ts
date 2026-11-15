import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Gera um único ficheiro HTML (dist/index.html) que abre diretamente no browser.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
});
