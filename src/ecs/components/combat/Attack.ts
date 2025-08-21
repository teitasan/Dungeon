/**
 * Attack Component - represents entity attack capabilities
 * Pure data structure, no logic
 */

import { Component } from '../../core/Component.js';

/**
 * Attack component data
 */
export interface AttackComponent extends Component {
  readonly type: 'attack';
  readonly power: number;
  readonly criticalChance: number;
  readonly accuracy: number;
  readonly weaponBonus: number;
}

/**
 * Attack component factory
 */
export class AttackComponentFactory {
  /**
   * Create an attack component
   */
  static create(
    power: number,
    criticalChance: number = 0.05,
    accuracy: number = 1.0,
    weaponBonus: number = 0
  ): AttackComponent {
    return {
      id: `attack_${Date.now()}_${Math.random()}`,
      type: 'attack',
      power: Math.max(0, power),
      criticalChance: Math.max(0, Math.min(1, criticalChance)),
      accuracy: Math.max(0, Math.min(1, accuracy)),
      weaponBonus: Math.max(0, weaponBonus)
    };
  }

  /**
   * Create a weak attack component
   */
  static createWeak(): AttackComponent {
    return this.create(5, 0.02, 0.9, 0);
  }

  /**
   * Create a normal attack component
   */
  static createNormal(): AttackComponent {
    return this.create(10, 0.05, 1.0, 0);
  }

  /**
   * Create a strong attack component
   */
  static createStrong(): AttackComponent {
    return this.create(15, 0.08, 1.0, 0);
  }

  /**
   * Create a player attack component
   */
  static createPlayer(level: number = 1): AttackComponent {
    const power = 8 + (level * 2);
    const criticalChance = 0.05 + (level * 0.01);
    return this.create(power, criticalChance, 1.0, 0);
  }
}

/**
 * Attack utilities
 */
export class AttackUtils {
  /**
   * Calculate total attack power including weapon bonus
   */
  static getTotalAttackPower(attack: AttackComponent): number {
    return attack.power + attack.weaponBonus;
  }

  /**
   * Check if attack should be critical
   */
  static shouldCritical(attack: AttackComponent, rng: () => number = Math.random): boolean {
    return rng() < attack.criticalChance;
  }

  /**
   * Check if attack should hit
   */
  static shouldHit(attack: AttackComponent, rng: () => number = Math.random): boolean {
    return rng() < attack.accuracy;
  }

  /**
   * Create new attack component with weapon bonus
   */
  static withWeaponBonus(attack: AttackComponent, bonus: number): AttackComponent {
    return AttackComponentFactory.create(
      attack.power,
      attack.criticalChance,
      attack.accuracy,
      bonus
    );
  }

  /**
   * Create new attack component with level scaling
   */
  static withLevelScaling(attack: AttackComponent, level: number): AttackComponent {
    const scaledPower = attack.power + (level * 2);
    const scaledCritical = Math.min(1.0, attack.criticalChance + (level * 0.005));
    
    return AttackComponentFactory.create(
      scaledPower,
      scaledCritical,
      attack.accuracy,
      attack.weaponBonus
    );
  }
}
