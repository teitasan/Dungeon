/**
 * Combat system types
 */
import { Position } from './core';
import { GameEntity } from './entities';
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
export interface CombatEffect {
    type: CombatEffectType;
    target: GameEntity;
    value?: number;
    duration?: number;
    data?: any;
}
export type CombatEffectType = 'damage' | 'heal' | 'status-effect' | 'knockback' | 'stun' | 'death';
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
    statusEffectChances: Record<string, number>;
}
export interface CombatStats {
    attack: number;
    defense: number;
    accuracy: number;
    evasion: number;
    criticalChance: number;
    criticalResistance: number;
    statusResistance: Record<string, number>;
}
export interface CombatAction {
    type: CombatActionType;
    attacker: GameEntity;
    target?: GameEntity;
    targetPosition?: Position;
    data?: any;
}
export type CombatActionType = 'attack' | 'defend' | 'counter-attack' | 'special-attack';
export interface AttackRange {
    type: AttackRangeType;
    range: number;
    pattern?: Position[];
    requiresLineOfSight: boolean;
}
export type AttackRangeType = 'melee' | 'ranged' | 'area' | 'line' | 'custom';
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
export interface CombatLogEntry {
    turn: number;
    timestamp: number;
    action: CombatAction;
    result: CombatResult;
    message: string;
}
export interface CombatState {
    inCombat: boolean;
    participants: GameEntity[];
    currentAttacker?: GameEntity;
    combatLog: CombatLogEntry[];
    turnCount: number;
}
export interface DamageResistance {
    damageType: DamageType;
    resistance: number;
}
export interface CombatFormulas {
    calculateBaseDamage(attack: number, defense: number): number;
    calculateCriticalChance(attacker: GameEntity, defender: GameEntity): number;
    calculateEvasionChance(attacker: GameEntity, defender: GameEntity): number;
    applyRandomVariation(damage: number): number;
    applyAttributeModifier(damage: number, attackerAttribute: string, defenderAttribute: string): number;
}
//# sourceMappingURL=combat.d.ts.map