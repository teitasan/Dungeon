# Repository Guidelines

## プロジェクト構成とモジュール
- `src/`: TypeScript ソース。主要領域: `ecs/`（新規のコンポーネント/システム）、`systems/`（レガシー）、`entities/`、`dungeon/`、`core/`、`types/`、`web/`（ブラウザ実行周り）、`assets/`。
- `web/`: ブラウザ用エントリ。`web/index.html` から `src/web/main.ts` を読み込み。
- `config/`: 実行時設定。`config/dungeonTemplates.json` はビルド時に埋め込まれ、`__DUNGEON_TEMPLATES__` として参照可能。
- `public/`: 静的ファイル（必要に応じて配置）。
- `dist/`: ビルド成果物（自動生成、編集禁止）。

## ビルド・開発・実行コマンド
- `npm install`: 依存関係をインストール。
- `npm run dev`: Vite 開発サーバ起動。`/web/index.html` が開きます。
- `npm run build`: 本番ビルドを `dist/` に出力。
- `npm run preview`: 本番ビルドをローカルで配信。

## コーディングスタイルと命名
- TypeScript strict。`any` は避け、`src/types/` の型を活用。
- インデントは 2 スペース。
- 命名: クラス/型/ファイルは `PascalCase`（例: `CombatSystem.ts`）、変数/関数は `camelCase`、ディレクトリは小文字。
- 可能なら名前付きエクスポート。必要に応じてバレル（例: `src/systems/index.ts`）。
- 新規ゲームロジックは `src/ecs/*` を優先し、`src/systems/*` は保守最小限。

## テスト方針
- 既定のテストランナーは未設定。開発中はブラウザデモで手動確認。
- 追加する場合は Vitest を推奨。`*.spec.ts` をソース隣に置き、`package.json` に `"test": "vitest"` を追加。
- テスト容易性: RNG を引数注入（例: `Attack.shouldHit(..., rng)`）、純粋関数化、描画は `src/web/*` に分離。

## コミットとプルリクエスト
- コミットは短く具体的に。`feat:` `fix:` `refactor:` などを推奨。日本語/英語どちらでも可。課題は `#123` の形式で参照。
- PR には概要、変更理由、確認手順（コマンドと期待結果）、UI 変更のスクショ/GIF、`config/` 変更の有無を記載。

## セキュリティと設定の注意
- 秘密情報や大容量バイナリはコミットしない。画像は `src/assets/` 配下に配置。
- `config/dungeonTemplates.json` 変更時は開発サーバを再起動して反映。ビルド時に `__DUNGEON_TEMPLATES__` として埋め込まれます。
