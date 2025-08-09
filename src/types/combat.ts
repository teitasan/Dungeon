/**
 * Combat system types
 */

import { Position } from './core';
import { GameEntity, CharacterStats } from './entities';

// Combat result
export interface CombatResult {
  success: boolean;
  damage: number;
  actualDamage: number;
  critical: boolean;
  evaded: boolean;
  blocked: boolean;
  attacker: GameEntity;
  defender: GameEntity;
  effects: CombatEffect[];
  message: string;
}

// Combat effect (status effects, knockback, etc.)
export interface CombatEffect {
  type: CombatEffectType;
  target: GameEntity;
  value?: number;
  duration?: number;
  data?: any;
}

export type CombatEffectType = 'damage' | 'heal' | 'status-effect' | 'knockback' | 'stun' | 'death';

// Attack parameters
export interface AttackParams {
  attacker: GameEntity;
  defender: GameEntity;
  attackType: AttackType;
  weaponBonus?: number;
  attributeModifier?: number;
  criticalOverride?: boolean;
  unavoidable?: boolean;
}

export type AttackType = 'melee' | 'ranged' | 'magic' | 'special';

// Damage calculation parameters
export interface DamageCalculation {
  baseAttack: number;
  defense: number;
  attackMultiplier: number;
  defenseReduction: number;
  randomMultiplier: number;
  attributeMultiplier: number;
  weaponBonus: number;
  finalDamage: number;
  minimumDamage: number;
}

// Combat configuration
export interface CombatConfig {
  // Base damage formula: {攻撃力×1.3×(35/36)^防御力}×(7/8~9/8)
  attackMultiplier: number; // 1.3
  defenseBase: number; // 35/36
  randomRangeMin: number; // 7/8
  randomRangeMax: number; // 9/8
  minimumDamage: number; // 1
  
  // Critical hit system
  baseCriticalChance: number; // 0.05 (5%)
  criticalMultiplier: number; // 2.0 (ignores defense)
  
  // Evasion system
  baseEvasionRate: number; // 0.05 (5%)
  evasionEnabled: boolean;
  
  // Status effects
  statusEffectChances: Record<string, number>;
}

// Combat stats for entities
export interface CombatStats {
  attack: number;
  defense: number;
  accuracy: number;
  evasion: number;
  criticalChance: number;
  criticalResistance: number;
  statusResistance: Record<string, number>;
}

// Combat action
export interface CombatAction {
  type: CombatActionType;
  attacker: GameEntity;
  target?: GameEntity;
  targetPosition?: Position;
  data?: any;
}

export type CombatActionType = 'attack' | 'defend' | 'counter-attack' | 'special-attack';

// Combat range and targeting
export interface AttackRange {
  type: AttackRangeType;
  range: number;
  pattern?: Position[];
  requiresLineOfSight: boolean;
}

export type AttackRangeType = 'melee' | 'ranged' | 'area' | 'line' | 'custom';

// Weapon and equipment combat modifiers
export interface WeaponStats {
  attackBonus: number;
  accuracyBonus: number;
  criticalBonus: number;
  range: AttackRange;
  damageType: DamageType;
  specialEffects: WeaponEffect[];
}

export type DamageType = 'physical' | 'magical' | 'elemental' | 'true';

export interface WeaponEffect {
  type: string;
  chance: number;
  value?: number;
  description: string;
}

// Combat log entry
export interface CombatLogEntry {
  turn: number;
  timestamp: number;
  action: CombatAction;
  result: CombatResult;
  message: string;
}

// Combat state
export interface CombatState {
  inCombat: boolean;
  participants: GameEntity[];
  currentAttacker?: GameEntity;
  combatLog: CombatLogEntry[];
  turnCount: number;
}

// Damage type resistances and weaknesses
export interface DamageResistance {
  damageType: DamageType;
  resistance: number; // 0.0 = immune, 0.5 = half damage, 1.0 = normal, 2.0 = double damage
}

// Combat formulas
export interface CombatFormulas {
  calculateBaseDamage(attack: number, defense: number): number;
  calculateCriticalChance(attacker: GameEntity, defender: GameEntity): number;
  calculateEvasionChance(attacker: GameEntity, defender: GameEntity): number;
  applyRandomVariation(damage: number): number;
  applyAttributeModifier(damage: number, attackerAttribute: string, defenderAttribute: string): number;
}