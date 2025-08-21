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
        <canvas id="game" class="map" style="
          width: 100%; 
          image-rendering: pixelated;
        "></canvas>
        <div id="bottom" style="
          display: grid; 
          grid-template-columns: auto 1fr; 
          gap: 8px; 
          align-items: start;
        ">
          <canvas id="minimap" style="
            background: #000; 
            border-radius: 6px; 
            box-shadow: 0 0 0 1px #333 inset; 
            width: ${minimap.width}px; 
            height: ${minimap.height}px;
          "></canvas>
          <div id="messages" class="messages" style="
            height: ${minimap.height}px; 
            overflow: auto;
          "></div>
        </div>
      </div>
      <div id="inventoryModal" style="
        display: none; 
        position: fixed; 
        inset: 0; 
        background: rgba(0,0,0,0.5); 
        place-items: center;
      ">
        <div style="
          background: #1a1a1a; 
          color: #eee; 
          padding: 16px; 
          border-radius: 10px; 
          min-width: 280px; 
          box-shadow: 0 0 0 1px #333 inset;
        ">
          <div style="
            font-family: '${this.config.ui.fonts.primary}'; 
            font-weight: 600; 
            margin-bottom: 8px;
          ">Inventory</div>
          <ul id="inventoryList" style="
            list-style: none; 
            padding-left: 0; 
            margin: 0 0 8px 0; 
            max-height: 40vh; 
            overflow: auto;
          "></ul>
          <div style="
            font-family: '${this.config.ui.fonts.primary}'; 
            opacity: 0.8; 
            font-size: 12px;
          ">Z:決定 / X:閉じる</div>
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
      li.style.opacity = '0.7';
      list.appendChild(li);
    } else {
      items.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item.name || item.id;
        li.style.padding = '4px 0';
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
