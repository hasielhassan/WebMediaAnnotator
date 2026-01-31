import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: [
            { find: '@web-media-annotator/core', replacement: resolve(__dirname, '../core/src/index.ts') },
            { find: '@web-media-annotator/react', replacement: resolve(__dirname, '../react/src/index.ts') },
            // Also resolve UI which is used by React
            { find: '@web-media-annotator/ui', replacement: resolve(__dirname, '../ui/src/index.ts') }
        ]
    },
    build: {
        emptyOutDir: false, // Keep tsc output
        lib: {
            entry: 'src/index.tsx', // Relative path
            name: 'WebMediaAnnotator',
            fileName: (format) => `web-media-annotator.${format}.js`
        },
        rollupOptions: {
            // For a "drop-in" widget, we usually want to bundle React.
            // If we wanted to exclude it, we would list it here.
            // external: ['react', 'react-dom'],
            output: {
                // Global variables for UMD/IIFE build
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM'
                }
            }
        },
        // Ensure CSS is injected or emitted
        cssCodeSplit: false
    },
    define: {
        'process.env.NODE_ENV': '"production"'
    }
});
