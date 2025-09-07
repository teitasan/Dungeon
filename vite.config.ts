import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: '/Dungeon/', // GitHub Pages用のbase URL
  define: {
    // ビルド時にJSONファイルを文字列として埋め込み
    __DUNGEON_TEMPLATES__: JSON.stringify(
      JSON.parse(
        readFileSync(resolve(__dirname, 'config/dungeonTemplates.json'), 'utf-8')
      )
    )
  },
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


