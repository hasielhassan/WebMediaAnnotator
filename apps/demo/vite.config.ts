import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [react()],
    resolve: {
        // Force alias to sources for hot reload
        alias: {
            '@web-media-annotator/core': path.resolve(__dirname, '../../packages/core/src'),
            '@web-media-annotator/ui': path.resolve(__dirname, '../../packages/ui/src'),
            '@web-media-annotator/react': path.resolve(__dirname, '../../packages/react/src'),
        },
    },
})
