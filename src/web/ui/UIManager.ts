import type { GameConfig } from '../../types/core.js';

export class UIManager {
  private config: GameConfig;
  private appElement: HTMLElement;
  private selectedInventoryIndex: number = 0;
  private currentInventoryItems: Array<{ id: string; name?: string }> = [];

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
            </div>
          </div>
          <div id="right-panel" style="display: flex; flex-direction: column; gap: 6px;">
            <div id="map-title-area" class="map-title-area window-frame">
              <div id="map-title" class="map-title">Loading...</div>
            </div>
            <div id="status-window" class="status-window window-frame">
              <h3>Status</h3>
              <div id="player-stats">
                <div class="stat-row">
                  <span class="stat-label">HP:</span>
                  <div class="stat-bar">
                    <div id="hp-bar" class="stat-fill hp-fill"></div>
                  </div>
                  <span id="hp-text" class="stat-text">100/100</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Hunger:</span>
                  <div class="stat-bar">
                    <div id="hunger-bar" class="stat-fill hunger-fill"></div>
                  </div>
                  <span id="hunger-text" class="stat-text">100/100</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Level:</span>
                  <span id="level-text" class="stat-value">1</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Attack:</span>
                  <span id="attack-text" class="stat-value">10</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Defense:</span>
                  <span id="defense-text" class="stat-value">5</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div id="bottom">
          <div id="minimap-wrapper" class="window-frame">
            <canvas id="minimap"></canvas>
          </div>
          <div id="messages" class="messages window-frame"></div>
        </div>
      </div>
      <div id="inventoryModal">
        <div class="window-frame">
          <div class="title">Inventory</div>
          <ul id="inventoryList"></ul>
          <div class="controls">Z:決定 / X:閉じる</div>
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
      const { width, height } = this.config.ui.minimap;
      minimap.width = width;
      minimap.height = height;
    }
    return minimap;
  }

  /**
   * メッセージを表示
   */
  displayMessage(message: string): void {
    const messagesElement = document.getElementById('messages');
    if (messagesElement) {
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
      const displayMessages = messages.slice(-maxLines);
      messagesElement.textContent = displayMessages.join('\n');
    }
  }

  /**
   * プレイヤーのHPを更新
   */
  updatePlayerHealth(current: number, max: number): void {
    // HP表示の更新処理（必要に応じて実装）
    console.log(`[UIManager] Player HP: ${current}/${max}`);
  }

  /**
   * プレイヤーの満腹度を更新
   */
  updatePlayerHunger(current: number, max: number): void {
    // 満腹度表示の更新処理（必要に応じて実装）
    console.log(`[UIManager] Player Hunger: ${current}/${max}`);
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
    const messagesElement = document.getElementById('messages');
    if (messagesElement) {
      // 長いメッセージを適切な長さで分割
      const maxCharsPerLine = 44; // 1行あたりの最大文字数
      const splitMessages = this.splitLongMessage(message, maxCharsPerLine);
      
      // 既存のメッセージを取得
      const currentContent = messagesElement.textContent || '';
      const messages = currentContent.split('\n').filter(m => m.trim() !== '');
      
      if (splitMessages.length === 1) {
        // 単一行の場合は従来通り
        messages.push(splitMessages[0]);
        const maxLines = this.config.ui.messages.maxLines;
        const displayMessages = messages.slice(-maxLines);
        
        const formattedMessages = displayMessages.map((msg, index) => {
          if (index === displayMessages.length - 1) {
            const count = msg.length;
            return `<span class="typing-message" style="--char-count: ${count}">${msg}</span>`;
          } else {
            return msg;
          }
        });
        
        messagesElement.innerHTML = formattedMessages.join('\n');
      } else {
        // 複数行の場合は順次アニメーション
        this.animateMultipleLines(messages, splitMessages, 0);
      }
    }
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
   * インベントリリストを更新
   */
  updateInventoryList(items: Array<{ id: string; name?: string }>): void {
    const list = document.getElementById('inventoryList') as HTMLUListElement;
    if (!list) return;

    // 現在のインベントリアイテムを保存
    this.currentInventoryItems = items;
    this.selectedInventoryIndex = Math.min(this.selectedInventoryIndex, Math.max(0, items.length - 1));

    list.innerHTML = '';
    if (items.length === 0) {
      const li = document.createElement('li');
      li.textContent = '（空）';
      li.className = 'empty';
      list.appendChild(li);
    } else {
      items.forEach((item, index) => {
        const li = document.createElement('li');
        const label = item.name || item.id;
        li.textContent = `${index === this.selectedInventoryIndex ? '▶ ' : '  '}${label}`;
        li.style.fontFamily = 'PixelMplus, ui-monospace, Menlo, monospace';
        // 反転ハイライトは行わず、カーソル（▶）のみで選択を示す
        list.appendChild(li);
      });
    }
  }

  /**
   * 選択されたインベントリアイテムを取得
   */
  getSelectedInventoryItem(): { id: string; name?: string } | null {
    if (this.currentInventoryItems.length === 0 || this.selectedInventoryIndex >= this.currentInventoryItems.length) {
      return null;
    }
    return this.currentInventoryItems[this.selectedInventoryIndex];
  }

  /**
   * インベントリ選択を移動
   */
  moveInventorySelection(direction: 'up' | 'down'): void {
    if (this.currentInventoryItems.length === 0) return;
    
    if (direction === 'up') {
      this.selectedInventoryIndex = (this.selectedInventoryIndex - 1 + this.currentInventoryItems.length) % this.currentInventoryItems.length;
    } else {
      this.selectedInventoryIndex = (this.selectedInventoryIndex + 1) % this.currentInventoryItems.length;
    }
    
    // 選択状態を更新
    this.updateInventoryList(this.currentInventoryItems);
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
   * ゲーム情報オーバーレイを作成
   */
  createGameInfoOverlay(): void {
    const overlay = document.createElement('div');
    overlay.id = 'gameInfoOverlay';
    overlay.className = 'game-info-overlay';
    
    overlay.innerHTML = `
      <div class="info-item floor-info">B1F</div>
      <div class="info-item level-info">Lv.1</div>
      <div class="info-item turn-info">T1</div>
      <div class="info-item hp-bar-container">
        <div class="hp-bar">
          <div class="hp-fill"></div>
          <span class="hp-text">100/100</span>
        </div>
      </div>
      <div class="info-item hunger-bar-container">
        <div class="hunger-bar">
          <div class="hunger-fill"></div>
          <span class="hunger-text">100/100</span>
        </div>
      </div>
      <div class="info-item gold-info">0 G</div>
    `;
    
    // レイアウト要素内に配置（canvasと同じ親要素内）
    const layout = document.getElementById('layout');
    if (layout) {
      layout.appendChild(overlay);
    }
  }

  /**
   * ゲーム情報オーバーレイを更新
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
    const overlay = document.getElementById('gameInfoOverlay');
    if (!overlay) return;

    // フロア情報
    const floorInfo = overlay.querySelector('.floor-info');
    if (floorInfo) {
      floorInfo.textContent = `B${data.floor}F`;
    }

    // レベル情報
    const levelInfo = overlay.querySelector('.level-info');
    if (levelInfo) {
      levelInfo.textContent = `Lv.${data.level}`;
    }

    // ターン数情報
    const turnInfo = overlay.querySelector('.turn-info');
    if (turnInfo) {
      turnInfo.textContent = `T${data.turn}`;
    }

    // HPバー
    const hpFill = overlay.querySelector('.hp-fill');
    const hpText = overlay.querySelector('.hp-text');
    if (hpFill && hpText) {
      const hpRatio = Math.max(0, Math.min(1, data.currentHp / data.maxHp));
      (hpFill as HTMLElement).style.width = `${hpRatio * 100}%`;
      
      // HPに応じて色を変更
      if (hpRatio > 0.5) {
        (hpFill as HTMLElement).style.backgroundColor = '#00ff00';
      } else if (hpRatio > 0.25) {
        (hpFill as HTMLElement).style.backgroundColor = '#ffff00';
      } else {
        (hpFill as HTMLElement).style.backgroundColor = '#ff0000';
      }
      
      hpText.textContent = `${data.currentHp}/${data.maxHp}`;
    }

    // 満腹度バー
    const hungerFill = overlay.querySelector('.hunger-fill');
    const hungerText = overlay.querySelector('.hunger-text');
    if (hungerFill && hungerText) {
      const hungerRatio = Math.max(0, Math.min(1, data.hungerCurrent / data.hungerMax));
      (hungerFill as HTMLElement).style.width = `${hungerRatio * 100}%`;
      
      // 満腹度に応じて色を変更（満腹=緑 → 空腹=赤）
      if (hungerRatio > 0.5) {
        (hungerFill as HTMLElement).style.backgroundColor = '#66cc66';
      } else if (hungerRatio > 0.25) {
        (hungerFill as HTMLElement).style.backgroundColor = '#ffcc66';
      } else {
        (hungerFill as HTMLElement).style.backgroundColor = '#ff6666';
      }
      
      hungerText.textContent = `${data.hungerCurrent}/${data.hungerMax}`;
    }

    // 所持金
    const goldInfo = overlay.querySelector('.gold-info');
    if (goldInfo) {
      goldInfo.textContent = `${data.gold} G`;
    }
  }

  /**
   * ゲーム情報オーバーレイを表示/非表示
   */
  setGameInfoOverlayVisible(visible: boolean): void {
    const overlay = document.getElementById('gameInfoOverlay');
    if (overlay) {
      overlay.style.display = visible ? 'flex' : 'none';
    }
  }

  /**
   * ステータスウィンドウを更新
   */
  updateStatusWindow(player: any): void {
    // HP更新
    if (player.hp !== undefined && player.maxHp !== undefined) {
      this.updateStatusHPBar(player.hp, player.maxHp);
    }

    // 空腹度更新
    if (player.hunger !== undefined && player.maxHunger !== undefined) {
      this.updateStatusHungerBar(player.hunger, player.maxHunger);
    }

    // レベル更新
    const levelText = document.getElementById('level-text');
    if (levelText && player.level !== undefined) {
      levelText.textContent = player.level.toString();
    }

    // 攻撃力更新
    const attackText = document.getElementById('attack-text');
    if (attackText && player.attack !== undefined) {
      attackText.textContent = player.attack.toString();
    }

    // 防御力更新
    const defenseText = document.getElementById('defense-text');
    if (defenseText && player.defense !== undefined) {
      defenseText.textContent = player.defense.toString();
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
}
