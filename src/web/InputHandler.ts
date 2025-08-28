import { openChoiceModal, isModalOpen, cancelCurrentModal } from './ui/Modal.js';
import type { Position } from '../types/core.js';
import type { GameSystems } from './GameInitializer.js';
import type { PlayerEntity } from '../entities/Player.js';
import type { UIManager } from './ui/UIManager.js';
import { ItemEntity } from '../entities/Item.js';

export class InputHandler {
  private keyPress = 0;
  private keyTrg = 0;
  private inventoryOpen = false;
  private isFastMode = false;
  private canMove = true;
  private canAttack = true;
  private turnInProgress = false;
  private turnStartTime = 0;
  private movementInProgress = false;
  private lastMovementTime = 0;

  // 定数
  private readonly KEY_UP = 1;      // 0001
  private readonly KEY_DOWN = 2;    // 0010
  private readonly KEY_LEFT = 4;    // 0100
  private readonly KEY_RIGHT = 8;   // 1000
  private readonly TURN_DURATION = 100;  // ターン持続時間
  private readonly TURN_DURATION_FAST = 50;  // 高速モード時のターン持続時間
  private readonly MOVEMENT_COOLDOWN = 50;  // 移動処理のクールダウン時間（ミリ秒）

  constructor(
    private systems: GameSystems,
    private player: PlayerEntity,
    private uiManager: UIManager,
    private config: any,
    private onPlayerAction: (action: 'move' | 'attack' | 'item', success: boolean, data?: any) => void,
    private onRender: () => void
  ) {
    this.bindKeys();
    // モーダルの開閉時にキー状態をリセット（押しっぱなしビットの取り残し防止）
    window.addEventListener('ui-modal-opened', () => this.resetKeyState());
    window.addEventListener('ui-modal-closed', () => this.resetKeyState());
    // アイキャッチ開始/終了時にもキー状態をリセット
    window.addEventListener('ui-transition-start', () => this.resetKeyState());
    window.addEventListener('ui-transition-end', () => this.resetKeyState());
  }

  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      // prevent page scroll on arrow keys/space
      const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (navKeys.includes(e.key) || e.key === ' ' || e.key === '.') {
        e.preventDefault();
      }
      
      this.handleKeyEvent(e.key, 'keydown');
    });
    
    window.addEventListener('keyup', (e) => {
      this.handleKeyEvent(e.key, 'keyup');
    });
  }

  private handleKeyEvent(key: string, type: 'keydown' | 'keyup'): void {
    console.log(`[DEBUG] キーイベント受信: key=${key}, type=${type}`);
    // モーダル/アイキャッチ中はキー入力をUIに専有させる
    const isBlockedByUI = isModalOpen() || (this.systems.renderer && this.systems.renderer.isInTransition());
    if (isBlockedByUI) {
      // ただし keyup は押下ビットを確実にクリアする
      if (type === 'keyup') {
        switch (key) {
          case 'ArrowUp': this.keyPress &= ~this.KEY_UP; break;
          case 'ArrowDown': this.keyPress &= ~this.KEY_DOWN; break;
          case 'ArrowLeft': this.keyPress &= ~this.KEY_LEFT; break;
          case 'ArrowRight': this.keyPress &= ~this.KEY_RIGHT; break;
        }
      }
      return;
    }
    
    // ビット演算によるキー状態管理
    if (type === 'keydown') {
      switch (key) {
        case 'ArrowUp':
          if ((this.keyPress & this.KEY_UP) === 0) {
            this.keyPress |= this.KEY_UP;
            this.keyTrg |= this.KEY_UP;
          }
          break;
        case 'ArrowDown':
          if ((this.keyPress & this.KEY_DOWN) === 0) {
            this.keyPress |= this.KEY_DOWN;
            this.keyTrg |= this.KEY_DOWN;
          }
          break;
        case 'ArrowLeft':
          if ((this.keyPress & this.KEY_LEFT) === 0) {
            this.keyPress |= this.KEY_LEFT;
            this.keyTrg |= this.KEY_LEFT;
          }
          break;
        case 'ArrowRight':
          if ((this.keyPress & this.KEY_RIGHT) === 0) {
            this.keyPress |= this.KEY_RIGHT;
            this.keyTrg |= this.KEY_RIGHT;
          }
          break;
      }
    } else if (type === 'keyup') {
      switch (key) {
        case 'ArrowUp':
          this.keyPress &= ~this.KEY_UP;
          break;
        case 'ArrowDown':
          this.keyPress &= ~this.KEY_DOWN;
          break;
        case 'ArrowLeft':
          this.keyPress &= ~this.KEY_LEFT;
          break;
        case 'ArrowRight':
          this.keyPress &= ~this.KEY_RIGHT;
          break;
      }
    }
    
    console.log(`[DEBUG] 現在のキー状態: keyPress=${this.keyPress.toString(2).padStart(4, '0')}, keyTrg=${this.keyTrg.toString(2).padStart(4, '0')}`);
    
    // インベントリ内でのキー操作を優先処理
    if (this.inventoryOpen) {
      // インベントリキー（A）でトグル閉じる
      if (type === 'keydown' && (key === 'a' || key === 'A')) {
        this.setInventoryOpen(false);
        this.onRender();
        return;
      }
      this.handleInventoryInput(key, type);
      return;
    }
    
    // Xキーによる高速モード切り替え
    if (key === 'x' || key === 'X') {
      if (type === 'keydown') {
        this.isFastMode = true;
        console.log(`[DEBUG] 高速モード開始: ターン持続時間 ${this.TURN_DURATION_FAST}ms`);
      } else if (type === 'keyup') {
        this.isFastMode = false;
        console.log(`[DEBUG] 高速モード終了: ターン持続時間 ${this.TURN_DURATION}ms`);
      }
      return;
    }
    
    // ここから下の操作は全て keydown のみで発火
    if (type !== 'keydown') {
      return;
    }

    // インベントリ開閉（keydownのみ）: デフォルトを I から A に変更
    if (key === 'a' || key === 'A') {
      this.setInventoryOpen(!this.inventoryOpen);
      return;
    }
    
    if (key === 'Enter' || key === 'z' || key === 'Z') {
      this.handleAttack();
      return;
    }

    // 投擲（T）: keydown のみで処理
    if (key === 't' || key === 'T') {
      this.handleThrow();
      return;
    }
  }

  private handleThrow(): void {
    // 行動可否チェック（攻撃と同じ扱い）
    if (!this.canAttack || this.turnInProgress) {
      return;
    }
    // 所持品がなければ何もしない
    if (!this.player.inventory || this.player.inventory.length === 0) {
      this.uiManager.addMessageWithAnimation('投げるアイテムがない');
      return;
    }

    // 投げる対象：インベントリが開いていたら選択中、でなければ先頭
    const selected = this.inventoryOpen ? this.systems.uiSystem['uiManager']?.getSelectedInventoryItem?.() : undefined;
    const targetItem = selected || this.player.inventory[0];
    if (!targetItem) {
      this.uiManager.addMessageWithAnimation('投げるアイテムがない');
      return;
    }

    // プレイヤーの向きから方向を取得
    const dir = this.player.direction || 'south';
    const result = this.systems.itemSystem.throwItem(this.player, targetItem.id, dir as any);
    
    if (result.success) {
      // ターンを消費し、連打での多重実行を防ぐ
      this.canAttack = false;
      this.onPlayerAction('item', true, result);
    } else {
      this.uiManager.addMessageWithAnimation(result.message);
    }
  }

  private handleInventoryInput(key: string, type: 'keydown' | 'keyup'): void {
    // モーダル表示中はインベントリ内のキー処理を行わない
    if (isModalOpen()) return;
    // アイキャッチ演出中は無効
    if (this.systems.renderer && this.systems.renderer.isInTransition()) return;
    // インベントリ内での移動処理（keydownのみ）
    if ((key === 'ArrowUp' || key === 'ArrowDown') && type === 'keydown') {
      const direction = key === 'ArrowUp' ? 'up' : 'down';
      const result = this.systems.uiSystem.handleInventoryAction('move-selection', direction);
      if (result.success) {
        this.renderInventory();
      }
      return;
    }
    
    if ((key === 'Enter' || key === 'z' || key === 'Z') && type === 'keydown') {
      // アイテム操作メニューを表示: 使う/投げる/捨てる
      this.presentInventoryActionMenu();
      return;
    }
    
    if ((key === 'x' || key === 'X') && type === 'keydown') {
      this.setInventoryOpen(false);
      this.onRender();
      return;
    }
  }

  // インベントリ選択アイテムに対する操作メニュー
  private async presentInventoryActionMenu(): Promise<void> {
    const selected = this.uiManager.getSelectedInventoryItem();
    if (!selected) {
      this.uiManager.addMessageWithAnimation('アイテムが選択されていません');
      return;
    }

    try {
      const res = await openChoiceModal({
        title: `${selected.name || selected.id} をどうする？`,
        options: [
          { id: 'use', label: '使う' },
          { id: 'throw', label: '投げる' },
          { id: 'drop', label: '捨てる' }
        ],
        defaultIndex: 0,
      });

      if (res.type !== 'ok') {
        this.uiManager.addMessageWithAnimation('キャンセルしました');
        return;
      }

      const choice = res.selectedId;
      if (choice === 'use') {
        const result = this.systems.uiSystem.handleInventoryAction('use-item');
        if (result.message) this.uiManager.addMessageWithAnimation(result.message);
        this.onRender();
        if (result.success) {
          this.setInventoryOpen(false);
          this.renderInventory();
          this.onPlayerAction('item', true);
        }
      } else if (choice === 'throw') {
        // 投擲: 選択中アイテムをプレイヤーの向きに投げる
        const dir = this.player.direction || 'south';
        const throwResult = this.systems.itemSystem.throwItem(this.player, selected.id, dir as any);
        if (throwResult.message) this.uiManager.addMessageWithAnimation(throwResult.message);
        this.onRender();
        if (throwResult.success) {
          this.setInventoryOpen(false);
          this.renderInventory();
          this.onPlayerAction('item', true, throwResult);
        }
      } else if (choice === 'drop') {
        // 捨てる: 足元に落とす
        const dropResult = this.systems.itemSystem.dropItem(this.player, selected.id, { ...this.player.position });
        if (dropResult.message) this.uiManager.addMessageWithAnimation(dropResult.message);
        this.onRender();
        if (dropResult.success) {
          this.setInventoryOpen(false);
          this.renderInventory();
          this.onPlayerAction('item', true, dropResult);
        }
      }
    } catch (error) {
      console.error('[ERROR] インベントリアクションメニューでエラー:', error);
    }
  }

  private handleAttack(): void {
    // 攻撃可能フラグチェック
    if (!this.canAttack) {
      console.log(`[DEBUG] 攻撃不可: フラグがfalse`);
      return;
    }
    
    console.log(`[DEBUG] 攻撃キー検出`);
    
    // プレイヤーの正面の位置を計算
    const frontPosition = this.getFrontPosition(this.player.position, this.player.direction);
    console.log(`[DEBUG] プレイヤー位置: (${this.player.position.x}, ${this.player.position.y}), 向き: ${this.player.direction}`);
    console.log(`[DEBUG] 正面位置: (${frontPosition.x}, ${frontPosition.y})`);
    
    // 正面のセルを取得
    const frontCell = this.systems.dungeonManager.getCellAt(frontPosition);
    console.log(`[DEBUG] 正面セル情報:`, frontCell);
    
    if (frontCell && frontCell.entities.length > 0) {
      // 正面に敵がいる場合：通常の攻撃（アイテムは対象外）
      console.log(`[DEBUG] 正面エンティティ数: ${frontCell.entities.length}`);
      const nonItems = frontCell.entities.filter(e => !(e instanceof ItemEntity));
      const target = nonItems[0];
      console.log(`[DEBUG] ターゲット:`, target);
      
      if (target && target.id !== this.player.id) {
        console.log(`[DEBUG] 攻撃試行: プレイヤー(${this.player.id}) -> ターゲット(${target.id})`);
        const attackResult = this.systems.combatSystem.executeAttack({
          attacker: this.player,
          defender: target,
          attackType: 'melee'
        });
        console.log(`[DEBUG] 攻撃結果:`, attackResult);
        
        if (attackResult.success) {
          this.uiManager.addMessageWithAnimation(`攻撃成功！${target.id}に${attackResult.damage}ダメージ`);
          this.canAttack = false; // 攻撃フラグをリセット
          this.onPlayerAction('attack', true);
        } else {
          this.uiManager.addMessageWithAnimation(`攻撃失敗: ${attackResult.message}`);
        }
      } else {
        console.log(`[DEBUG] ターゲットがプレイヤー自身のため攻撃スキップ`);
      }
    } else {
      // 正面に敵がいない場合：空振り
      console.log(`[DEBUG] 空振り実行: プレイヤー(${this.player.id})`);
      this.uiManager.addMessageWithAnimation('空振り！');
      this.canAttack = false; // 攻撃フラグをリセット
      this.onPlayerAction('attack', true); // 空振りでもターン消費
    }
    
    console.log(`[DEBUG] 攻撃処理完了`);
  }

  public processMovement(): void {
    // 移動可能フラグチェック
    if (!this.canMove) {
      return;
    }
    // アイキャッチ演出中は移動処理を停止
    if (this.systems.renderer && this.systems.renderer.isInTransition()) {
      return;
    }

    // ターン制御中は移動処理をスキップ
    if (this.turnInProgress) {
      return;
    }

    // 移動処理中は重複実行を防ぐ
    if (this.movementInProgress) {
      return;
    }
    
    // クールダウン時間内は移動処理をスキップ
    const currentTime = Date.now();
    if (currentTime - this.lastMovementTime < this.MOVEMENT_COOLDOWN) {
      return;
    }

    // モーダルが開いている場合は移動を無効化（インベントリと同様）
    if (isModalOpen()) {
      return;
    }
    
    // ビット演算によるキー状態から移動方向を決定
    const up = (this.keyPress & this.KEY_UP) !== 0;
    const down = (this.keyPress & this.KEY_DOWN) !== 0;
    const left = (this.keyPress & this.KEY_LEFT) !== 0;
    const right = (this.keyPress & this.KEY_RIGHT) !== 0;
    
    // キーが押されていない場合は処理をスキップ
    if (!up && !down && !left && !right) {
      return;
    }
    
    // 移動方向を決定（同時押しを優先）
    let direction: string | null = null;
    
    // 同時押しによる斜め移動を最優先
    if (up && right) {
      direction = 'northeast';
      console.log(`[DEBUG] 北東移動検出（同時押し）`);
    } else if (up && left) {
      direction = 'northwest';
      console.log(`[DEBUG] 北西移動検出（同時押し）`);
    } else if (down && right) {
      direction = 'southeast';
      console.log(`[DEBUG] 南東移動検出（同時押し）`);
    } else if (down && left) {
      direction = 'southwest';
      console.log(`[DEBUG] 南西移動検出（同時押し）`);
    }
    // 単体キーによる直線移動
    else if (up) {
      direction = 'up';
      console.log(`[DEBUG] 上移動検出（単体キー）`);
    } else if (down) {
      direction = 'down';
      console.log(`[DEBUG] 下移動検出（単体キー）`);
    } else if (left) {
      direction = 'left';
      console.log(`[DEBUG] 左移動検出（単体キー）`);
    } else if (right) {
      direction = 'right';
      console.log(`[DEBUG] 右移動検出（単体キー）`);
    }
    
    if (!direction) {
      console.log(`[DEBUG] 移動方向なし - 移動処理をスキップ`);
      return; // 移動なし
    }
    
    console.log(`[DEBUG] 最終移動方向決定: ${direction}`);
    
    // 移動実行
    const current = this.player.position;
    const next = this.get8DirectionPosition(current, direction);
    
    console.log(`[DEBUG] 移動実行: 現在(${current.x}, ${current.y}) -> 目標(${next.x}, ${next.y})`);
    
    // プレイヤーの向きを更新
    const directionMap: Record<string, 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest'> = {
      'up': 'north', 'down': 'south', 'left': 'west', 'right': 'east',
      'northeast': 'northeast', 'southeast': 'southeast', 'southwest': 'southwest', 'northwest': 'northwest'
    };
    this.player.direction = directionMap[direction] || 'south';
    
    // MovementSystem用の方向変換
    const movementDirectionMap: Record<string, string> = {
      'up': 'north', 'down': 'south', 'left': 'west', 'right': 'east',
      'northeast': 'northeast', 'southeast': 'southeast', 'southwest': 'southwest', 'northwest': 'northwest'
    };
    const movementDirection = movementDirectionMap[direction] || direction;
    
    // 移動処理を実行
    if (next && !this.inventoryOpen && !isModalOpen() && next.x !== undefined && next.y !== undefined) {
      // 移動処理開始フラグを設定
      this.movementInProgress = true;
      this.lastMovementTime = Date.now();
      
      console.log(`[DEBUG] 移動処理開始: プレイヤー位置(${this.player.position.x}, ${this.player.position.y}) -> 目標位置(${next.x}, ${next.y})`);
      
      // 目標位置の詳細情報を確認
      const targetCell = this.systems.dungeonManager.getCellAt(next);
      if (targetCell) {
        console.log(`[DEBUG] 目標位置の詳細:`, {
          position: next,
          type: targetCell.type,
          walkable: targetCell.walkable,
          transparent: targetCell.transparent,
          entities: targetCell.entities.length
        });
      }
      
      // 移動を試行
      console.log(`[DEBUG] 移動試行: プレイヤー(${this.player.id}) -> 方向(${movementDirection})`);
      const moveResult = this.systems.movementSystem.attemptMoveWithActionResult(this.player, movementDirection as any);
      console.log(`[DEBUG] 移動結果:`, moveResult);
      
      // 移動成功時の処理
      if (moveResult.success) {
        console.log(`[DEBUG] 移動成功: プレイヤー位置更新`);
        
        // 移動フラグをリセット
        this.canMove = false;
        
        // 階段タイルの処理
        const currentCell = this.systems.dungeonManager.getCellAt(next);
        if (currentCell && (currentCell.type === 'stairs-down' || currentCell.type === 'stairs-up')) {
          this.handleStairs(next);
        }
        
        // プレイヤー行動ハンドラーでターン処理
        this.onPlayerAction('move', true);
      } else {
        console.log(`[DEBUG] 移動失敗: ${moveResult.message}`);
        // 移動失敗時のメッセージは表示しない
      }
      
      // 移動処理完了後にフラグをリセット
      this.movementInProgress = false;
    }
  }

  private async handleStairs(position: Position): Promise<void> {
    const dir = this.systems.dungeonManager.getCurrentProgressionDirection();
    const title = dir === 'down' ? this.config.messages.ui.stairsConfirmDown : this.config.messages.ui.stairsConfirmUp;
    
    try {
      const res = await openChoiceModal({
        title,
        options: [
          { id: 'yes', label: 'はい' },
          { id: 'no', label: 'いいえ' },
        ],
        defaultIndex: 0,
      });

      if (res.type === 'ok' && res.selectedId === 'yes') {
        try {
          const result = await this.systems.multipleDungeonSystem.advanceFloorWithPlayer(this.player);
          if (result.success) {
            if (result.isCompleted) {
              this.uiManager.addMessageWithAnimation(result.message);
            } else {
              this.uiManager.addMessageWithAnimation(dir === 'down' ? this.config.messages.ui.stairsConfirmDown : this.config.messages.ui.stairsAdvanceUp);
            }
            // フロア移動直後にキー状態をリセット（押しっぱなし誤検知対策）
            this.resetKeyState();
            this.canMove = true;
            this.canAttack = true;
          } else {
            this.uiManager.addMessageWithAnimation('フロア進行に失敗しました');
          }
          this.onRender();
        } catch (error) {
          console.error('[ERROR] 移動時の階段進行中にエラー:', error);
          this.uiManager.addMessageWithAnimation('フロア進行中にエラーが発生しました');
          this.onRender();
        }
      } else {
        this.uiManager.addMessageWithAnimation(this.config.messages.ui.stairsDecline);
        this.onRender();
      }
    } catch (error) {
      console.error('[ERROR] 階段確認モーダルでエラー:', error);
    }
  }

  public updateTurnControl(): void {
    // ターン制御チェック
    if (this.turnInProgress) {
      const elapsed = Date.now() - this.turnStartTime;
      const currentTurnDuration = this.isFastMode ? this.TURN_DURATION_FAST : this.TURN_DURATION;
      if (elapsed < currentTurnDuration) {
        // まだターン持続時間経過していない → 移動処理をスキップ
        return;
      }
      // ターン持続時間経過 → 行動フラグをリセット
      this.turnInProgress = false;
      this.canMove = true;
      this.canAttack = true;
      console.log(`[DEBUG] ターン制御完了: 行動フラグリセット (経過時間: ${elapsed}ms, モード: ${this.isFastMode ? '高速' : '通常'})`);
    }
  }

  public startTurnControl(): void {
    // ターン制御フラグを設定（1秒間待機開始）
    this.turnInProgress = true;
    this.turnStartTime = Date.now();
    console.log(`[DEBUG] ターン制御開始: 行動フラグはfalseのまま (経過時間: 0ms)`);
  }

  public setInventoryOpen(open: boolean): void {
    this.inventoryOpen = open;
    this.uiManager.setInventoryModalOpen(open);
    if (open) this.renderInventory();
  }

  private renderInventory(): void {
    this.uiManager.updateInventoryList(this.player.inventory);
  }

  public resetKeyState(): void {
    this.keyPress = 0;
    this.keyTrg = 0;
  }

  // 8方向の移動方向をPositionに変換する関数
  private get8DirectionPosition(current: Position, direction: string): Position {
    switch (direction) {
      case 'up': return { x: current.x, y: current.y - 1 };
      case 'down': return { x: current.x, y: current.y + 1 };
      case 'left': return { x: current.x - 1, y: current.y };
      case 'right': return { x: current.x + 1, y: current.y };
      case 'northeast': return { x: current.x + 1, y: current.y - 1 };
      case 'southeast': return { x: current.x + 1, y: current.y + 1 };
      case 'southwest': return { x: current.x - 1, y: current.y + 1 };
      case 'northwest': return { x: current.x - 1, y: current.y - 1 };
      default: return current;
    }
  }
  
  // プレイヤーの正面位置を計算する関数
  private getFrontPosition(current: Position, direction: string): Position {
    switch (direction) {
      case 'north': return { x: current.x, y: current.y - 1 };
      case 'south': return { x: current.x, y: current.y + 1 };
      case 'west': return { x: current.x - 1, y: current.y };
      case 'east': return { x: current.x + 1, y: current.y };
      case 'northeast': return { x: current.x + 1, y: current.y - 1 };
      case 'southeast': return { x: current.x + 1, y: current.y + 1 };
      case 'southwest': return { x: current.x - 1, y: current.y + 1 };
      case 'northwest': return { x: current.x - 1, y: current.y - 1 };
      default: return { x: current.x, y: current.y + 1 }; // デフォルトは南向き
    }
  }

  public getInventoryOpen(): boolean {
    return this.inventoryOpen;
  }

  public getCanMove(): boolean {
    return this.canMove;
  }

  public getCanAttack(): boolean {
    return this.canAttack;
  }

  public getTurnInProgress(): boolean {
    return this.turnInProgress;
  }
}
