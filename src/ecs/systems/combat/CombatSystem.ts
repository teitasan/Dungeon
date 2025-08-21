/**
 * ECS Combat System - handles combat between entities
 * Pure ECS implementation: processes entities with combat components
 */

import { System, SystemContext } from '../../core/System.js';
import { ComponentManager } from '../../core/ComponentManager.js';
import { EntityId } from '../../core/Entity.js';
import { HealthComponent, HealthComponentFactory, HealthUtils } from '../../components/common/Health.js';
import { AttackComponent, AttackUtils } from '../../../ecs/components/combat/Attack.js';
import { DefenseComponent, DefenseUtils } from '../../../ecs/components/combat/Defense.js';
import { PositionComponent } from '../../components/common/Position.js';

/**
 * Combat configuration from game config
 */
export interface CombatConfig {
  attackMultiplier: number;
  defenseBase: number;
  randomRangeMin: number;
  randomRangeMax: number;
  minimumDamage: number;
  baseCriticalChance: number;
  criticalMultiplier: number;
  baseEvasionRate: number;
  evasionEnabled: boolean;
}

/**
 * Combat result data
 */
export interface CombatResult {
  attacker: EntityId;
  defender: EntityId;
  damage: number;
  actualDamage: number;
  critical: boolean;
  evaded: boolean;
  success: boolean;
  message: string;
}

/**
 * Combat action data for events
 */
export interface CombatAction {
  type: 'attack' | 'defend' | 'flee';
  attacker: EntityId;
  target?: EntityId;
  timestamp: number;
}

/**
 * ECS Combat System
 */
export class ECSCombatSystem extends System {
  private config: CombatConfig;
  private rng: () => number;
  private combatLog: Array<{ action: CombatAction; result: CombatResult }> = [];

  constructor(componentManager: ComponentManager, config: CombatConfig) {
    // This system processes entities that can attack (have attack + position components)
    super(componentManager, ['attack', 'position']);
    
    this.config = config;
    this.rng = Math.random; // Can be overridden for testing
  }

  /**
   * Process combat for entities that can attack
   */
  protected process(context: SystemContext, entities: EntityId[]): void {
    // Combat is event-driven, not frame-driven
    // This method is called when combat events occur
    // The actual combat logic is in executeAttack method
  }

  /**
   * Execute an attack between two entities
   */
  executeAttack(attackerId: EntityId, defenderId: EntityId): CombatResult | null {
    // Validate entities exist and have required components
    const attackerAttack = this.getComponent<AttackComponent>(attackerId, 'attack');
    const attackerPos = this.getComponent<PositionComponent>(attackerId, 'position');
    const defenderDefense = this.getComponent<DefenseComponent>(defenderId, 'defense');
    const defenderHealth = this.getComponent<HealthComponent>(defenderId, 'health');
    const defenderPos = this.getComponent<PositionComponent>(defenderId, 'position');

    if (!attackerAttack || !attackerPos || !defenderDefense || !defenderHealth || !defenderPos) {
      return null; // Missing required components
    }

    // Check if entities are in range (adjacent for now)
    if (!this.isInAttackRange(attackerPos, defenderPos)) {
      return {
        attacker: attackerId,
        defender: defenderId,
        damage: 0,
        actualDamage: 0,
        critical: false,
        evaded: false,
        success: false,
        message: 'Target is out of range'
      };
    }

    // Check if attack is evaded
    if (this.config.evasionEnabled && DefenseUtils.shouldEvade(defenderDefense, this.rng)) {
      const result: CombatResult = {
        attacker: attackerId,
        defender: defenderId,
        damage: 0,
        actualDamage: 0,
        critical: false,
        evaded: true,
        success: true,
        message: `${defenderId} evaded ${attackerId}'s attack!`
      };

      this.logCombatAction({
        type: 'attack',
        attacker: attackerId,
        target: defenderId,
        timestamp: Date.now()
      }, result);

      return result;
    }

    // Check for critical hit
    const isCritical = AttackUtils.shouldCritical(attackerAttack, this.rng) && 
                      !DefenseUtils.shouldResistCritical(defenderDefense, this.rng);

    // Calculate damage using mystery dungeon formula
    const damage = this.calculateDamage(attackerAttack, defenderDefense, isCritical);
    
    // Apply damage
    const actualDamage = HealthUtils.calculateApplicableDamage(defenderHealth, damage);
    const newHealth = HealthUtils.applyDamage(defenderHealth, actualDamage);

    // Update defender's health component
    this.componentManager.removeComponent(defenderId, 'health');
    this.componentManager.addComponent(defenderId, newHealth);

    // Create result
    const result: CombatResult = {
      attacker: attackerId,
      defender: defenderId,
      damage,
      actualDamage,
      critical: isCritical,
      evaded: false,
      success: true,
      message: this.generateCombatMessage(attackerId, defenderId, actualDamage, isCritical)
    };

    // Log combat action
    this.logCombatAction({
      type: 'attack',
      attacker: attackerId,
      target: defenderId,
      timestamp: Date.now()
    }, result);

    return result;
  }

  /**
   * Calculate damage using mystery dungeon formula
   * Formula: {攻撃力×1.3×(35/36)^防御力}×(7/8~9/8)
   */
  private calculateDamage(
    attack: AttackComponent,
    defense: DefenseComponent,
    isCritical: boolean
  ): number {
    const baseAttack = AttackUtils.getTotalAttackPower(attack);
    const defenseValue = isCritical ? 0 : DefenseUtils.getTotalDefenseValue(defense);

    // Apply the mystery dungeon damage formula
    const attackMultiplied = baseAttack * this.config.attackMultiplier;
    const defenseReduction = Math.pow(this.config.defenseBase, defenseValue);
    const baseDamage = attackMultiplied * defenseReduction;

    // Apply random variation (7/8 to 9/8)
    const randomMultiplier = this.rng() * (this.config.randomRangeMax - this.config.randomRangeMin) + this.config.randomRangeMin;
    const randomizedDamage = baseDamage * randomMultiplier;

    // Apply critical multiplier if critical
    const criticalDamage = isCritical ? randomizedDamage * this.config.criticalMultiplier : randomizedDamage;

    // Ensure minimum damage
    return Math.max(Math.floor(criticalDamage), this.config.minimumDamage);
  }

  /**
   * Check if attacker is in range of defender
   */
  private isInAttackRange(attackerPos: PositionComponent, defenderPos: PositionComponent): boolean {
    // For now, adjacent tiles only (Manhattan distance = 1)
    const dx = Math.abs(attackerPos.x - defenderPos.x);
    const dy = Math.abs(attackerPos.y - defenderPos.y);
    return dx <= 1 && dy <= 1 && (dx + dy) > 0; // Adjacent but not same position
  }

  /**
   * Generate combat message
   */
  private generateCombatMessage(
    attackerId: EntityId,
    defenderId: EntityId,
    damage: number,
    isCritical: boolean
  ): string {
    let message = `${attackerId} attacks ${defenderId}`;
    
    if (isCritical) {
      message += ' with a critical hit';
    }
    
    message += ` for ${damage} damage!`;
    
    // Check if defender is defeated
    const defenderHealth = this.getComponent<HealthComponent>(defenderId, 'health');
    if (defenderHealth && !HealthUtils.isAlive(defenderHealth)) {
      message += ` ${defenderId} is defeated!`;
    }
    
    return message;
  }

  /**
   * Log combat action
   */
  private logCombatAction(action: CombatAction, result: CombatResult): void {
    this.combatLog.push({ action, result });
    
    // Keep log size manageable
    if (this.combatLog.length > 100) {
      this.combatLog.shift();
    }
  }

  /**
   * Get combat log
   */
  getCombatLog(): Array<{ action: CombatAction; result: CombatResult }> {
    return [...this.combatLog];
  }

  /**
   * Clear combat log
   */
  clearCombatLog(): void {
    this.combatLog.length = 0;
  }

  /**
   * Check if entity can attack another entity
   */
  canAttack(attackerId: EntityId, defenderId: EntityId): boolean {
    // Check if attacker has attack capability
    if (!this.hasComponent(attackerId, 'attack')) {
      return false;
    }

    // Check if defender has health
    if (!this.hasComponent(defenderId, 'health')) {
      return false;
    }

    // Check if defender is alive
    const defenderHealth = this.getComponent<HealthComponent>(defenderId, 'health');
    if (!defenderHealth || !HealthUtils.isAlive(defenderHealth)) {
      return false;
    }

    // Check if attacker is alive
    const attackerHealth = this.getComponent<HealthComponent>(attackerId, 'health');
    if (attackerHealth && !HealthUtils.isAlive(attackerHealth)) {
      return false;
    }

    // Check range
    const attackerPos = this.getComponent<PositionComponent>(attackerId, 'position');
    const defenderPos = this.getComponent<PositionComponent>(defenderId, 'position');
    
    if (!attackerPos || !defenderPos) {
      return false;
    }

    return this.isInAttackRange(attackerPos, defenderPos);
  }

  /**
   * Get combat preview for UI
   */
  getCombatPreview(attackerId: EntityId, defenderId: EntityId): {
    minDamage: number;
    maxDamage: number;
    averageDamage: number;
    criticalDamage: number;
    hitChance: number;
    criticalChance: number;
  } | null {
    const attackerAttack = this.getComponent<AttackComponent>(attackerId, 'attack');
    const defenderDefense = this.getComponent<DefenseComponent>(defenderId, 'defense');

    if (!attackerAttack || !defenderDefense) {
      return null;
    }

    // Calculate damage range without random factor
    const baseAttack = AttackUtils.getTotalAttackPower(attackerAttack);
    const defenseValue = DefenseUtils.getTotalDefenseValue(defenderDefense);
    
    const attackMultiplied = baseAttack * this.config.attackMultiplier;
    const defenseReduction = Math.pow(this.config.defenseBase, defenseValue);
    const baseDamage = attackMultiplied * defenseReduction;

    // Calculate damage range with random factor
    const minDamage = Math.max(Math.floor(baseDamage * this.config.randomRangeMin), this.config.minimumDamage);
    const maxDamage = Math.max(Math.floor(baseDamage * this.config.randomRangeMax), this.config.minimumDamage);
    const averageDamage = Math.floor((minDamage + maxDamage) / 2);

    // Critical damage ignores defense
    const criticalBaseDamage = baseAttack * this.config.attackMultiplier;
    const criticalDamage = Math.max(Math.floor(criticalBaseDamage * this.config.criticalMultiplier), this.config.minimumDamage);

    // Calculate hit chance (1 - evasion chance)
    const hitChance = this.config.evasionEnabled ? 
      1 - defenderDefense.evasionRate : 1.0;

    // Calculate critical chance
    const criticalChance = attackerAttack.criticalChance * (1 - defenderDefense.criticalResistance);

    return {
      minDamage,
      maxDamage,
      averageDamage,
      criticalDamage,
      hitChance,
      criticalChance
    };
  }

  /**
   * Set random number generator (for testing)
   */
  setRNG(rng: () => number): void {
    this.rng = rng;
  }

  /**
   * Get current combat configuration
   */
  getConfig(): CombatConfig {
    return { ...this.config };
  }

  /**
   * Update combat configuration
   */
  updateConfig(newConfig: Partial<CombatConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  protected onInitialize(): void {
    console.log('ECS Combat System initialized');
  }
}
