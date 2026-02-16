import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    server: {
        watch: {
            ignored: ['**/release/**', '**/electron/**', '**/dist/**']
        }
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: 'index.html',
                guide: 'guide.html'
            }
        }
    }
});
