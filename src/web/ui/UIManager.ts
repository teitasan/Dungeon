import type { GameConfig } from '../../types/core.js';

export class UIManager {
  private config: GameConfig;
  private appElement: HTMLElement;

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
        grid-template-columns: ${layout.gridTemplateColumns}; 
        grid-template-rows: ${layout.gridTemplateRows}; 
        max-width: ${layout.maxWidth}px; 
        width: 100%; 
        margin: 0 auto;
      ">
        <canvas id="game" class="map"></canvas>
        <div id="sidebar">
          <div id="bottom">
            <canvas id="minimap" style="width: ${minimap.width}px;"></canvas>
            <div id="messages" class="messages"></div>
          </div>
        </div>
      </div>
      <div id="inventoryModal">
        <div>
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
   * 新しいメッセージを追加してアニメーション表示
   */
  addMessageWithAnimation(message: string): void {
    const messagesElement = document.getElementById('messages');
    if (messagesElement) {
      const charCount = message.length;
      const animatedMessage = `<span class="typing-message" style="--char-count: ${charCount}">${message}</span>`;
      
      // 既存のメッセージに新しいメッセージを追加
      const currentContent = messagesElement.textContent || '';
      const messages = currentContent.split('\n').filter(m => m.trim() !== '');
      messages.push(message);
      
      // 最大行数制限
      const maxLines = this.config.ui.messages.maxLines;
      const displayMessages = messages.slice(-maxLines);
      
      // 最新メッセージだけアニメーション、他は通常表示
      const formattedMessages = displayMessages.map((msg, index) => {
        if (index === displayMessages.length - 1) {
          const count = msg.length;
          return `<span class="typing-message" style="--char-count: ${count}">${msg}</span>`;
        } else {
          return msg;
        }
      });
      
      messagesElement.innerHTML = formattedMessages.join('\n');
    }
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

    list.innerHTML = '';
    if (items.length === 0) {
      const li = document.createElement('li');
      li.textContent = '（空）';
      li.className = 'empty';
      list.appendChild(li);
    } else {
      items.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item.name || item.id;
        list.appendChild(li);
      });
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
}
