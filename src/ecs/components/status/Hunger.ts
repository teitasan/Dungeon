/**
 * Hunger Component - represents entity hunger/satiation
 * Pure data structure, no logic
 */

import { Component } from '../../core/Component.js';

/**
 * Hunger state enum
 */
export type HungerState = 'overfed' | 'full' | 'satisfied' | 'hungry' | 'very-hungry' | 'starving';

/**
 * Hunger component data
 */
export interface HungerComponent extends Component {
  readonly type: 'hunger';
  readonly current: number;
  readonly maximum: number;
  readonly decreaseRate: number;
}

/**
 * Hunger component factory
 */
export class HungerComponentFactory {
  /**
   * Create a hunger component
   */
  static create(current: number, maximum: number, decreaseRate: number = 1): HungerComponent {
    return {
      id: `hunger_${Date.now()}_${Math.random()}`,
      type: 'hunger',
      current: Math.max(0, Math.min(current, maximum + 20)), // Allow slight overeating
      maximum: Math.max(1, maximum),
      decreaseRate: Math.max(0, decreaseRate)
    };
  }

  /**
   * Create a hunger component at full satiation
   */
  static createFull(maximum: number = 100): HungerComponent {
    return this.create(maximum, maximum);
  }

  /**
   * Create a hunger component at half satiation
   */
  static createHalf(maximum: number = 100): HungerComponent {
    return this.create(Math.floor(maximum / 2), maximum);
  }

  /**
   * Create a starving hunger component
   */
  static createStarving(maximum: number = 100): HungerComponent {
    return this.create(0, maximum);
  }

  /**
   * Create a player hunger component
   */
  static createPlayer(): HungerComponent {
    return this.create(100, 100, 1);
  }
}

/**
 * Hunger utilities
 */
export class HungerUtils {
  /**
   * Get hunger state based on current hunger value
   */
  static getHungerState(hunger: HungerComponent): HungerState {
    const percentage = (hunger.current / hunger.maximum) * 100;
    
    if (hunger.current > hunger.maximum) return 'overfed';
    if (percentage >= 80) return 'full';
    if (percentage >= 40) return 'satisfied';
    if (percentage >= 20) return 'hungry';
    if (percentage >= 5) return 'very-hungry';
    return 'starving';
  }

  /**
   * Get hunger percentage (0-100+)
   */
  static getHungerPercentage(hunger: HungerComponent): number {
    return Math.round((hunger.current / hunger.maximum) * 100);
  }

  /**
   * Check if entity is hungry
   */
  static isHungry(hunger: HungerComponent): boolean {
    const state = this.getHungerState(hunger);
    return ['hungry', 'very-hungry', 'starving'].includes(state);
  }

  /**
   * Check if entity is starving
   */
  static isStarving(hunger: HungerComponent): boolean {
    return this.getHungerState(hunger) === 'starving';
  }

  /**
   * Check if entity is overfed
   */
  static isOverfed(hunger: HungerComponent): boolean {
    return this.getHungerState(hunger) === 'overfed';
  }

  /**
   * Calculate hunger that can be restored
   */
  static calculateApplicableRestore(hunger: HungerComponent, restore: number): number {
    const maxPossible = (hunger.maximum + 20) - hunger.current; // Allow overeating
    return Math.min(restore, Math.max(0, maxPossible));
  }

  /**
   * Calculate hunger that can be decreased
   */
  static calculateApplicableDecrease(hunger: HungerComponent, decrease: number): number {
    return Math.min(decrease, hunger.current);
  }

  /**
   * Create new hunger component with feeding applied
   */
  static applyFeeding(hunger: HungerComponent, feedAmount: number): HungerComponent {
    const newCurrent = Math.min(hunger.maximum + 20, hunger.current + feedAmount);
    return HungerComponentFactory.create(newCurrent, hunger.maximum, hunger.decreaseRate);
  }

  /**
   * Create new hunger component with hunger decrease applied
   */
  static applyHungerDecrease(hunger: HungerComponent, amount?: number): HungerComponent {
    const decreaseAmount = amount || hunger.decreaseRate;
    const newCurrent = Math.max(0, hunger.current - decreaseAmount);
    return HungerComponentFactory.create(newCurrent, hunger.maximum, hunger.decreaseRate);
  }

  /**
   * Get hunger state description
   */
  static getStateDescription(state: HungerState): string {
    switch (state) {
      case 'overfed': return 'Overfed - movement is slower';
      case 'full': return 'Full - no effects';
      case 'satisfied': return 'Satisfied - no effects';
      case 'hungry': return 'Hungry - slight stat reduction';
      case 'very-hungry': return 'Very hungry - significant stat reduction';
      case 'starving': return 'Starving - taking damage';
      default: return 'Unknown hunger state';
    }
  }

  /**
   * Get stat modifier based on hunger state
   */
  static getStatModifier(state: HungerState): number {
    switch (state) {
      case 'overfed': return 0; // Movement speed affected, not stats
      case 'full': return 0;
      case 'satisfied': return 0;
      case 'hungry': return -1;
      case 'very-hungry': return -3;
      case 'starving': return -5;
      default: return 0;
    }
  }

  /**
   * Get movement speed modifier based on hunger state
   */
  static getMovementSpeedModifier(state: HungerState): number {
    switch (state) {
      case 'overfed': return 0.5; // 50% speed reduction
      case 'full': return 1.0;
      case 'satisfied': return 1.0;
      case 'hungry': return 1.0;
      case 'very-hungry': return 1.0;
      case 'starving': return 1.0;
      default: return 1.0;
    }
  }

  /**
   * Check if hunger state causes damage over time
   */
  static causesDamageOverTime(state: HungerState): boolean {
    return state === 'starving';
  }

  /**
   * Get damage over time amount for hunger state
   */
  static getDamageOverTimeAmount(state: HungerState): number {
    return state === 'starving' ? 5 : 0;
  }
}
