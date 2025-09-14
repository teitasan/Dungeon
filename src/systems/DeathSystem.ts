/**
 * Death and Game Over System
 * Applies penalties and resets state on player death.
 */

import { PlayerEntity } from '../entities/Player';

export interface DeathPenaltyConfig {
  itemLoss: 'all' | 'partial' | 'none';
  levelReset: boolean;
  statReset: boolean;
}

export interface GameOverConfig {
  allowRevive: boolean;
  allowContinue: boolean;
  resetToTown: boolean;
  showDeathMessage: boolean;
}

export interface DeathSystemConfig {
  penalties: DeathPenaltyConfig;
  gameOver: GameOverConfig;
}

export class DeathSystem {
  private config: DeathSystemConfig;

  constructor(config?: Partial<DeathSystemConfig>) {
    this.config = Object.assign(
      {
        penalties: { itemLoss: 'all', levelReset: true, statReset: true },
        gameOver: { allowRevive: false, allowContinue: false, resetToTown: true, showDeathMessage: true }
      },
      config || {}
    );
  }

  /**
   * Handle player death according to configured penalties.
   */
  onPlayerDeath(player: PlayerEntity): { message: string } {
    // Item loss
    if (this.config.penalties.itemLoss === 'all') {
      player.inventory.length = 0;
      player.equipment.weapon = undefined;
      player.equipment.armor = undefined;
      player.equipment.accessory = undefined;
    }

    // Level reset
    if (this.config.penalties.levelReset) {
      player.characterStats.level = 1;
      player.characterStats.experience.total = 0;
      player.characterStats.experience.current = 0;
      player.characterStats.experience.required = 100;
    }

    // Stat reset (basic reset to reasonable defaults)
    if (this.config.penalties.statReset) {
      player.characterStats.hp.max = 30;
      player.characterStats.hp.current = player.characterStats.hp.max;
      // 基本ステータスはCharacterInfoから再計算
      const { CharacterCalculator } = require('../core/character-calculator');
      player.characterStats = CharacterCalculator.calculateAllStats(player.characterInfo, 1);
    }

    const message = this.config.gameOver.showDeathMessage ? `${player.characterInfo.name} has fallen...` : '';
    return { message };
  }
}
