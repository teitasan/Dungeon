import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'web/index.html'
    }
  },
  server: {
    port: 5173,
    open: '/web/index.html',
    fs: {
      // Allow serving files from project root
      allow: ['.']
    }
  },
});


