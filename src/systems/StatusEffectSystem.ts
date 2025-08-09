/**
 * Status effect system for handling poison, confusion, paralysis, and bind
 */

import { GameEntity, CharacterStats, StatusEffect } from '../types/entities';

// Status effect configuration
export interface StatusEffectConfig {
  id: string;
  name: string;
  description: string;
  maxDuration: number;
  stackable: boolean;
  recoveryChance: {
    base: number;
    increase: number;
    max: number;
  };
  effects: StatusEffectAction[];
}

// Status effect action
export interface StatusEffectAction {
  type: StatusEffectActionType;
  timing: StatusEffectTiming;
  value?: number;
  chance?: number;
  description: string;
}

export type StatusEffectActionType = 
  | 'damage' 
  | 'heal' 
  | 'prevent-action' 
  | 'random-action' 
  | 'stat-modifier' 
  | 'movement-restriction';

export type StatusEffectTiming = 
  | 'turn-start' 
  | 'turn-end' 
  | 'before-action' 
  | 'after-action' 
  | 'on-attack' 
  | 'on-defend';

// Status effect result
export interface StatusEffectResult {
  effectId: string;
  entity: GameEntity;
  actions: StatusEffectActionResult[];
  recovered: boolean;
  expired: boolean;
}

export interface StatusEffectActionResult {
  type: StatusEffectActionType;
  success: boolean;
  value?: number;
  message: string;
}

export class StatusEffectSystem {
  private statusConfigs: Map<string, StatusEffectConfig>;
  private rng: () => number;

  constructor() {
    this.statusConfigs = new Map();
    this.rng = Math.random;
    this.initializeDefaultStatusEffects();
  }

  /**
   * Apply status effect to entity
   */
  applyStatusEffect(
    entity: GameEntity, 
    effectType: string, 
    intensity: number = 1,
    source?: string
  ): boolean {
    const config = this.statusConfigs.get(effectType);
    if (!config) {
      console.warn(`Unknown status effect: ${effectType}`);
      return false;
    }

    // Check if entity can have status effects
    if (!this.hasStatusEffectSupport(entity)) {
      return false;
    }

    const statusEffects = this.getEntityStatusEffects(entity);
    
    // Check if effect is already applied
    const existingEffect = statusEffects.find(effect => effect.type === effectType);
    
    if (existingEffect) {
      if (config.stackable) {
        // Increase intensity or reset duration
        existingEffect.intensity = (existingEffect.intensity || 1) + intensity;
        existingEffect.turnsElapsed = 0;
      } else {
        // Reset duration
        existingEffect.turnsElapsed = 0;
      }
    } else {
      // Add new status effect
      const newEffect: StatusEffect = {
        type: effectType as any,
        turnsElapsed: 0,
        intensity,
        source
      };
      
      statusEffects.push(newEffect);
    }

    return true;
  }

  /**
   * Remove status effect from entity
   */
  removeStatusEffect(entity: GameEntity, effectType: string): boolean {
    if (!this.hasStatusEffectSupport(entity)) {
      return false;
    }

    const statusEffects = this.getEntityStatusEffects(entity);
    const index = statusEffects.findIndex(effect => effect.type === effectType);
    
    if (index !== -1) {
      statusEffects.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Process status effects for entity at specific timing
   */
  processStatusEffects(
    entity: GameEntity, 
    timing: StatusEffectTiming
  ): StatusEffectResult[] {
    if (!this.hasStatusEffectSupport(entity)) {
      return [];
    }

    const statusEffects = this.getEntityStatusEffects(entity);
    const results: StatusEffectResult[] = [];

    // Process each status effect
    for (let i = statusEffects.length - 1; i >= 0; i--) {
      const effect = statusEffects[i];
      const config = this.statusConfigs.get(effect.type);
      
      if (!config) continue;

      const result = this.processStatusEffect(entity, effect, config, timing);
      results.push(result);

      // Remove effect if recovered or expired
      if (result.recovered || result.expired) {
        statusEffects.splice(i, 1);
      }
    }

    return results;
  }

  /**
   * Process individual status effect
   */
  private processStatusEffect(
    entity: GameEntity,
    effect: StatusEffect,
    config: StatusEffectConfig,
    timing: StatusEffectTiming
  ): StatusEffectResult {
    const actions: StatusEffectActionResult[] = [];
    let recovered = false;
    let expired = false;

    // Execute actions for this timing
    for (const action of config.effects) {
      if (action.timing === timing) {
        const actionResult = this.executeStatusAction(entity, effect, action);
        actions.push(actionResult);
      }
    }

    // Check for recovery at turn end
    if (timing === 'turn-end') {
      recovered = this.checkRecovery(effect, config);
      effect.turnsElapsed++;

      // Check for expiration
      if (effect.turnsElapsed >= config.maxDuration) {
        expired = true;
      }
    }

    return {
      effectId: effect.type,
      entity,
      actions,
      recovered,
      expired
    };
  }

  /**
   * Execute status effect action
   */
  private executeStatusAction(
    entity: GameEntity,
    effect: StatusEffect,
    action: StatusEffectAction
  ): StatusEffectActionResult {
    const intensity = effect.intensity || 1;
    let success = true;
    let value = 0;
    let message = '';

    // Check chance if specified
    if (action.chance && this.rng() > action.chance) {
      return {
        type: action.type,
        success: false,
        message: `${action.description} failed to trigger`
      };
    }

    switch (action.type) {
      case 'damage':
        value = (action.value || 1) * intensity;
        const stats = entity.stats as CharacterStats;
        const actualDamage = Math.min(value, stats.hp);
        stats.hp = Math.max(0, stats.hp - value);
        message = `${entity.id} takes ${actualDamage} damage from ${effect.type}`;
        break;

      case 'heal':
        value = (action.value || 1) * intensity;
        const healStats = entity.stats as CharacterStats;
        const actualHeal = Math.min(value, healStats.maxHp - healStats.hp);
        healStats.hp = Math.min(healStats.maxHp, healStats.hp + value);
        message = `${entity.id} recovers ${actualHeal} HP from ${effect.type}`;
        break;

      case 'prevent-action':
        // This would be handled by the action system
        message = `${entity.id} is unable to act due to ${effect.type}`;
        break;

      case 'random-action':
        // This would be handled by the action system
        message = `${entity.id} acts randomly due to ${effect.type}`;
        break;

      case 'stat-modifier':
        // Temporary stat modifications
        message = `${entity.id}'s stats are affected by ${effect.type}`;
        break;

      case 'movement-restriction':
        // This would be handled by the movement system
        message = `${entity.id}'s movement is restricted by ${effect.type}`;
        break;

      default:
        success = false;
        message = `Unknown status action: ${action.type}`;
    }

    return {
      type: action.type,
      success,
      value,
      message
    };
  }

  /**
   * Check if status effect recovers
   */
  private checkRecovery(effect: StatusEffect, config: StatusEffectConfig): boolean {
    const { base, increase, max } = config.recoveryChance;
    
    // Calculate recovery chance based on turns elapsed
    const recoveryChance = Math.min(
      max,
      base + (increase * effect.turnsElapsed)
    );

    return this.rng() < recoveryChance;
  }

  /**
   * Check if entity has status effect support
   */
  private hasStatusEffectSupport(entity: GameEntity): boolean {
    return 'statusEffects' in entity;
  }

  /**
   * Get entity's status effects array
   */
  private getEntityStatusEffects(entity: GameEntity): StatusEffect[] {
    if (!this.hasStatusEffectSupport(entity)) {
      return [];
    }
    
    return (entity as any).statusEffects as StatusEffect[];
  }

  /**
   * Get all status effects on entity
   */
  getStatusEffects(entity: GameEntity): StatusEffect[] {
    return [...this.getEntityStatusEffects(entity)];
  }

  /**
   * Check if entity has specific status effect
   */
  hasStatusEffect(entity: GameEntity, effectType: string): boolean {
    const statusEffects = this.getEntityStatusEffects(entity);
    return statusEffects.some(effect => effect.type === effectType);
  }

  /**
   * Get status effect by type
   */
  getStatusEffect(entity: GameEntity, effectType: string): StatusEffect | undefined {
    const statusEffects = this.getEntityStatusEffects(entity);
    return statusEffects.find(effect => effect.type === effectType);
  }

  /**
   * Clear all status effects from entity
   */
  clearAllStatusEffects(entity: GameEntity): void {
    if (!this.hasStatusEffectSupport(entity)) {
      return;
    }

    const statusEffects = this.getEntityStatusEffects(entity);
    statusEffects.length = 0;
  }

  /**
   * Register status effect configuration
   */
  registerStatusEffect(config: StatusEffectConfig): void {
    this.statusConfigs.set(config.id, config);
  }

  /**
   * Get status effect configuration
   */
  getStatusEffectConfig(effectType: string): StatusEffectConfig | undefined {
    return this.statusConfigs.get(effectType);
  }

  /**
   * Get all registered status effect types
   */
  getRegisteredStatusEffects(): string[] {
    return Array.from(this.statusConfigs.keys());
  }

  /**
   * Set random number generator (for testing)
   */
  setRNG(rng: () => number): void {
    this.rng = rng;
  }

  /**
   * Initialize default status effects
   */
  private initializeDefaultStatusEffects(): void {
    // Poison
    this.registerStatusEffect({
      id: 'poison',
      name: 'Poison',
      description: 'Takes damage each turn',
      maxDuration: 10,
      stackable: true,
      recoveryChance: {
        base: 0.1,
        increase: 0.05,
        max: 0.8
      },
      effects: [
        {
          type: 'damage',
          timing: 'turn-end',
          value: 2,
          description: 'Poison damage'
        }
      ]
    });

    // Confusion
    this.registerStatusEffect({
      id: 'confusion',
      name: 'Confusion',
      description: 'May act randomly',
      maxDuration: 8,
      stackable: false,
      recoveryChance: {
        base: 0.15,
        increase: 0.1,
        max: 0.9
      },
      effects: [
        {
          type: 'random-action',
          timing: 'before-action',
          chance: 0.5,
          description: 'Confused action'
        }
      ]
    });

    // Paralysis
    this.registerStatusEffect({
      id: 'paralysis',
      name: 'Paralysis',
      description: 'May be unable to act',
      maxDuration: 6,
      stackable: false,
      recoveryChance: {
        base: 0.2,
        increase: 0.15,
        max: 0.95
      },
      effects: [
        {
          type: 'prevent-action',
          timing: 'before-action',
          chance: 0.25,
          description: 'Paralyzed'
        }
      ]
    });

    // Bind
    this.registerStatusEffect({
      id: 'bind',
      name: 'Bind',
      description: 'Cannot move',
      maxDuration: 5,
      stackable: false,
      recoveryChance: {
        base: 0.25,
        increase: 0.2,
        max: 1.0
      },
      effects: [
        {
          type: 'movement-restriction',
          timing: 'before-action',
          description: 'Movement blocked'
        }
      ]
    });
  }
}