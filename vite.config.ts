import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export default defineConfig(({ command }) => ({
  root: '.',
  // 開発時は相対パス、本番ビルド時はGitHub Pages用のbase URL
  base: command === 'serve' ? '/' : '/Dungeon/',
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
}));


