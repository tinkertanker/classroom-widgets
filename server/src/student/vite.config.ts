import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Check if we're in Docker build (shared directory exists locally)
const isDockerBuild = existsSync(resolve(__dirname, './shared'));

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@shared': isDockerBuild 
        ? resolve(__dirname, './shared')
        : resolve(__dirname, '../../../src/shared')
    }
  },
  build: {
    outDir: '../../public',
    emptyOutDir: true,
  },
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});