/**
 * ECS Hunger System - manages hunger for entities
 * Pure ECS implementation: processes entities with hunger components
 */

import { System, SystemContext } from '../../core/System.js';
import { ComponentManager } from '../../core/ComponentManager.js';
import { EntityId } from '../../core/Entity.js';
import { HungerComponent, HungerComponentFactory, HungerUtils, HungerState } from '../../components/status/Hunger.js';
import { HealthComponent, HealthComponentFactory, HealthUtils } from '../../components/common/Health.js';
import { AttackComponent, AttackComponentFactory } from '../../components/combat/Attack.js';
import { DefenseComponent, DefenseComponentFactory } from '../../components/combat/Defense.js';

/**
 * Hunger configuration from game config
 */
export interface HungerConfig {
  maxValue: number;
  decreaseRate: number;
  minValue: number;
  damageAmount: number;
  recoveryAmount: number;
  maxOverfeedTime: number;
}

/**
 * Hunger processing result
 */
export interface HungerResult {
  entityId: EntityId;
  previousHunger: number;
  currentHunger: number;
  previousState: HungerState;
  currentState: HungerState;
  stateChanged: boolean;
  damageApplied: number;
  healingApplied: number;
  message: string;
}

/**
 * Food item data for feeding
 */
export interface FoodData {
  hungerValue: number;
  maxHungerIncrease?: number;
  specialEffects?: string[];
}

/**
 * ECS Hunger System
 */
export class ECSHungerSystem extends System {
  private config: HungerConfig;
  private hungerResults: HungerResult[] = [];

  constructor(componentManager: ComponentManager, config: HungerConfig) {
    // This system processes entities that have hunger
    super(componentManager, ['hunger']);
    this.config = config;
  }

  /**
   * Process hunger for all entities with hunger component
   */
  protected process(context: SystemContext, entities: EntityId[]): void {
    this.hungerResults = [];

    for (const entityId of entities) {
      const result = this.processEntityHunger(entityId);
      if (result) {
        this.hungerResults.push(result);
      }
    }
  }

  /**
   * Process hunger for a single entity
   */
  private processEntityHunger(entityId: EntityId): HungerResult | null {
    const hunger = this.getComponent<HungerComponent>(entityId, 'hunger');
    if (!hunger) {
      return null;
    }

    const previousHunger = hunger.current;
    const previousState = HungerUtils.getHungerState(hunger);

    // Decrease hunger
    const newHunger = HungerUtils.applyHungerDecrease(hunger);
    const currentState = HungerUtils.getHungerState(newHunger);
    const stateChanged = previousState !== currentState;

    // Update hunger component
    this.componentManager.removeComponent(entityId, 'hunger');
    this.componentManager.addComponent(entityId, newHunger);

    // Apply hunger effects
    let damageApplied = 0;
    let healingApplied = 0;

    // Apply damage over time for starving entities
    if (HungerUtils.causesDamageOverTime(currentState)) {
      const health = this.getComponent<HealthComponent>(entityId, 'health');
      if (health) {
        const damageAmount = HungerUtils.getDamageOverTimeAmount(currentState);
        const actualDamage = HealthUtils.calculateApplicableDamage(health, damageAmount);
        const newHealth = HealthUtils.applyDamage(health, actualDamage);
        
        this.componentManager.removeComponent(entityId, 'health');
        this.componentManager.addComponent(entityId, newHealth);
        
        damageApplied = actualDamage;
      }
    }

    // Apply stat modifiers by updating attack/defense components
    this.applyHungerStatModifiers(entityId, currentState, previousState);

    // Generate message
    const message = this.generateHungerMessage(entityId, previousState, currentState, damageApplied, healingApplied);

    return {
      entityId,
      previousHunger,
      currentHunger: newHunger.current,
      previousState,
      currentState,
      stateChanged,
      damageApplied,
      healingApplied,
      message
    };
  }

  /**
   * Feed an entity with food
   */
  feedEntity(entityId: EntityId, food: FoodData): HungerResult | null {
    const hunger = this.getComponent<HungerComponent>(entityId, 'hunger');
    if (!hunger) {
      return null;
    }

    const previousHunger = hunger.current;
    const previousState = HungerUtils.getHungerState(hunger);

    // Apply feeding
    const newHunger = HungerUtils.applyFeeding(hunger, food.hungerValue);
    const currentState = HungerUtils.getHungerState(newHunger);
    const stateChanged = previousState !== currentState;

    // Update hunger component
    this.componentManager.removeComponent(entityId, 'hunger');
    this.componentManager.addComponent(entityId, newHunger);

    // Apply stat modifiers
    this.applyHungerStatModifiers(entityId, currentState, previousState);

    // Generate message
    const message = `${entityId} ate food and feels ${currentState}`;

    return {
      entityId,
      previousHunger,
      currentHunger: newHunger.current,
      previousState,
      currentState,
      stateChanged,
      damageApplied: 0,
      healingApplied: 0,
      message
    };
  }

  /**
   * Apply stat modifiers based on hunger state
   */
  private applyHungerStatModifiers(entityId: EntityId, currentState: HungerState, previousState: HungerState): void {
    // Only update if state changed
    if (currentState === previousState) {
      return;
    }

    const currentModifier = HungerUtils.getStatModifier(currentState);
    const previousModifier = HungerUtils.getStatModifier(previousState);
    const modifierDiff = currentModifier - previousModifier;

    if (modifierDiff !== 0) {
      // Update attack component
      const attack = this.getComponent<AttackComponent>(entityId, 'attack');
      if (attack) {
        const newAttack = AttackComponentFactory.create(
          Math.max(1, attack.power + modifierDiff),
          attack.criticalChance,
          attack.accuracy,
          attack.weaponBonus
        );
        this.componentManager.removeComponent(entityId, 'attack');
        this.componentManager.addComponent(entityId, newAttack);
      }

      // Update defense component
      const defense = this.getComponent<DefenseComponent>(entityId, 'defense');
      if (defense) {
        const newDefense = DefenseComponentFactory.create(
          Math.max(0, defense.value + modifierDiff),
          defense.evasionRate,
          defense.criticalResistance,
          defense.armorBonus
        );
        this.componentManager.removeComponent(entityId, 'defense');
        this.componentManager.addComponent(entityId, newDefense);
      }
    }
  }

  /**
   * Generate hunger message
   */
  private generateHungerMessage(
    entityId: EntityId,
    previousState: HungerState,
    currentState: HungerState,
    damageApplied: number,
    healingApplied: number
  ): string {
    const messages: string[] = [];

    // State change message
    if (previousState !== currentState) {
      switch (currentState) {
        case 'overfed':
          messages.push(`${entityId} feels overfed and sluggish`);
          break;
        case 'full':
          messages.push(`${entityId} feels full and satisfied`);
          break;
        case 'satisfied':
          messages.push(`${entityId} feels satisfied`);
          break;
        case 'hungry':
          messages.push(`${entityId} is getting hungry`);
          break;
        case 'very-hungry':
          messages.push(`${entityId} is very hungry!`);
          break;
        case 'starving':
          messages.push(`${entityId} is starving!`);
          break;
      }
    }

    // Damage message
    if (damageApplied > 0) {
      messages.push(`${entityId} takes ${damageApplied} hunger damage`);
    }

    // Healing message
    if (healingApplied > 0) {
      messages.push(`${entityId} recovers ${healingApplied} HP from being well-fed`);
    }

    return messages.join('; ') || `${entityId} hunger processed`;
  }

  /**
   * Check if entity has hunger support
   */
  hasHungerSupport(entityId: EntityId): boolean {
    return this.hasComponent(entityId, 'hunger');
  }

  /**
   * Get hunger percentage for entity
   */
  getHungerPercentage(entityId: EntityId): number {
    const hunger = this.getComponent<HungerComponent>(entityId, 'hunger');
    return hunger ? HungerUtils.getHungerPercentage(hunger) : 100;
  }

  /**
   * Get hunger state for entity
   */
  getHungerState(entityId: EntityId): HungerState | null {
    const hunger = this.getComponent<HungerComponent>(entityId, 'hunger');
    return hunger ? HungerUtils.getHungerState(hunger) : null;
  }

  /**
   * Reset entity hunger to full
   */
  resetHunger(entityId: EntityId): boolean {
    const hunger = this.getComponent<HungerComponent>(entityId, 'hunger');
    if (!hunger) {
      return false;
    }

    const fullHunger = HungerComponentFactory.create(hunger.maximum, hunger.maximum, hunger.decreaseRate);
    this.componentManager.removeComponent(entityId, 'hunger');
    this.componentManager.addComponent(entityId, fullHunger);
    
    return true;
  }

  /**
   * Set entity hunger to specific value
   */
  setHunger(entityId: EntityId, value: number): boolean {
    const hunger = this.getComponent<HungerComponent>(entityId, 'hunger');
    if (!hunger) {
      return false;
    }

    const newHunger = HungerComponentFactory.create(value, hunger.maximum, hunger.decreaseRate);
    this.componentManager.removeComponent(entityId, 'hunger');
    this.componentManager.addComponent(entityId, newHunger);
    
    return true;
  }

  /**
   * Get recent hunger processing results
   */
  getHungerResults(): HungerResult[] {
    return [...this.hungerResults];
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

  protected onInitialize(): void {
    console.log('ECS Hunger System initialized');
  }
}
