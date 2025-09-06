/**
 * Hunger system for managing player hunger and related effects
 */

import { GameEntity, CharacterStats } from '../types/entities';
import { PlayerEntity } from '../entities/Player';

// Hunger configuration
export interface HungerConfig {
  maxValue: number;
  decreaseRate: number;
  minValue: number;
  damageAmount: number;
  recoveryAmount: number;
  maxOverfeedTime: number;
  hungerThresholds: HungerThreshold[];
}

// Hunger threshold for different states
export interface HungerThreshold {
  value: number;
  state: HungerState;
  description: string;
  effects: HungerEffect[];
}

export type HungerState = 'overfed' | 'full' | 'satisfied' | 'hungry' | 'very-hungry' | 'starving';

// Hunger effect
export interface HungerEffect {
  type: HungerEffectType;
  value?: number;
  description: string;
}

export type HungerEffectType = 
  | 'stat-modifier' 
  | 'damage-over-time' 
  | 'healing-over-time' 
  | 'movement-speed' 
  | 'action-restriction';

// Hunger result
export interface HungerResult {
  entity: GameEntity;
  previousHunger: number;
  currentHunger: number;
  previousState: HungerState;
  currentState: HungerState;
  effects: HungerEffectResult[];
  messages: string[];
}

export interface HungerEffectResult {
  type: HungerEffectType;
  value?: number;
  applied: boolean;
  message: string;
}

// Food item interface
export interface FoodItem {
  id: string;
  name: string;
  hungerValue: number;
  maxHungerIncrease?: number;
  specialEffects?: FoodEffect[];
}

export interface FoodEffect {
  type: string;
  value?: number;
  duration?: number;
  description: string;
}

export class HungerSystem {
  private config: HungerConfig;
  private messageSink?: (message: string) => void;
  private turnCounters: Map<string, number> = new Map();

  constructor(config?: Partial<HungerConfig>) {
    this.config = {
      maxValue: 100,
      decreaseRate: 1,
      minValue: 0,
      damageAmount: 5,
      recoveryAmount: 1,
      maxOverfeedTime: 10,
      hungerThresholds: [
        {
          value: 120,
          state: 'overfed',
          description: 'Overfed - movement is slower',
          effects: [
            {
              type: 'movement-speed',
              value: 0.5,
              description: 'Movement speed reduced by 50%'
            }
          ]
        },
        {
          value: 80,
          state: 'full',
          description: 'Full - no effects',
          effects: []
        },
        {
          value: 40,
          state: 'satisfied',
          description: 'Satisfied - no effects',
          effects: []
        },
        {
          value: 20,
          state: 'hungry',
          description: 'Hungry - slight stat reduction',
          effects: [
            {
              type: 'stat-modifier',
              value: -1,
              description: 'Attack and defense reduced by 1'
            }
          ]
        },
        {
          value: 5,
          state: 'very-hungry',
          description: 'Very hungry - significant stat reduction',
          effects: [
            {
              type: 'stat-modifier',
              value: -3,
              description: 'Attack and defense reduced by 3'
            }
          ]
        },
        {
          value: 0,
          state: 'starving',
          description: 'Starving - taking damage',
          effects: [
            {
              type: 'damage-over-time',
              value: 1,
              description: 'Takes 1 damage per turn'
            },
            {
              type: 'stat-modifier',
              value: -5,
              description: 'Attack and defense reduced by 5'
            }
          ]
        }
      ],
      ...config
    };
  }

  /**
   * メッセージ出力先を設定（UI ログなど）
   */
  setMessageSink(sink: (message: string) => void): void {
    this.messageSink = sink;
  }

  /**
   * Process hunger for entity (typically called each turn)
   */
  processHunger(entity: GameEntity): HungerResult | null {
    if (!this.hasHungerSupport(entity)) {
      return null;
    }

    const player = entity as PlayerEntity;
    const previousHunger = player.hunger;
    const previousState = this.getHungerState(previousHunger);

    // per-entity カウンタを用いて 10 ターンに 1 減少
    const currentCount = (this.turnCounters.get(player.id) || 0) + 1;
    this.turnCounters.set(player.id, currentCount);
    const shouldDecrease = currentCount % 10 === 0;

    if (shouldDecrease) {
      player.hunger = Math.max(
        this.config.minValue,
        player.hunger - this.config.decreaseRate
      );
    }

    const currentState = this.getHungerState(player.hunger);
    const effects = this.applyHungerEffects(player, currentState);
    const messages = this.generateHungerMessages(player, previousState, currentState);

    // メッセージを出力
    if (this.messageSink && messages.length > 0) {
      for (const m of messages) this.messageSink(m);
    }

    return {
      entity,
      previousHunger,
      currentHunger: player.hunger,
      previousState,
      currentState,
      effects,
      messages
    };
  }

  /**
   * Feed entity with food item
   */
  feedEntity(entity: GameEntity, food: FoodItem): HungerResult | null {
    if (!this.hasHungerSupport(entity)) {
      return null;
    }

    const player = entity as PlayerEntity;
    const previousHunger = player.hunger;
    const previousState = this.getHungerState(previousHunger);

    // Increase hunger
    const newHunger = player.hunger + food.hungerValue;
    player.hunger = Math.min(this.config.maxValue + 20, newHunger); // Allow slight overeating

    // Increase max hunger if specified
    if (food.maxHungerIncrease) {
      player.maxHunger = Math.min(
        this.config.maxValue + 20,
        player.maxHunger + food.maxHungerIncrease
      );
    }

    const currentState = this.getHungerState(player.hunger);
    const effects = this.applyHungerEffects(player, currentState);
    
    // Apply food special effects
    if (food.specialEffects) {
      this.applyFoodEffects(player, food.specialEffects);
    }

    const messages = [
      `${player.name} ate ${food.name}`,
      ...this.generateHungerMessages(player, previousState, currentState)
    ];

    // メッセージを出力
    if (this.messageSink && messages.length > 0) {
      for (const m of messages) this.messageSink(m);
    }

    return {
      entity,
      previousHunger,
      currentHunger: player.hunger,
      previousState,
      currentState,
      effects,
      messages
    };
  }

  /**
   * Get current hunger state
   */
  getHungerState(hungerValue: number): HungerState {
    // Find the appropriate threshold (thresholds should be sorted by value descending)
    for (const threshold of this.config.hungerThresholds) {
      if (hungerValue >= threshold.value) {
        return threshold.state;
      }
    }
    
    // Default to starving if no threshold matches
    return 'starving';
  }

  /**
   * Get hunger state description
   */
  getHungerStateDescription(state: HungerState): string {
    const threshold = this.config.hungerThresholds.find(t => t.state === state);
    return threshold?.description || 'Unknown hunger state';
  }

  /**
   * Apply hunger effects to entity
   */
  private applyHungerEffects(player: PlayerEntity, state: HungerState): HungerEffectResult[] {
    const threshold = this.config.hungerThresholds.find(t => t.state === state);
    if (!threshold) {
      return [];
    }

    const results: HungerEffectResult[] = [];

    for (const effect of threshold.effects) {
      const result = this.applyHungerEffect(player, effect);
      results.push(result);
    }

    return results;
  }

  /**
   * Apply individual hunger effect
   */
  private applyHungerEffect(player: PlayerEntity, effect: HungerEffect): HungerEffectResult {
    let applied = true;
    let message = effect.description;

    switch (effect.type) {
      case 'stat-modifier':
        // This would typically be handled by a stat modifier system
        // For now, we'll just record the effect
        message = `Stats modified: ${effect.description}`;
        break;

      case 'damage-over-time':
        const damage = effect.value || this.config.damageAmount;
        const actualDamage = Math.min(damage, player.stats.hp);
        player.stats.hp = Math.max(0, player.stats.hp - damage);
        message = `${player.name} takes ${actualDamage} hunger damage`;
        break;

      case 'healing-over-time':
        const healing = effect.value || this.config.recoveryAmount;
        const stats = player.stats as CharacterStats;
        const actualHealing = Math.min(healing, stats.maxHp - stats.hp);
        stats.hp = Math.min(stats.maxHp, stats.hp + healing);
        message = `${player.name} recovers ${actualHealing} HP from being well-fed`;
        break;

      case 'movement-speed':
        // This would be handled by the movement system
        message = `Movement speed affected: ${effect.description}`;
        break;

      case 'action-restriction':
        // This would be handled by the action system
        message = `Actions restricted: ${effect.description}`;
        break;

      default:
        applied = false;
        message = `Unknown hunger effect: ${effect.type}`;
    }

    return {
      type: effect.type,
      value: effect.value,
      applied,
      message
    };
  }

  /**
   * Apply food special effects
   */
  private applyFoodEffects(player: PlayerEntity, effects: FoodEffect[]): void {
    for (const effect of effects) {
      // This would typically integrate with other systems
      // For now, we'll just log the effects
      console.log(`Applied food effect: ${effect.description}`);
    }
  }

  /**
   * Generate hunger-related messages
   */
  private generateHungerMessages(
    player: PlayerEntity, 
    previousState: HungerState, 
    currentState: HungerState
  ): string[] {
    const messages: string[] = [];

    // State change messages
    if (previousState !== currentState) {
      switch (currentState) {
        case 'overfed':
          messages.push(`${player.name} feels overfed and sluggish`);
          break;
        case 'full':
          messages.push(`${player.name} feels full and satisfied`);
          break;
        case 'satisfied':
          messages.push(`${player.name} feels satisfied`);
          break;
        case 'hungry':
          messages.push(`${player.name} is getting hungry`);
          break;
        case 'very-hungry':
          messages.push(`${player.name} is very hungry!`);
          break;
        case 'starving':
          messages.push(`${player.name} is starving!`);
          break;
      }
    }

    return messages;
  }

  /**
   * Check if entity supports hunger system
   */
  private hasHungerSupport(entity: GameEntity): boolean {
    return 'hunger' in entity && 'maxHunger' in entity;
  }

  /**
   * Get hunger percentage (0-100)
   */
  getHungerPercentage(entity: GameEntity): number {
    if (!this.hasHungerSupport(entity)) {
      return 100;
    }

    const player = entity as PlayerEntity;
    return Math.round((player.hunger / player.maxHunger) * 100);
  }

  /**
   * Check if entity is hungry
   */
  isHungry(entity: GameEntity): boolean {
    if (!this.hasHungerSupport(entity)) {
      return false;
    }

    const state = this.getHungerState((entity as PlayerEntity).hunger);
    return ['hungry', 'very-hungry', 'starving'].includes(state);
  }

  /**
   * Check if entity is starving
   */
  isStarving(entity: GameEntity): boolean {
    if (!this.hasHungerSupport(entity)) {
      return false;
    }

    const state = this.getHungerState((entity as PlayerEntity).hunger);
    return state === 'starving';
  }

  /**
   * Check if entity is overfed
   */
  isOverfed(entity: GameEntity): boolean {
    if (!this.hasHungerSupport(entity)) {
      return false;
    }

    const state = this.getHungerState((entity as PlayerEntity).hunger);
    return state === 'overfed';
  }

  /**
   * Create food item
   */
  createFoodItem(
    id: string,
    name: string,
    hungerValue: number,
    maxHungerIncrease?: number,
    specialEffects?: FoodEffect[]
  ): FoodItem {
    return {
      id,
      name,
      hungerValue,
      maxHungerIncrease,
      specialEffects
    };
  }

  /**
   * Get hunger configuration
   */
  getConfig(): HungerConfig {
    return { ...this.config };
  }

  /**
   * Update hunger configuration
   */
  updateConfig(newConfig: Partial<HungerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset entity hunger to full
   */
  resetHunger(entity: GameEntity): boolean {
    if (!this.hasHungerSupport(entity)) {
      return false;
    }

    const player = entity as PlayerEntity;
    player.hunger = player.maxHunger;
    return true;
  }

  /**
   * Set entity hunger to specific value
   */
  setHunger(entity: GameEntity, value: number): boolean {
    if (!this.hasHungerSupport(entity)) {
      return false;
    }

    const player = entity as PlayerEntity;
    player.hunger = Math.max(
      this.config.minValue,
      Math.min(this.config.maxValue + 20, value)
    );
    return true;
  }
}
