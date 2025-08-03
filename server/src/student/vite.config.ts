import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/student/',
  build: {
    outDir: '../../public/student',
    emptyOutDir: true,
  }
});