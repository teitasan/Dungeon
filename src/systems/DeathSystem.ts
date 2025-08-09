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
      player.stats.level = 1;
      player.stats.experience = 0;
    }

    // Stat reset (basic reset to reasonable defaults)
    if (this.config.penalties.statReset) {
      player.stats.maxHp = 30;
      player.stats.hp = player.stats.maxHp;
      player.stats.attack = 8;
      player.stats.defense = 5;
    }

    const message = this.config.gameOver.showDeathMessage ? `${player.name} has fallen...` : '';
    return { message };
  }
}
