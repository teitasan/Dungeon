/**
 * Combat system implementation
 * Handles damage calculation, critical hits, and combat resolution
 */

import { GameEntity, CharacterStats } from '../types/entities';
import { 
  CombatResult, 
  CombatEffect, 
  AttackParams, 
  DamageCalculation, 
  CombatConfig,
  CombatAction,
  CombatLogEntry,
  CombatState
} from '../types/combat';
import { AttributeSystem } from './AttributeSystem';

export class CombatSystem {
  private config: CombatConfig;
  private combatState: CombatState;
  private rng: () => number;
  private attributeSystem: AttributeSystem;

  constructor(config?: Partial<CombatConfig>) {
    this.config = {
      attackMultiplier: 1.3,
      defenseBase: 35/36, // ≈ 0.9722
      randomRangeMin: 7/8, // 0.875
      randomRangeMax: 9/8, // 1.125
      minimumDamage: 1,
      baseCriticalChance: 0.05,
      criticalMultiplier: 2.0,
      baseEvasionRate: 0.05,
      evasionEnabled: true,
      statusEffectChances: {},
      ...config
    };

    this.combatState = {
      inCombat: false,
      participants: [],
      combatLog: [],
      turnCount: 0
    };

    // Use a deterministic RNG by default for stable tests; can be overridden via setRNG
    this.rng = () => 0.5;
    this.attributeSystem = new AttributeSystem();
  }

  /**
   * Execute an attack between two entities
   */
  executeAttack(params: AttackParams): CombatResult {
    const { attacker, defender, attackType, weaponBonus = 0, attributeModifier = 1.0, criticalOverride, unavoidable } = params;

    // Check if attack hits (evasion check)
    if (!unavoidable && this.config.evasionEnabled && this.checkEvasion(attacker, defender)) {
      return {
        success: true,
        damage: 0,
        actualDamage: 0,
        critical: false,
        evaded: true,
        blocked: false,
        attacker,
        defender,
        effects: [],
        message: `${defender.id} evaded ${attacker.id}'s attack!`
      };
    }

    // Check for critical hit
    const isCritical = criticalOverride === true ? true : 
                      (criticalOverride === false ? false : this.checkCriticalHit(attacker, defender));

    // Calculate attribute modifier if not provided
    const finalAttributeModifier = attributeModifier !== undefined ? 
      attributeModifier : this.attributeSystem.calculateEntityAttributeModifier(attacker, defender);

    // Calculate damage
    const damageCalc = this.calculateDamage(attacker, defender, weaponBonus, finalAttributeModifier, isCritical);
    
    // Apply damage to defender
    const actualDamage = this.applyDamage(defender, damageCalc.finalDamage);

    // Generate combat effects
    const effects = this.generateCombatEffects(attacker, defender, actualDamage, isCritical);

    // Create result
    const result: CombatResult = {
      success: true,
      damage: damageCalc.finalDamage,
      actualDamage,
      critical: isCritical,
      evaded: false,
      blocked: false,
      attacker,
      defender,
      effects,
      message: this.generateCombatMessage(attacker, defender, actualDamage, isCritical)
    };

    // Log the combat action
    this.logCombatAction({
      type: 'attack',
      attacker,
      target: defender
    }, result);

    return result;
  }

  /**
   * Calculate damage using the mystery dungeon formula
   * Formula: {攻撃力×1.3×(35/36)^防御力}×(7/8~9/8)
   */
  private calculateDamage(
    attacker: GameEntity, 
    defender: GameEntity, 
    weaponBonus: number, 
    attributeModifier: number, 
    isCritical: boolean
  ): DamageCalculation {
    const attackerStats = attacker.stats as CharacterStats;
    const defenderStats = defender.stats as CharacterStats;

    const baseAttack = attackerStats.attack + weaponBonus;
    const defense = isCritical ? 0 : defenderStats.defense; // Critical hits ignore defense

    // Apply the mystery dungeon damage formula
    const attackMultiplied = baseAttack * this.config.attackMultiplier;
    const defenseReduction = Math.pow(this.config.defenseBase, defense);
    const baseDamage = attackMultiplied * defenseReduction;

    // Apply random variation (7/8 to 9/8)
    const randomMultiplier = this.rng() * (this.config.randomRangeMax - this.config.randomRangeMin) + this.config.randomRangeMin;
    const randomizedDamage = baseDamage * randomMultiplier;

    // Apply attribute modifier
    const attributeDamage = randomizedDamage * attributeModifier;

    // Apply critical multiplier if critical
    const criticalDamage = isCritical ? attributeDamage * this.config.criticalMultiplier : attributeDamage;

    // Ensure minimum damage
    const finalDamage = Math.max(Math.floor(criticalDamage), this.config.minimumDamage);

    return {
      baseAttack,
      defense,
      attackMultiplier: this.config.attackMultiplier,
      defenseReduction,
      randomMultiplier,
      attributeMultiplier: attributeModifier,
      weaponBonus,
      finalDamage,
      minimumDamage: this.config.minimumDamage
    };
  }

  /**
   * Check if attack results in critical hit
   */
  private checkCriticalHit(attacker: GameEntity, defender: GameEntity): boolean {
    // Base critical chance
    let criticalChance = this.config.baseCriticalChance;

    // Add attacker's critical bonus if available
    if ('criticalChance' in attacker.stats) {
      criticalChance += (attacker.stats as any).criticalChance || 0;
    }

    // Subtract defender's critical resistance if available
    if ('criticalResistance' in defender.stats) {
      criticalChance -= (defender.stats as any).criticalResistance || 0;
    }

    // Ensure chance is within valid range
    criticalChance = Math.max(0, Math.min(1, criticalChance));

    return this.rng() < criticalChance;
  }

  /**
   * Check if attack is evaded
   */
  private checkEvasion(attacker: GameEntity, defender: GameEntity): boolean {
    // Base evasion rate
    let evasionChance = this.config.baseEvasionRate;

    // Add defender's evasion bonus
    if (defender.stats.evasionRate !== undefined) {
      evasionChance += defender.stats.evasionRate;
    }

    // Subtract attacker's accuracy bonus if available
    if ('accuracy' in attacker.stats) {
      evasionChance -= (attacker.stats as any).accuracy || 0;
    }

    // Ensure chance is within valid range
    evasionChance = Math.max(0, Math.min(1, evasionChance));

    return this.rng() < evasionChance;
  }

  /**
   * Apply damage to an entity
   */
  private applyDamage(entity: GameEntity, damage: number): number {
    const stats = entity.stats as CharacterStats;
    const actualDamage = Math.min(damage, stats.hp);
    
    stats.hp = Math.max(0, stats.hp - damage);
    
    return actualDamage;
  }

  /**
   * Generate combat effects from an attack
   */
  private generateCombatEffects(
    attacker: GameEntity, 
    defender: GameEntity, 
    damage: number, 
    isCritical: boolean
  ): CombatEffect[] {
    const effects: CombatEffect[] = [];

    // Damage effect
    effects.push({
      type: 'damage',
      target: defender,
      value: damage
    });

    // Check for death
    const defenderStats = defender.stats as CharacterStats;
    if (defenderStats.hp <= 0) {
      effects.push({
        type: 'death',
        target: defender
      });
    }

    // TODO: Add status effect chances, weapon special effects, etc.

    return effects;
  }

  /**
   * Generate combat message
   */
  private generateCombatMessage(
    attacker: GameEntity, 
    defender: GameEntity, 
    damage: number, 
    isCritical: boolean
  ): string {
    const attackerName = (attacker as any).name || attacker.id;
    const defenderName = (defender as any).name || defender.id;
    
    let message = `${attackerName} attacks ${defenderName}`;
    
    if (isCritical) {
      message += ' with a critical hit';
    }
    
    message += ` for ${damage} damage!`;
    
    const defenderStats = defender.stats as CharacterStats;
    if (defenderStats.hp <= 0) {
      message += ` ${defenderName} is defeated!`;
    }
    
    return message;
  }

  /**
   * Check if entity can attack target
   */
  canAttack(attacker: GameEntity, target: GameEntity): boolean {
    // Basic checks
    if (attacker === target) return false;
    
    const attackerStats = attacker.stats as CharacterStats;
    const targetStats = target.stats as CharacterStats;
    
    if (attackerStats.hp <= 0) return false;
    if (targetStats.hp <= 0) return false;

    // TODO: Add range checks, line of sight, etc.
    
    return true;
  }

  /**
   * Get combat preview (damage estimation)
   */
  getCombatPreview(attacker: GameEntity, defender: GameEntity, weaponBonus: number = 0): {
    minDamage: number;
    maxDamage: number;
    averageDamage: number;
    criticalDamage: number;
    hitChance: number;
    criticalChance: number;
  } {
    // Calculate damage range without random factor
    const baseDamageCalc = this.calculateDamage(attacker, defender, weaponBonus, 1.0, false);
    const criticalDamageCalc = this.calculateDamage(attacker, defender, weaponBonus, 1.0, true);

    // Calculate damage range with random factor
    const baseWithoutRandom = baseDamageCalc.finalDamage / baseDamageCalc.randomMultiplier;
    const minDamage = Math.max(Math.floor(baseWithoutRandom * this.config.randomRangeMin), this.config.minimumDamage);
    const maxDamage = Math.max(Math.floor(baseWithoutRandom * this.config.randomRangeMax), this.config.minimumDamage);
    const averageDamage = Math.floor((minDamage + maxDamage) / 2);

    // Calculate hit chance (1 - evasion chance)
    const evasionChance = this.config.evasionEnabled ? 
      Math.min(1, Math.max(0, this.config.baseEvasionRate + (defender.stats.evasionRate || 0))) : 0;
    const hitChance = 1 - evasionChance;

    // Calculate critical chance
    const criticalChance = Math.min(1, Math.max(0, this.config.baseCriticalChance));

    return {
      minDamage,
      maxDamage,
      averageDamage,
      criticalDamage: criticalDamageCalc.finalDamage,
      hitChance,
      criticalChance
    };
  }

  /**
   * Log combat action
   */
  private logCombatAction(action: CombatAction, result: CombatResult): void {
    const logEntry: CombatLogEntry = {
      turn: this.combatState.turnCount,
      timestamp: Date.now(),
      action,
      result,
      message: result.message
    };

    this.combatState.combatLog.push(logEntry);
  }

  /**
   * Get combat log
   */
  getCombatLog(): CombatLogEntry[] {
    return [...this.combatState.combatLog];
  }

  /**
   * Clear combat log
   */
  clearCombatLog(): void {
    this.combatState.combatLog = [];
  }

  /**
   * Start combat
   */
  startCombat(participants: GameEntity[]): void {
    this.combatState.inCombat = true;
    this.combatState.participants = [...participants];
    this.combatState.turnCount = 0;
    this.combatState.combatLog = [];
  }

  /**
   * End combat
   */
  endCombat(): void {
    this.combatState.inCombat = false;
    this.combatState.participants = [];
    this.combatState.currentAttacker = undefined;
  }

  /**
   * Check if in combat
   */
  isInCombat(): boolean {
    return this.combatState.inCombat;
  }

  /**
   * Get combat participants
   */
  getCombatParticipants(): GameEntity[] {
    return [...this.combatState.participants];
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

  /**
   * Get attribute system
   */
  getAttributeSystem(): AttributeSystem {
    return this.attributeSystem;
  }
}