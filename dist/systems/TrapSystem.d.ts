/**
 * Trap system for handling various trap types and effects
 */
import { GameEntity } from '../types/entities';
import { Position } from '../types/core';
import { Trap, TrapType } from '../types/dungeon';
import { DungeonManager } from '../dungeon/DungeonManager';
import { StatusEffectSystem } from './StatusEffectSystem';
import { MovementSystem } from './MovementSystem';
export interface TrapActivationResult {
    success: boolean;
    trap: Trap;
    entity: GameEntity;
    effects: TrapEffect[];
    message: string;
    trapDestroyed: boolean;
}
export interface TrapEffect {
    type: TrapEffectType;
    value?: number;
    target: GameEntity;
    success: boolean;
    message: string;
}
export type TrapEffectType = 'damage' | 'status-effect' | 'teleport' | 'summon-monster' | 'hunger-drain' | 'stat-drain' | 'item-destruction' | 'confusion';
export interface TrapConfig {
    id: string;
    name: string;
    type: TrapType;
    visible: boolean;
    reusable: boolean;
    activationChance: number;
    effects: TrapEffectConfig[];
    description: string;
}
export interface TrapEffectConfig {
    type: TrapEffectType;
    value?: number;
    chance?: number;
    duration?: number;
    description: string;
}
export interface TrapDetectionResult {
    detected: boolean;
    trap?: Trap;
    position: Position;
    detectionChance: number;
}
export declare class TrapSystem {
    private dungeonManager;
    private statusEffectSystem;
    private movementSystem;
    private trapConfigs;
    private rng;
    constructor(dungeonManager: DungeonManager, statusEffectSystem: StatusEffectSystem, movementSystem: MovementSystem);
    /**
     * Check for trap activation when entity moves to position
     */
    checkTrapActivation(entity: GameEntity, position: Position): TrapActivationResult | null;
    /**
     * Activate a trap
     */
    private activateTrap;
    /**
     * Process individual trap effect
     */
    private processTrapEffect;
    /**
     * Apply trap damage
     */
    private applyTrapDamage;
    /**
     * Apply trap status effect
     */
    private applyTrapStatusEffect;
    /**
     * Apply trap teleportation
     */
    private applyTrapTeleport;
    /**
     * Apply trap monster summoning
     */
    private applyTrapSummon;
    /**
     * Apply trap hunger drain
     */
    private applyTrapHungerDrain;
    /**
     * Apply trap stat drain
     */
    private applyTrapStatDrain;
    /**
     * Apply trap item destruction
     */
    private applyTrapItemDestruction;
    /**
     * Apply trap confusion
     */
    private applyTrapConfusion;
    /**
     * Detect traps at position
     */
    detectTraps(entity: GameEntity, position: Position, detectionBonus?: number): TrapDetectionResult;
    /**
     * Disarm trap at position
     */
    disarmTrap(entity: GameEntity, position: Position, disarmBonus?: number): {
        success: boolean;
        trap?: Trap;
        message: string;
    };
    /**
     * Place trap at position
     */
    placeTrap(position: Position, trapType: TrapType, visible?: boolean): boolean;
    /**
     * Get trap name
     */
    private getTrapName;
    /**
     * Check if trap type is reusable
     */
    private isTrapReusable;
    /**
     * Generate trap activation message
     */
    private generateTrapMessage;
    /**
     * Initialize default trap configurations
     */
    private initializeDefaultTraps;
    /**
     * Get all trap configurations
     */
    getTrapConfigs(): Map<TrapType, TrapConfig>;
    /**
     * Get trap configuration by type
     */
    getTrapConfig(trapType: TrapType): TrapConfig | undefined;
    /**
     * Set custom RNG function for testing
     */
    setRNG(rng: () => number): void;
    /**
     * Get all traps in current dungeon
     */
    getAllTraps(): {
        position: Position;
        trap: Trap;
    }[];
    /**
     * Get visible traps in current dungeon
     */
    getVisibleTraps(): {
        position: Position;
        trap: Trap;
    }[];
    /**
     * Clear all traps from current dungeon
     */
    clearAllTraps(): void;
}
//# sourceMappingURL=TrapSystem.d.ts.map