import { defineConfig } from 'vite';
import FullReload from 'vite-plugin-full-reload';

export default defineConfig({
  root: '.',
  plugins: [
    // Re-load the page when compiled JS in dist changes (emitted by tsc --watch)
    FullReload(['dist/**/*.js'], {
      always: true,
      delay: 100
    })
  ],
  server: {
    port: 5173,
    open: '/web/index.html',
    fs: {
      // Allow serving files from project root
      allow: ['.']
    }
  },
});


