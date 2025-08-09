/**
 * Combat system implementation
 * Handles damage calculation, critical hits, and combat resolution
 */
import { GameEntity } from '../types/entities';
import { CombatResult, AttackParams, CombatConfig, CombatLogEntry } from '../types/combat';
import { AttributeSystem } from './AttributeSystem';
export declare class CombatSystem {
    private config;
    private combatState;
    private rng;
    private attributeSystem;
    constructor(config?: Partial<CombatConfig>);
    /**
     * Execute an attack between two entities
     */
    executeAttack(params: AttackParams): CombatResult;
    /**
     * Calculate damage using the mystery dungeon formula
     * Formula: {攻撃力×1.3×(35/36)^防御力}×(7/8~9/8)
     */
    private calculateDamage;
    /**
     * Check if attack results in critical hit
     */
    private checkCriticalHit;
    /**
     * Check if attack is evaded
     */
    private checkEvasion;
    /**
     * Apply damage to an entity
     */
    private applyDamage;
    /**
     * Generate combat effects from an attack
     */
    private generateCombatEffects;
    /**
     * Generate combat message
     */
    private generateCombatMessage;
    /**
     * Check if entity can attack target
     */
    canAttack(attacker: GameEntity, target: GameEntity): boolean;
    /**
     * Get combat preview (damage estimation)
     */
    getCombatPreview(attacker: GameEntity, defender: GameEntity, weaponBonus?: number): {
        minDamage: number;
        maxDamage: number;
        averageDamage: number;
        criticalDamage: number;
        hitChance: number;
        criticalChance: number;
    };
    /**
     * Log combat action
     */
    private logCombatAction;
    /**
     * Get combat log
     */
    getCombatLog(): CombatLogEntry[];
    /**
     * Clear combat log
     */
    clearCombatLog(): void;
    /**
     * Start combat
     */
    startCombat(participants: GameEntity[]): void;
    /**
     * End combat
     */
    endCombat(): void;
    /**
     * Check if in combat
     */
    isInCombat(): boolean;
    /**
     * Get combat participants
     */
    getCombatParticipants(): GameEntity[];
    /**
     * Set random number generator (for testing)
     */
    setRNG(rng: () => number): void;
    /**
     * Get current combat configuration
     */
    getConfig(): CombatConfig;
    /**
     * Update combat configuration
     */
    updateConfig(newConfig: Partial<CombatConfig>): void;
    /**
     * Get attribute system
     */
    getAttributeSystem(): AttributeSystem;
}
//# sourceMappingURL=CombatSystem.d.ts.map