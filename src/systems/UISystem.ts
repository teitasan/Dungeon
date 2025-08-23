/**
 * UI System (headless stub)
 * Provides basic text rendering for dungeon and simple message/status hooks.
 */

import { DungeonManager } from '../dungeon/DungeonManager';
import { PlayerEntity } from '../entities/Player';
import { GameEntity } from '../types/entities';
import { UIManager } from '../web/ui/UIManager';

export class UISystem {
  private dungeonManager: DungeonManager;
  private messages: string[] = [];
  private uiManager?: UIManager;

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
        if (cell.type === 'floor') ch = '.';
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
    const hp = `${player.stats.hp}/${player.stats.maxHp}`;
    const lvl = `Lv${player.stats.level}`;
    const hunger = `Hun${player.hunger}/${player.maxHunger}`;
    return `${player.name} ${lvl} HP:${hp} ${hunger}`;
  }
}
