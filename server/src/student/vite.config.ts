import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, './shared')
    }
  },
  build: {
    outDir: '../../public',
    emptyOutDir: true,
  }
});