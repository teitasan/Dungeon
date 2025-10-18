import type { GameConfig } from '../../types/core.js';
import type { Item } from '../../types/entities.js';
import { DamageDisplayManager } from '../DamageDisplayManager.js';
import type { ItemSpriteManager } from '../ItemSpriteManager.js';

type InventoryDisplayItem = {
  id: string;
  name: string;
  identified: boolean;
  itemType?: Item['itemType'];
  spriteId?: string;
  gridPosition?: Item['gridPosition'];
  getDisplayName?: () => string;
};

export class UIManager {
  private config: GameConfig;
  private appElement: HTMLElement;
  private selectedInventoryIndex: number = 0;
  private currentInventoryItems: InventoryDisplayItem[] = [];
  // グリッドインベントリ用の状態
  private selectedGridX: number = 0;
  private selectedGridY: number = 0;
  // メッセージ表示制御用の内部状態
  private messageQueue: string[] = [];
  private isAnimating: boolean = false;
  private displayedMessages: string[] = [];
  private damageDisplayManager: DamageDisplayManager | null = null;
  private lastExpCurrent: number | null = null;
  private lastExpRequired: number | null = null;
  private lastLevel: number | null = null;
  private expAnimationStartPercent: number | null = null;
  private expAnimationTargetPercent: number | null = null;
  private expAnimationStartTime: number | null = null;
  private isLevelingUp: boolean = false;
  // アイテムスプライトマネージャー
  private itemSpriteManager: ItemSpriteManager | null = null;

  constructor(config: GameConfig, appElement: HTMLElement) {
    this.config = config;
    this.appElement = appElement;
  }

  /**
   * UIレイアウトを作成
   */
  createLayout(): void {
    const { layout, viewport, minimap, messages } = this.config.ui;
    
    this.appElement.innerHTML = `
      <div id="layout" style="
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-width: ${layout.maxWidth}px; 
        width: 100%; 
        margin: 0 auto;
      ">
        <div id="top-row" style="display: flex; gap: 6px;">
          <div id="game-area">
            <div id="game-wrapper" class="window-frame">
              <canvas id="game" class="map"></canvas>
              <!-- ミニマップをゲームキャンバス上にオーバーレイ表示 -->
              <div id="minimap-overlay" class="minimap-overlay">
                <canvas id="minimap"></canvas>
              </div>
              <!-- フロア移動時の暗転オーバーレイ -->
              <div id="transition-overlay" class="transition-overlay">
                <canvas id="transition-canvas"></canvas>
              </div>
              <!-- ゲーム画面を隠す黒いオーバーレイ（Mキーで切り替え） -->
              <div id="game-hide-overlay" class="game-hide-overlay"></div>
            </div>
          </div>
          <div id="right-panel" style="display: flex; flex-direction: column; gap: 6px;">
            <div id="map-title-area" class="map-title-area window-frame">
              <div id="map-title" class="map-title">Loading...</div>
            </div>
            <div id="status-window" class="status-window window-frame">
              <h3>Status</h3>
              <div id="player-stats">
                <div class="stat-panel">
                  <div class="stat-row level-exp-row">
                    <div class="level-circle-container">
                      <div class="level-circle">
                        <span id="level-text" class="level-text">1</span>
                      </div>
                    </div>
                    <div class="exp-container">
                      <div class="stat-label">EXP</div>
                      <div class="stat-value" id="exp-text"></div>
                    </div>
                  </div>
                  <div class="stat-group">
                    <div class="stat-row">
                      <span class="stat-label">HP</span>
                      <span id="hp-text" class="stat-text"></span>
                    </div>
                    <div class="stat-bar-row">
                      <div class="stat-bar">
                        <div id="hp-bar" class="stat-fill hp-fill"></div>
                      </div>
                    </div>
                  </div>
                  <div class="stat-group">
                    <div class="stat-row">
                      <span class="stat-label">MP</span>
                      <span id="mp-text" class="stat-text"></span>
                    </div>
                    <div class="stat-bar-row">
                      <div class="stat-bar">
                        <div id="mp-bar" class="stat-fill mp-fill"></div>
                      </div>
                    </div>
                  </div>
                  <div class="stat-group">
                    <div class="stat-row">
                      <span class="stat-label">Hunger</span>
                      <span id="hunger-text" class="stat-text"></span>
                    </div>
                    <div class="stat-bar-row">
                      <div class="stat-bar">
                        <div id="hunger-bar" class="stat-fill hunger-fill"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="stat-section-title">Attributes</div>
                <div class="stat-panel">
                  <div class="stat-row stat-row-pair">
                    <div class="stat-column">
                      <span class="stat-label">STR</span>
                      <span id="str-text" class="stat-value"></span>
                    </div>
                    <div class="stat-column">
                      <span class="stat-label">DEX</span>
                      <span id="dex-text" class="stat-value"></span>
                    </div>
                  </div>
                  <div class="stat-row stat-row-pair">
                    <div class="stat-column">
                      <span class="stat-label">INT</span>
                      <span id="int-text" class="stat-value"></span>
                    </div>
                    <div class="stat-column">
                      <span class="stat-label">CON</span>
                      <span id="con-text" class="stat-value"></span>
                    </div>
                  </div>
                  <div class="stat-row stat-row-pair">
                    <div class="stat-column">
                      <span class="stat-label">POW</span>
                      <span id="pow-text" class="stat-value"></span>
                    </div>
                    <div class="stat-column">
                      <span class="stat-label">LUK</span>
                      <span id="luk-text" class="stat-value"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div id="bottom">
          <div id="messages" class="messages window-frame"></div>
        </div>
      </div>
      <div id="inventoryModal">
        <div class="window-frame">
          <div class="title">Inventory</div>
          <div id="inventoryGrid" class="inventory-grid"></div>
          <div class="controls">矢印:移動 / Z:決定 / X:閉じる</div>
        </div>
      </div>
    `;
  }

  /**
   * ミニマップのサイズを設定
   */
  setupMinimap(): HTMLCanvasElement | null {
    const minimap = document.getElementById('minimap') as HTMLCanvasElement;
    if (minimap) {
      // オーバーレイ表示用のサイズに固定（60×45タイル × 6px）
      minimap.width = 360;
      minimap.height = 270;
    }
    return minimap;
  }

  /**
   * メッセージを表示
   */
  displayMessage(message: string): void {
    const messagesElement = document.getElementById('messages');
    if (messagesElement) {
      this.displayedMessages = [message];
      messagesElement.textContent = message;
    }
  }

  /**
   * 複数行のメッセージを表示
   */
  displayMessages(messages: string[]): void {
    const messagesElement = document.getElementById('messages');
    if (messagesElement) {
      const maxLines = this.config.ui.messages.maxLines;
      this.displayedMessages = messages.slice(-maxLines);
      messagesElement.textContent = this.displayedMessages.join('\n');
    }
  }

  /**
   * プレイヤーのHPを更新
   */
  updatePlayerHealth(current: number, max: number): void {
    this.updateStatusHPBar(current, max);
  }

  /**
   * プレイヤーの満腹度を更新
   */
  updatePlayerHunger(current: number, max: number): void {
    this.updateStatusHungerBar(current, max);
  }

  /**
   * プレイヤーの位置を更新
   */
  updatePlayerPosition(x: number, y: number): void {
    // 位置表示の更新処理（必要に応じて実装）
    console.log(`[UIManager] Player Position: (${x}, ${y})`);
  }

  /**
   * モンスター情報を更新
   */
  updateMonsterInfo(monsters: any[]): void {
    // モンスター情報表示の更新処理（必要に応じて実装）
    console.log(`[UIManager] Monster count: ${monsters.length}`);
  }

  /**
   * 床アイテム情報を更新
   */
  updateGroundItemsInfo(items: any[]): void {
    // 床アイテム情報表示の更新処理（必要に応じて実装）
    console.log(`[UIManager] Ground items count: ${items.length}`);
  }

  /**
   * 新しいメッセージを追加してアニメーション表示
   */
  addMessageWithAnimation(message: string): void {
    // 競合回避のため、メッセージはキューで逐次処理
    this.messageQueue.push(message);
    this.processMessageQueue();
  }

  /**
   * 複数行を順次アニメーション表示
   */
  private animateMultipleLines(existingMessages: string[], newLines: string[], currentIndex: number): void {
    const messagesElement = document.getElementById('messages');
    if (!messagesElement || currentIndex >= newLines.length) return;
    
    const currentLine = newLines[currentIndex];
    const allMessages = [...existingMessages, ...newLines.slice(0, currentIndex + 1)];
    
    // 最大行数制限
    const maxLines = this.config.ui.messages.maxLines;
    const displayMessages = allMessages.slice(-maxLines);
    
    // 現在の行だけアニメーション、他は通常表示
    const formattedMessages = displayMessages.map((msg, index) => {
      if (index === displayMessages.length - 1 && currentIndex < newLines.length) {
        const count = msg.length;
        return `<span class="typing-message" style="--char-count: ${count}">${msg}</span>`;
      } else {
        return msg;
      }
    });
    
    messagesElement.innerHTML = formattedMessages.join('\n');
    
    // アニメーション完了イベントを待ってから次の行を表示
    const animatedElement = messagesElement.querySelector('.typing-message') as HTMLElement;
    if (animatedElement) {
      animatedElement.addEventListener('animationend', () => {
        this.animateMultipleLines(existingMessages, newLines, currentIndex + 1);
      }, { once: true }); // 一度だけ実行
    }
  }

  /**
   * メッセージキュー処理（1件ずつアニメーション）
   */
  private processMessageQueue(): void {
    if (this.isAnimating) return;
    const next = this.messageQueue.shift();
    if (!next) return;
    this.isAnimating = true;

    const maxCharsPerLine = 44; // 1行あたり最大文字数
    const lines = this.splitLongMessage(next, maxCharsPerLine);
    this.animateLinesSequentially(lines, 0);
  }

  /**
   * 新しい実装: 複数行を順次アニメーション表示（内部状態と同期）
   */
  private animateLinesSequentially(newLines: string[], index: number): void {
    const messagesElement = document.getElementById('messages');
    if (!messagesElement) {
      // DOMが無い場合でも状態は更新して次へ
      while (index < newLines.length) {
        this.displayedMessages.push(newLines[index++]);
        const maxLines = this.config.ui.messages.maxLines;
        this.displayedMessages = this.displayedMessages.slice(-maxLines);
      }
      this.isAnimating = false;
      this.processMessageQueue();
      return;
    }

    // 行を追加し、末尾のみタイプアニメーション
    this.displayedMessages.push(newLines[index]);
    const maxLines = this.config.ui.messages.maxLines;
    this.displayedMessages = this.displayedMessages.slice(-maxLines);

    const html = this.displayedMessages
      .map((msg, i, arr) => {
        if (i === arr.length - 1) {
          const count = msg.length;
          return `<span class=\"typing-message\" style=\"--char-count: ${count}\">${msg}</span>`;
        }
        return msg;
      })
      .join('\n');

    messagesElement.innerHTML = html;

    const animated = messagesElement.querySelector('.typing-message') as HTMLElement | null;
    if (!animated) {
      // フォールバック（アニメ無しで続行）
      if (index + 1 < newLines.length) {
        this.animateLinesSequentially(newLines, index + 1);
      } else {
        this.isAnimating = false;
        this.processMessageQueue();
      }
      return;
    }

    animated.addEventListener(
      'animationend',
      () => {
        if (index + 1 < newLines.length) {
          this.animateLinesSequentially(newLines, index + 1);
        } else {
          this.isAnimating = false;
          this.processMessageQueue();
        }
      },
      { once: true }
    );
  }

  /**
   * 長いメッセージを適切な長さで分割
   */
  private splitLongMessage(message: string, maxCharsPerLine: number): string[] {
    if (message.length <= maxCharsPerLine) {
      return [message];
    }
    
    const lines: string[] = [];
    let currentLine = '';
    
    for (let i = 0; i < message.length; i++) {
      currentLine += message[i];
      
      if (currentLine.length >= maxCharsPerLine) {
        lines.push(currentLine);
        currentLine = '';
      }
    }
    
    // 残りの文字があれば追加
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  /**
   * インベントリモーダルの表示状態を設定
   */
  setInventoryModalOpen(open: boolean): void {
    const modal = document.getElementById('inventoryModal') as HTMLElement;
    if (modal) {
      modal.style.display = open ? 'grid' : 'none';
    }
  }

  /**
   * インベントリグリッドを更新
   */
  updateInventoryGrid(items: InventoryDisplayItem[]): void {
    const grid = document.getElementById('inventoryGrid') as HTMLElement;
    if (!grid) return;

    // 現在のインベントリアイテムを保存
    this.currentInventoryItems = items;

    // グリッドをクリア
    grid.innerHTML = '';

    // 5x4のグリッドを作成
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 5; x++) {
        const slot = document.createElement('div');
        slot.className = 'grid-slot';
        slot.dataset.x = x.toString();
        slot.dataset.y = y.toString();

        // 選択中のスロットをハイライト
        if (x === this.selectedGridX && y === this.selectedGridY) {
          slot.classList.add('selected');
        }

        // この位置にあるアイテムを探す
        const item = this.findItemAtGridPosition(items, x, y);
        if (item) {
          slot.classList.add('occupied');
          
          // アイテムスプライトを表示（床アイテムと同じ方法）
          const sprite = document.createElement('canvas');
          sprite.className = 'item-sprite';
          sprite.width = 32; // インベントリ用のサイズ
          sprite.height = 32;
          
          // スプライトマネージャーを使って描画
          if (this.itemSpriteManager && this.itemSpriteManager.isLoaded() && item.spriteId) {
            const ctx = sprite.getContext('2d');
            if (ctx) {
              this.itemSpriteManager.drawItemSprite(ctx, item.spriteId, 0, 0, 32);
            }
          } else {
            // フォールバック: 文字で表示
            const ctx = sprite.getContext('2d');
            if (ctx) {
              this.renderItemFallback(ctx, item, 0, 0, 32);
            }
          }
          
          slot.appendChild(sprite);
        }

        grid.appendChild(slot);
      }
    }
  }

  /**
   * 指定座標にあるアイテムを検索
   */
  private findItemAtGridPosition(items: InventoryDisplayItem[], x: number, y: number): InventoryDisplayItem | null {
    return items.find(item => 
      (item as any).gridPosition && 
      (item as any).gridPosition.x === x && 
      (item as any).gridPosition.y === y
    ) || null;
  }

  /**
   * アイテムの表示文字を取得
   */
  private getItemDisplayChar(item: InventoryDisplayItem): string {
    if (!item.identified) {
      return '?';
    }

    switch (item.itemType) {
      case 'weapon-melee':
        return '⚔';
      case 'weapon-ranged':
        return '🏹';
      case 'armor':
        return '🛡';
      case 'accessory':
        return '💍';
      case 'consumable':
        return '🧪';
      default:
        return '📦';
    }
  }

  /**
   * フォールバック描画（床アイテムと同じ方法）
   */
  private renderItemFallback(ctx: CanvasRenderingContext2D, item: InventoryDisplayItem, x: number, y: number, tileSize: number): void {
    const glyph = item.name ? item.name.charAt(0).toUpperCase() : 'I';
    
    // 背景をクリア
    ctx.clearRect(x, y, tileSize, tileSize);
    
    // 文字を描画
    ctx.fillStyle = '#ede1c6';
    ctx.font = `${tileSize * 0.8}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, x + tileSize / 2, y + tileSize / 2);
  }

  /**
   * インベントリ表示用のラベルを返却（未鑑定アイテムは匿名表示）
   */
  getInventoryItemLabel(item: InventoryDisplayItem): string {
    const displayName = item.getDisplayName?.();
    if (displayName) {
      return displayName;
    }

    if (item.identified === false) {
      switch (item.itemType) {
        case 'weapon-melee':
          return 'Unknown Weapon';
        case 'weapon-ranged':
          return 'Unknown Ranged Weapon';
        case 'armor':
          return 'Unknown Armor';
        case 'accessory':
          return 'Unknown Accessory';
        case 'consumable':
        default:
          return 'Unknown Item';
      }
    }

    if (item.name && item.name.length > 0) {
      return item.name;
    }

    return item.id || 'Unknown Item';
  }

  /**
   * 選択されたインベントリアイテムを取得
   */
  getSelectedInventoryItem(): InventoryDisplayItem | null {
    return this.findItemAtGridPosition(this.currentInventoryItems, this.selectedGridX, this.selectedGridY);
  }

  /**
   * インベントリ選択を移動（グリッド版）
   */
  moveInventorySelection(direction: 'up' | 'down' | 'left' | 'right'): void {
    const oldX = this.selectedGridX;
    const oldY = this.selectedGridY;
    
    switch (direction) {
      case 'up':
        this.selectedGridY = Math.max(0, this.selectedGridY - 1);
        break;
      case 'down':
        this.selectedGridY = Math.min(3, this.selectedGridY + 1);
        break;
      case 'left':
        this.selectedGridX = Math.max(0, this.selectedGridX - 1);
        break;
      case 'right':
        this.selectedGridX = Math.min(4, this.selectedGridX + 1);
        break;
    }
    
    // 位置が変更された場合のみ更新
    if (oldX !== this.selectedGridX || oldY !== this.selectedGridY) {
      this.updateInventoryGrid(this.currentInventoryItems);
    }
  }

  /**
   * ゲームキャンバスを取得
   */
  getGameCanvas(): HTMLCanvasElement | null {
    return document.getElementById('game') as HTMLCanvasElement;
  }

  /**
   * ミニマップキャンバスを取得
   */
  getMinimapCanvas(): HTMLCanvasElement | null {
    return document.getElementById('minimap') as HTMLCanvasElement;
  }

  /**
   * ミニマップの表示/非表示を切り替え
   */
  toggleMinimap(): void {
    const overlay = document.getElementById('minimap-overlay') as HTMLElement;
    if (overlay) {
      const isVisible = overlay.style.display !== 'none';
      overlay.style.display = isVisible ? 'none' : 'block';
    }
  }

  /**
   * ミニマップを表示
   */
  showMinimap(): void {
    const overlay = document.getElementById('minimap-overlay') as HTMLElement;
    if (overlay) {
      overlay.style.display = 'block';
    }
  }

  /**
   * ミニマップを非表示
   */
  hideMinimap(): void {
    const overlay = document.getElementById('minimap-overlay') as HTMLElement;
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  /**
   * ゲーム情報オーバーレイを作成（削除済み）
   */
  createGameInfoOverlay(): void {
    // オーバーレイは削除されました
  }

  /**
   * ゲーム情報オーバーレイを更新（削除済み）
   */
  updateGameInfoOverlay(data: {
    floor: number;
    level: number;
    currentHp: number;
    maxHp: number;
    hungerCurrent: number;
    hungerMax: number;
    gold: number;
    turn: number;
  }): void {
    // オーバーレイは削除されました
  }

  /**
   * ゲーム情報オーバーレイを表示/非表示（削除済み）
   */
  setGameInfoOverlayVisible(visible: boolean): void {
    // オーバーレイは削除されました
  }

  /**
   * ステータスウィンドウを更新
   */
  updateStatusWindow(player: any): void {
    // プレイヤー名の更新（ステータスウィンドウのタイトル）
    const statusTitle = document.querySelector('#status-window h3');
    if (statusTitle) {
      const playerName = player?.name || 'プレイヤー名';
      statusTitle.textContent = playerName;
    }

    // HP更新（新しいキャラクターシステムを使用）
    const currentHp = player?.characterStats?.hp?.current;
    const maxHp = player?.characterStats?.hp?.max;
    if (currentHp !== undefined && maxHp !== undefined) {
      this.updateStatusHPBar(currentHp, maxHp);
    }

    // MP更新（新しいキャラクターシステムを使用）
    const currentMp = player?.characterStats?.mp?.current;
    const maxMp = player?.characterStats?.mp?.max;
    if (currentMp !== undefined && maxMp !== undefined) {
      this.updateStatusMPBar(currentMp, maxMp);
    }

    // 空腹度更新
    if (player.hunger !== undefined && player.maxHunger !== undefined) {
      this.updateStatusHungerBar(player.hunger, player.maxHunger);
    }

    // レベル更新（円形プログレス）
    const levelText = document.getElementById('level-text');
    const levelCircle = document.querySelector('.level-circle') as HTMLElement;
    const levelVal = player?.characterStats?.level;
    const expCurrent = player?.characterStats?.experience?.current;
    const expRequired = player?.characterStats?.experience?.required;
    
    // レベルが変更された場合のみ更新
    if (levelText && levelVal !== undefined && this.lastLevel !== levelVal) {
      levelText.textContent = levelVal.toString();
      this.lastLevel = levelVal;
    }
    
    // 経験値が変更された場合のみ更新
    if (levelCircle && expCurrent !== undefined && expRequired !== undefined) {
      if (this.lastExpCurrent !== expCurrent || this.lastExpRequired !== expRequired) {
        // レベルアップ判定：初回ロード時は除外し、必要経験値が大幅に増加した場合のみ
        const isInitialLoad = this.lastExpRequired === null;
        const requiredExpIncreased = !isInitialLoad && expRequired > (this.lastExpRequired || 0);
        const willLevelUp = requiredExpIncreased;
        
        if (isInitialLoad) {
          // 初回ロード時：アニメーションなしで直接設定
          const expRatio = Math.max(0, Math.min(1, expCurrent / expRequired));
          const progressPercent = expRatio * 100;
          levelCircle.style.setProperty('--progress', `${progressPercent}%`);
        } else {
          // 通常時：アニメーション開始
          this.startExpAnimation(expCurrent, expRequired, levelCircle, willLevelUp);
        }
        
        // 値を更新
        this.lastExpCurrent = expCurrent;
        this.lastExpRequired = expRequired;
      }
    }

    // EXP更新
    const expText = document.getElementById('exp-text');
    if (expText && expCurrent !== undefined && expRequired !== undefined) {
      expText.textContent = `${expCurrent}/${expRequired}`;
    }

    // ステータス更新
    const strText = document.getElementById('str-text');
    const strVal = player?.characterInfo?.stats?.STR;
    if (strText && strVal !== undefined) {
      strText.textContent = strVal.toString();
    }

    const dexText = document.getElementById('dex-text');
    const dexVal = player?.characterInfo?.stats?.DEX;
    if (dexText && dexVal !== undefined) {
      dexText.textContent = dexVal.toString();
    }

    const intText = document.getElementById('int-text');
    const intVal = player?.characterInfo?.stats?.INT;
    if (intText && intVal !== undefined) {
      intText.textContent = intVal.toString();
    }

    const conText = document.getElementById('con-text');
    const conVal = player?.characterInfo?.stats?.CON;
    if (conText && conVal !== undefined) {
      conText.textContent = conVal.toString();
    }

    const powText = document.getElementById('pow-text');
    const powVal = player?.characterInfo?.stats?.POW;
    if (powText && powVal !== undefined) {
      powText.textContent = powVal.toString();
    }

    const appText = document.getElementById('app-text');
    const appVal = player?.characterInfo?.stats?.APP;
    if (appText && appVal !== undefined) {
      appText.textContent = appVal.toString();
    }

    const lukText = document.getElementById('luk-text');
    const lukVal = player?.characterInfo?.stats?.LUK;
    if (lukText && lukVal !== undefined) {
      lukText.textContent = lukVal.toString();
    }
  }

  /**
   * ステータスウィンドウのHPバーを更新
   */
  private updateStatusHPBar(currentHP: number, maxHP: number): void {
    const hpBar = document.getElementById('hp-bar') as HTMLElement;
    const hpText = document.getElementById('hp-text') as HTMLElement;
    
    if (hpBar && hpText) {
      const hpRatio = Math.max(0, Math.min(1, currentHP / maxHP));
      hpBar.style.width = `${hpRatio * 100}%`;
      hpText.textContent = `${Math.floor(currentHP)}/${Math.floor(maxHP)}`;
      
      // HPバーは常に緑色
      hpBar.className = 'stat-fill hp-fill';
    }
  }

  /**
   * ステータスウィンドウのEXPバーを更新
   */
  private updateStatusExpBar(currentExp: number, requiredExp: number): void {
    const levelCircle = document.querySelector('.level-circle') as HTMLElement;
    
    if (levelCircle) {
      const expRatio = Math.max(0, Math.min(1, currentExp / requiredExp));
      const progressPercent = expRatio * 100;
      levelCircle.style.setProperty('--progress', `${progressPercent}%`);
    }
  }

  /**
   * ステータスウィンドウのMPバーを更新
   */
  private updateStatusMPBar(currentMP: number, maxMP: number): void {
    const mpBar = document.getElementById('mp-bar') as HTMLElement;
    const mpText = document.getElementById('mp-text') as HTMLElement;
    
    if (mpBar && mpText) {
      const mpRatio = Math.max(0, Math.min(1, currentMP / maxMP));
      mpBar.style.width = `${mpRatio * 100}%`;
      mpText.textContent = `${Math.floor(currentMP)}/${Math.floor(maxMP)}`;
      
      // MPの割合に応じて色を変更（青系）
      mpBar.className = 'stat-fill mp-fill'; // 基本クラスをリセット
      
      if (mpRatio <= 0.25) {
        // 25%以下は赤
        mpBar.classList.add('mp-red');
      } else if (mpRatio <= 0.5) {
        // 50%以下は黄色
        mpBar.classList.add('mp-yellow');
      }
      // 50%以上は青（デフォルト）
    }
  }

  /**
   * ステータスウィンドウの空腹度バーを更新
   */
  private updateStatusHungerBar(currentHunger: number, maxHunger: number): void {
    const hungerBar = document.getElementById('hunger-bar') as HTMLElement;
    const hungerText = document.getElementById('hunger-text') as HTMLElement;
    
    if (hungerBar && hungerText) {
      const hungerRatio = Math.max(0, Math.min(1, currentHunger / maxHunger));
      hungerBar.style.width = `${hungerRatio * 100}%`;
      hungerText.textContent = `${Math.floor(currentHunger)}/${Math.floor(maxHunger)}`;
    }
  }

  /**
   * マップタイトルを更新
   */
  updateMapTitle(title: string): void {
    const mapTitleElement = document.getElementById('map-title');
    if (mapTitleElement) {
      mapTitleElement.textContent = title;
    }
  }

  /**
   * フロア情報からマップタイトルを生成して更新
   */
  updateMapTitleFromFloor(floor: number, dungeonName?: string): void {
    let title: string;
    
    if (dungeonName) {
      // ダンジョン名に既にフロア情報が含まれている場合はそのまま使用
      if (dungeonName.includes('Floor') || dungeonName.includes('階')) {
        title = dungeonName;
      } else {
        title = `${dungeonName} ${floor}階`;
      }
    } else {
      title = `ダンジョン ${floor}階`;
    }
    
    this.updateMapTitle(title);
  }

  /**
   * ダメージ表示マネージャーを設定
   */
  setDamageDisplayManager(manager: DamageDisplayManager): void {
    this.damageDisplayManager = manager;
  }

  /**
   * アイテムスプライトマネージャーを設定
   */
  setItemSpriteManager(manager: ItemSpriteManager): void {
    this.itemSpriteManager = manager;
  }

  /**
   * ダメージ表示を更新
   */
  updateDamageDisplay(deltaTime: number, dungeonManager: any): void {
    if (this.damageDisplayManager) {
      this.damageDisplayManager.update(deltaTime, dungeonManager);
    }
  }

  /**
   * 経験値アニメーションを開始
   */
  private startExpAnimation(targetExp: number, requiredExp: number, levelCircle: HTMLElement, willLevelUp: boolean): void {
    // 既存のアニメーションをクリア
    this.expAnimationStartPercent = null;
    this.expAnimationTargetPercent = null;
    this.expAnimationStartTime = null;
    this.isLevelingUp = false;

    // 現在のバーの進行状況を取得
    const currentProgress = levelCircle.style.getPropertyValue('--progress');
    const currentPercent = currentProgress ? parseFloat(currentProgress.replace('%', '')) : 0;
    
    if (willLevelUp) {
      // レベルアップ時：現在の位置から100%までアニメーション
      this.expAnimationStartPercent = currentPercent;
      this.expAnimationTargetPercent = 100;
      this.isLevelingUp = true; // レベルアップフラグを設定
    } else {
      // 通常時：現在の位置から新しい経験値までアニメーション
      const targetPercent = (targetExp / requiredExp) * 100;
      this.expAnimationStartPercent = currentPercent;
      this.expAnimationTargetPercent = targetPercent;
      this.isLevelingUp = false;
    }
    
    this.expAnimationStartTime = Date.now();

    console.log(`[UIManager] 経験値アニメーション開始: ${this.expAnimationStartPercent}% → ${this.expAnimationTargetPercent}% (${targetExp}/${requiredExp}) レベルアップ: ${willLevelUp}`);

    // アニメーション実行
    this.executeExpAnimation(levelCircle);
  }

  /**
   * 経験値アニメーションを実行
   */
  private executeExpAnimation(levelCircle: HTMLElement): void {
    if (this.expAnimationStartPercent === null || this.expAnimationTargetPercent === null || this.expAnimationStartTime === null) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.expAnimationStartTime;
    // 10%毎に0.3秒（300ms）掛かるように計算、最大1秒に制限
    const percentDiff = Math.abs(this.expAnimationTargetPercent - this.expAnimationStartPercent);
    const duration = Math.min((percentDiff / 10) * 300, 1000); // 10%毎に300ms、最大1秒
    const progress = Math.min(elapsed / duration, 1);

    // イージング関数（ease-out）
    const easeOut = 1 - Math.pow(1 - progress, 3);
    
    // パーセンテージを補間
    const progressPercent = this.expAnimationStartPercent + (this.expAnimationTargetPercent - this.expAnimationStartPercent) * easeOut;
    
    // レベルアップ時の特別な処理
    if (this.isLevelingUp && progressPercent >= 100) {
      // 100%で一旦停止してレベルアップアニメーション
      levelCircle.style.setProperty('--progress', '100%');
      levelCircle.classList.add('level-up');
      
      // 光るアニメーション完了後に新しいレベルのアニメーションを開始
      setTimeout(() => {
        levelCircle.classList.remove('level-up');
        
        // バーを0%にリセット
        levelCircle.style.setProperty('--progress', '0%');
        
        // 残り経験値がある場合は、新しいレベルでアニメーション開始
        const remainingExp = this.lastExpCurrent || 0;
        const newRequiredExp = this.lastExpRequired || 1;
        const remainingPercent = (remainingExp / newRequiredExp) * 100;
        
        if (remainingPercent > 0) {
          // 新しいレベルでのアニメーション開始
          this.expAnimationStartPercent = 0;
          this.expAnimationTargetPercent = remainingPercent;
          this.expAnimationStartTime = Date.now();
          this.isLevelingUp = false;
          this.executeExpAnimation(levelCircle);
        } else {
          // 残り経験値がない場合は完了
          this.expAnimationStartPercent = null;
          this.expAnimationTargetPercent = null;
          this.expAnimationStartTime = null;
          this.isLevelingUp = false;
        }
      }, 200); // 0.2秒後に新しいレベルのアニメーション開始
      
      return;
    }
    
    // 通常のアニメーション
    levelCircle.style.setProperty('--progress', `${progressPercent}%`);

    // アニメーション継続
    if (progress < 1) {
      requestAnimationFrame(() => this.executeExpAnimation(levelCircle));
    } else {
      // アニメーション完了
      this.expAnimationStartPercent = null;
      this.expAnimationTargetPercent = null;
      this.expAnimationStartTime = null;
      this.isLevelingUp = false;
    }
  }

}
