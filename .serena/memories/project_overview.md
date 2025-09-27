# プロジェクト概要
- タイトル: Mystery Dungeon Game
- 目的: TypeScript で構築したローグライク(不思議のダンジョン系)ゲームの ECS/コンポーネントアーキテクチャ実装
- 技術スタック: TypeScript + Vite (ブラウザ用フロントエンド)、JSON 設定ファイル。テスト基盤は未整備 (README 記載は古い)
- 主なディレクトリ: src/ (ecs, systems, entities, web などのゲームロジックと UI)、config/ (ビルド時に埋め込まれる設定)、public/ (静的設定リソース)、web/ (ブラウザエントリ)、dist/ (ビルド成果物)
- 実行環境: ブラウザでの実行を想定。