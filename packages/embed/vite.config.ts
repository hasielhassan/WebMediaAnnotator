import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const isBundle = mode === 'bundle';

    return {
        base: './',
        plugins: [react()],
        resolve: {
            alias: [
                { find: '@web-media-annotator/core', replacement: resolve(__dirname, '../core/src/index.ts') },
                { find: '@web-media-annotator/react', replacement: resolve(__dirname, '../react/src/index.ts') },
                { find: '@web-media-annotator/ui', replacement: resolve(__dirname, '../ui/src/index.ts') }
            ]
        },
        build: {
            emptyOutDir: false,
            lib: {
                entry: 'src/index.tsx',
                name: 'WebMediaAnnotator',
                fileName: (format) => isBundle ? `web-media-annotator.bundle.${format}.js` : `web-media-annotator.${format}.js`
            },
            rollupOptions: {
                // If bundling, don't externalize anything. If library, externalize React.
                external: isBundle ? [] : ['react', 'react-dom'],
                output: {
                    globals: {
                        react: 'React',
                        'react-dom': 'ReactDOM'
                    }
                }
            },
            cssCodeSplit: false
        },
        define: {
            'process.env.NODE_ENV': '"production"'
        }
    };
});
