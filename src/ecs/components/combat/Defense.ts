/**
 * Defense Component - represents entity defense capabilities
 * Pure data structure, no logic
 */

import { Component } from '../../core/Component.js';

/**
 * Defense component data
 */
export interface DefenseComponent extends Component {
  readonly type: 'defense';
  readonly value: number;
  readonly evasionRate: number;
  readonly criticalResistance: number;
  readonly armorBonus: number;
}

/**
 * Defense component factory
 */
export class DefenseComponentFactory {
  /**
   * Create a defense component
   */
  static create(
    value: number,
    evasionRate: number = 0.05,
    criticalResistance: number = 0.0,
    armorBonus: number = 0
  ): DefenseComponent {
    return {
      id: `defense_${Date.now()}_${Math.random()}`,
      type: 'defense',
      value: Math.max(0, value),
      evasionRate: Math.max(0, Math.min(1, evasionRate)),
      criticalResistance: Math.max(0, Math.min(1, criticalResistance)),
      armorBonus: Math.max(0, armorBonus)
    };
  }

  /**
   * Create a weak defense component
   */
  static createWeak(): DefenseComponent {
    return this.create(2, 0.03, 0.0, 0);
  }

  /**
   * Create a normal defense component
   */
  static createNormal(): DefenseComponent {
    return this.create(5, 0.05, 0.0, 0);
  }

  /**
   * Create a strong defense component
   */
  static createStrong(): DefenseComponent {
    return this.create(8, 0.08, 0.02, 0);
  }

  /**
   * Create a player defense component
   */
  static createPlayer(level: number = 1): DefenseComponent {
    const value = 5 + level;
    const evasionRate = 0.05 + (level * 0.005);
    return this.create(value, evasionRate, 0.0, 0);
  }
}

/**
 * Defense utilities
 */
export class DefenseUtils {
  /**
   * Calculate total defense value including armor bonus
   */
  static getTotalDefenseValue(defense: DefenseComponent): number {
    return defense.value + defense.armorBonus;
  }

  /**
   * Check if attack should be evaded
   */
  static shouldEvade(defense: DefenseComponent, rng: () => number = Math.random): boolean {
    return rng() < defense.evasionRate;
  }

  /**
   * Check if critical should be resisted
   */
  static shouldResistCritical(defense: DefenseComponent, rng: () => number = Math.random): boolean {
    return rng() < defense.criticalResistance;
  }

  /**
   * Create new defense component with armor bonus
   */
  static withArmorBonus(defense: DefenseComponent, bonus: number): DefenseComponent {
    return DefenseComponentFactory.create(
      defense.value,
      defense.evasionRate,
      defense.criticalResistance,
      bonus
    );
  }

  /**
   * Create new defense component with level scaling
   */
  static withLevelScaling(defense: DefenseComponent, level: number): DefenseComponent {
    const scaledValue = defense.value + level;
    const scaledEvasion = Math.min(0.3, defense.evasionRate + (level * 0.002));
    const scaledResistance = Math.min(0.2, defense.criticalResistance + (level * 0.001));
    
    return DefenseComponentFactory.create(
      scaledValue,
      scaledEvasion,
      scaledResistance,
      defense.armorBonus
    );
  }
}
