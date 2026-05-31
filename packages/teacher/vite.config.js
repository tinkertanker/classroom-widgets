import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteTsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteTsconfigPaths()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 3000,
    open: true,
    host: true,
    fs: {
      allow: ['..'],
    },
  },
  build: {
    outDir: 'build',
    // Emit sourcemaps but don't reference them from the JS bundle.
    // Useful for upload to error trackers without shipping to end users.
    sourcemap: 'hidden',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-rnd': ['react-rnd'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-socket': ['socket.io-client'],
          'vendor-zustand': ['zustand']
        }
      }
    }
  },
  optimizeDeps: {
    include: []
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/setupTests.ts'],
    css: true
  }
})
