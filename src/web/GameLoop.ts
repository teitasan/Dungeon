import type { GameSystems } from './GameInitializer.js';
import type { PlayerEntity } from '../entities/Player.js';
import type { UIManager } from './ui/UIManager.js';
import type { InputHandler } from './InputHandler.js';

export class GameLoop {
  private lastFrameTime = 0;
  private readonly FPS = 30;
  private readonly FRAME_INTERVAL = 1000 / this.FPS; // 約33.33ms

  constructor(
    private systems: GameSystems,
    private player: PlayerEntity,
    private uiManager: UIManager,
    private inputHandler: InputHandler | null,
    private onPlayerAction: (action: 'move' | 'attack' | 'item', success: boolean, data?: any) => void
  ) {}

  public setInputHandler(inputHandler: InputHandler): void {
    this.inputHandler = inputHandler;
  }

  public start(): void {
    // console.log(`[DEBUG] ゲームループ開始: ${this.FPS}FPS (${this.FRAME_INTERVAL.toFixed(1)}ms間隔)`);
    this.gameLoop(0);
  }

  private gameLoop = (currentTime: number): void => {
    const deltaTime = currentTime - this.lastFrameTime;
    
    if (deltaTime >= this.FRAME_INTERVAL) {
      this.lastFrameTime = currentTime - (deltaTime % this.FRAME_INTERVAL);
      
      // ゲームの更新処理
      this.render();
    }
    
    requestAnimationFrame(this.gameLoop);
  };

  public render(): void {
    const current = this.systems.dungeonManager.getCurrentDungeon();
    if (!current) {
      return;
    }
    
    // ターン制御チェック
    if (this.inputHandler) {
      this.inputHandler.updateTurnControl();
    }
    
    // ターンシステムの初期化
    const entities = this.systems.dungeonManager.getAllEntities();
    this.systems.turnSystem.initializeTurnOrder(entities);
    
    // ゲーム情報オーバーレイを更新
    this.uiManager.updateGameInfoOverlay({
      floor: current.floor,
      level: this.player.stats.level,
      currentHp: this.player.stats.hp,
      maxHp: this.player.stats.maxHp,
      hungerCurrent: this.player.hunger,
      hungerMax: this.player.maxHunger,
      gold: 0, // プレイヤーの所持金（現在は0で固定）
      turn: this.systems.turnSystem.getCurrentTurn()
    });
    
    // 移動処理を実行（ゲームループ内）
    // 方向転換（Cキー）を許可するため、ターン制御中でも呼び出す。
    // 実際の移動は InputHandler 側で turnInProgress 等を見て抑止される。
    if (this.inputHandler) {
      this.inputHandler.processMovement();
    }
    
    this.systems.renderer.render(current, this.systems.dungeonManager, this.player, this.systems.turnSystem);
  }

  public handlePlayerAction(action: 'move' | 'attack' | 'item', success: boolean, data?: any): void {
    // console.log(`[DEBUG] handlePlayerAction呼び出し: action=${action}, success=${success}`);
    
    if (success || action === 'attack') { // 攻撃は常にターン消費
      // console.log(`[DEBUG] ターン処理開始: ${action}`);
      this.systems.turnSystem.recordPlayerAction(this.player, action, false);
      // console.log(`[DEBUG] プレイヤー行動完了: ${action}, ターン実行開始`);
      
      // 完全同期処理：即座にターンシステムを実行
      this.systems.turnSystem.executeTurn();
      // console.log(`[DEBUG] ターンシステム実行完了: 次のターン ${this.systems.turnSystem.getCurrentTurn()}`);
      
      // ターンシステム実行後にUIを更新（ターン数表示を更新）
      const current = this.systems.dungeonManager.getCurrentDungeon();
      if (current) {
        this.uiManager.updateGameInfoOverlay({
          floor: current.floor,
          level: this.player.stats.level,
          currentHp: this.player.stats.hp,
          maxHp: this.player.stats.maxHp,
          hungerCurrent: this.player.hunger,
          hungerMax: this.player.maxHunger,
          gold: 0,
          turn: this.systems.turnSystem.getCurrentTurn()
        });
      }
      
      // ターン制御フラグを設定（1秒間待機開始）
      if (this.inputHandler) {
        this.inputHandler.startTurnControl();
      }
      
      // console.log(`[DEBUG] プレイヤー行動完了: ${action}, ターン実行完了`);
    } else {
      // console.log(`[DEBUG] ターン処理スキップ: action=${action}, success=${success}`);
    }
  }
}
