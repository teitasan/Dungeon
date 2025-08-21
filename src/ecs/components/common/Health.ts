/**
 * Health Component - represents entity health/HP
 * Pure data structure, no logic
 */

import { Component } from '../../core/Component.js';

/**
 * Health component data
 */
export interface HealthComponent extends Component {
  readonly type: 'health';
  readonly current: number;
  readonly maximum: number;
}

/**
 * Health component factory
 */
export class HealthComponentFactory {
  /**
   * Create a health component
   */
  static create(current: number, maximum: number): HealthComponent {
    return {
      id: `health_${Date.now()}_${Math.random()}`,
      type: 'health',
      current: Math.max(0, Math.min(current, maximum)),
      maximum: Math.max(1, maximum)
    };
  }

  /**
   * Create a health component at full health
   */
  static createFull(maximum: number): HealthComponent {
    return this.create(maximum, maximum);
  }

  /**
   * Create a health component at half health
   */
  static createHalf(maximum: number): HealthComponent {
    return this.create(Math.floor(maximum / 2), maximum);
  }

  /**
   * Create a health component at critical health
   */
  static createCritical(maximum: number): HealthComponent {
    return this.create(1, maximum);
  }
}

/**
 * Health utilities
 */
export class HealthUtils {
  /**
   * Check if entity is alive
   */
  static isAlive(health: HealthComponent): boolean {
    return health.current > 0;
  }

  /**
   * Check if entity is at full health
   */
  static isFullHealth(health: HealthComponent): boolean {
    return health.current >= health.maximum;
  }

  /**
   * Check if entity is at critical health
   */
  static isCriticalHealth(health: HealthComponent, threshold: number = 0.25): boolean {
    return (health.current / health.maximum) <= threshold;
  }

  /**
   * Get health percentage (0-100)
   */
  static getHealthPercentage(health: HealthComponent): number {
    return Math.round((health.current / health.maximum) * 100);
  }

  /**
   * Calculate damage that can be applied
   */
  static calculateApplicableDamage(health: HealthComponent, damage: number): number {
    return Math.min(damage, health.current);
  }

  /**
   * Calculate healing that can be applied
   */
  static calculateApplicableHealing(health: HealthComponent, healing: number): number {
    return Math.min(healing, health.maximum - health.current);
  }

  /**
   * Create new health component with damage applied
   */
  static applyDamage(health: HealthComponent, damage: number): HealthComponent {
    const newCurrent = Math.max(0, health.current - damage);
    return HealthComponentFactory.create(newCurrent, health.maximum);
  }

  /**
   * Create new health component with healing applied
   */
  static applyHealing(health: HealthComponent, healing: number): HealthComponent {
    const newCurrent = Math.min(health.maximum, health.current + healing);
    return HealthComponentFactory.create(newCurrent, health.maximum);
  }
}
