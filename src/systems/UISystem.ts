/**
 * UI System (headless stub)
 * Provides basic text rendering for dungeon and simple message/status hooks.
 * Extended for ECS integration and direct data display.
 */

import { DungeonManager } from '../dungeon/DungeonManager';
import { PlayerEntity } from '../entities/Player';
import type { GameEntity, ItemType } from '../types/entities';
import { UIManager } from '../web/ui/UIManager';
import { ItemSystem } from './ItemSystem';
import { CanvasRenderer } from '../web/CanvasRenderer';

export interface ECSDataProvider {
  getPlayerHealth(): { current: number; max: number } | null;
  getPlayerHunger(): { current: number; max: number } | null;
  getPlayerPosition(): { x: number; y: number } | null;
  getPlayerInventory(): Array<{
    id: string;
    name: string;
    identified: boolean;
    cursed: boolean;
    itemType?: ItemType;
    getDisplayName?: () => string;
  }> | null;
  getMonstersAtPosition(position: { x: number; y: number }): Array<{ id: string; health: number; maxHealth: number }> | null;
  getItemsAtPosition(position: { x: number; y: number }): Array<{ id: string; name: string; identified: boolean }> | null;
}

export class UISystem {
  private dungeonManager: DungeonManager;
  private messages: string[] = [];
  private uiManager?: UIManager;
  private itemSystem?: ItemSystem;
  private renderer?: CanvasRenderer;
  private ecsDataProvider?: ECSDataProvider;

  constructor(dungeonManager: DungeonManager) {
    this.dungeonManager = dungeonManager;
  }

  /**
   * UIManagerを設定
   */
  setUIManager(uiManager: UIManager): void {
    this.uiManager = uiManager;
  }

  /**
   * ItemSystemを設定
   */
  setItemSystem(itemSystem: ItemSystem): void {
    this.itemSystem = itemSystem;
  }

  /**
   * CanvasRendererを設定
   */
  setRenderer(renderer: CanvasRenderer): void {
    this.renderer = renderer;
  }

  /**
   * ECSデータプロバイダーを設定
   */
  setECSDataProvider(provider: ECSDataProvider): void {
    this.ecsDataProvider = provider;
  }

  /**
   * ECSデータを使用してUIを更新
   */
  updateUIWithECSData(): void {
    if (!this.uiManager || !this.ecsDataProvider) return;

    // プレイヤー情報を更新
    this.updatePlayerStatus();
    
    // インベントリ情報を更新
    this.updateInventoryDisplay();
    
    // 周辺情報を更新
    this.updateSurroundingInfo();
  }

  /**
   * プレイヤーステータスを更新
   */
  private updatePlayerStatus(): void {
    if (!this.uiManager || !this.ecsDataProvider) return;

    const health = this.ecsDataProvider.getPlayerHealth();
    const hunger = this.ecsDataProvider.getPlayerHunger();
    const position = this.ecsDataProvider.getPlayerPosition();

    if (health) {
      this.uiManager.updatePlayerHealth(health.current, health.max);
    }

    if (hunger) {
      this.uiManager.updatePlayerHunger(hunger.current, hunger.max);
    }

    if (position) {
      this.uiManager.updatePlayerPosition(position.x, position.y);
    }
  }

  /**
   * インベントリ表示を更新
   */
  private updateInventoryDisplay(): void {
    if (!this.uiManager || !this.ecsDataProvider) return;

    const inventory = this.ecsDataProvider.getPlayerInventory();
    if (inventory) {
      this.uiManager.updateInventoryGrid(inventory);
    }
  }

  /**
   * 周辺情報を更新
   */
  private updateSurroundingInfo(): void {
    if (!this.uiManager || !this.ecsDataProvider) return;

    const position = this.ecsDataProvider.getPlayerPosition();
    if (!position) return;

    // 周辺のモンスター情報
    const monsters = this.ecsDataProvider.getMonstersAtPosition(position);
    if (monsters && monsters.length > 0) {
      this.uiManager.updateMonsterInfo(monsters);
    }

    // 周辺のアイテム情報
    const items = this.ecsDataProvider.getItemsAtPosition(position);
    if (items && items.length > 0) {
      this.uiManager.updateGroundItemsInfo(items);
    }
  }

  /**
   * インベントリ操作を処理
   */
  handleInventoryAction(action: 'open' | 'close' | 'use-item' | 'move-selection', direction?: 'up' | 'down' | 'left' | 'right'): {
    success: boolean;
    message: string;
    shouldClose?: boolean;
  } {
    if (!this.uiManager) {
      return { success: false, message: 'UIマネージャーが設定されていません' };
    }

    switch (action) {
      case 'open':
        this.uiManager.setInventoryModalOpen(true);
        // ECSデータでインベントリを更新
        this.updateInventoryDisplay();
        return { success: true, message: '' };
      
      case 'close':
        this.uiManager.setInventoryModalOpen(false);
        return { success: true, message: '' };
      
      case 'move-selection':
        if (direction) {
          this.uiManager.moveInventorySelection(direction);
          return { success: true, message: '選択を移動しました' };
        }
        return { success: false, message: '移動方向が指定されていません' };
      
      case 'use-item':
        return this.handleItemUsage();
      
      default:
        return { success: false, message: '不明なアクションです' };
    }
  }

  /**
   * アイテム使用処理
   */
  private handleItemUsage(): { success: boolean; message: string; shouldClose?: boolean } {
    if (!this.uiManager || !this.itemSystem || !this.renderer) {
      return { success: false, message: '必要なシステムが設定されていません' };
    }

    const selectedItem = this.uiManager.getSelectedInventoryItem();
    if (!selectedItem) {
      return { success: false, message: 'アイテムが選択されていません' };
    }

    // プレイヤーを取得（簡易的な実装）
    const player = this.dungeonManager.getAllEntities().find(e => e.id === 'player-1') as PlayerEntity;
    if (!player) {
      return { success: false, message: 'プレイヤーが見つかりません' };
    }

    // プレイヤーのインベントリからアイテムエンティティを取得
    const itemEntity = player.inventory.find(item => item.id === selectedItem.id);
    if (!itemEntity) {
      return { success: false, message: 'アイテムが見つかりません' };
    }

    // アイテム使用実行
    const result = this.itemSystem.useItem(player, itemEntity as any);
    
    // 特殊効果の処理
    if (result.success && result.appliedEffects) {
      const currentFloor = this.dungeonManager.getCurrentDungeon()?.floor || 1;
      
      for (const effectType of result.appliedEffects) {
        switch (effectType) {
          case 'reveal-items':
            this.renderer.activateClairvoyance(currentFloor);
            break;
          case 'reveal-map':
            this.renderer.activateRemilla(currentFloor);
            break;
          case 'reveal-traps':
            this.renderer.activateTrapDetection(currentFloor);
            break;
          case 'reveal-monsters':
            this.renderer.activateMonsterVision(currentFloor);
            break;
        }
      }
    }

    return {
      success: result.success,
      message: result.message,
      shouldClose: result.success
    };
  }

  /**
   * Render current dungeon as ASCII string (for debugging/headless UI)
   */
  renderDungeonAsString(player?: PlayerEntity, revealAll: boolean = true): string {
    const dungeon = this.dungeonManager.getCurrentDungeon();
    if (!dungeon) return '';

    const lines: string[] = [];
    for (let y = 0; y < dungeon.height; y++) {
      let line = '';
      for (let x = 0; x < dungeon.width; x++) {
        const cell = dungeon.cells[y][x];
        let ch = '#';
        if (cell.type === 'floor' || cell.type === 'room' || cell.type === 'corridor') ch = '.';
        if (cell.type === 'stairs-down') ch = '>';
        if (cell.type === 'stairs-up') ch = '<';

        // Draw player if present
        if (player && player.position.x === x && player.position.y === y) {
          ch = '@';
        } else if (revealAll) {
          // Draw other entities by first letter
          const ents = this.dungeonManager.getEntitiesAt({ x, y });
          if (ents.length > 0) {
            const e = ents[0] as GameEntity & { name?: string };
            ch = (e.name?.charAt(0) || 'e').toLowerCase();
          }
        }

        line += ch;
      }
      lines.push(line);
    }
    return lines.join('\n');
  }

  /**
   * Push a UI message
   */
  pushMessage(message: string): void {
    this.messages.push(message);
    if (this.messages.length > 100) this.messages.shift();
    
    // UIManagerにアニメーション付きでメッセージを追加
    if (this.uiManager) {
      this.uiManager.addMessageWithAnimation(message);
    }
  }

  /**
   * Get recent messages
   */
  getMessages(limit: number = 10): string[] {
    return this.messages.slice(-limit);
  }

  /**
   * Simple status summary for a player
   */
  getPlayerStatusLine(player: PlayerEntity): string {
    const hp = `${player.characterStats.hp.current}/${player.characterStats.hp.max}`;
    const lvl = `Lv${player.characterStats.level}`;
    const hunger = `Hun${player.hunger}/${player.maxHunger}`;
    return `${player.name} ${lvl} HP:${hp} ${hunger}`;
  }
}
