import { GameInitializer } from './GameInitializer.js';
import { InputHandler } from './InputHandler.js';
import { GameLoop } from './GameLoop.js';

async function start(): Promise<void> {
  try {
    // ゲームの初期化
    const initializer = new GameInitializer();
    const { systems, player, uiManager, config } = await initializer.initialize();

    // UISystemにUIManagerを設定
    systems.uiSystem.setUIManager(uiManager);

    // ゲームループの作成
    const gameLoop = new GameLoop(
      systems,
      player,
      uiManager,
      null as any, // inputHandler - 後で設定
      (action, success, data) => gameLoop.handlePlayerAction(action, success, data)
    );

    // 入力ハンドラーの作成
    const inputHandler = new InputHandler(
      systems,
      player,
      uiManager,
      config,
      (action, success, data) => gameLoop.handlePlayerAction(action, success, data),
      () => gameLoop.render()
    );

    // ゲームループに入力ハンドラーを設定
    gameLoop.setInputHandler(inputHandler);

    // 初期メッセージの表示
    uiManager.addMessageWithAnimation(`Entered ${systems.dungeonManager.getCurrentDungeon()?.name || 'Unknown Dungeon'}`);
    
    // サンプル用：50文字程度の日本語メッセージ
    setTimeout(() => {
      uiManager.addMessageWithAnimation('プレイヤーは強力な魔法の剣を手に入れて、敵に対して大きなダメージを与えることができるようになった。この武器は伝説の鍛冶師によって作られたものである。');
    }, 1000);
    
    // 初回レンダリング
    gameLoop.render();
    
    // ゲームループ開始
    gameLoop.start();

  } catch (error) {
    console.error('Failed to start game:', error);
    // エラー時の処理（必要に応じて）
  }
}

// DOMContentLoadedイベントの処理
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => start());
} else {
  start();
}


