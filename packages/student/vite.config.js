import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
export default defineConfig({
    plugins: [react()],
    base: '/student/',
    resolve: {
        alias: {
            '@shared': resolve(__dirname, '../shared')
        }
    },
    server: {
        fs: {
            allow: ['..'],
        },
    },
    build: {
        outDir: '../server/public/student',
        emptyOutDir: true,
    }
});
