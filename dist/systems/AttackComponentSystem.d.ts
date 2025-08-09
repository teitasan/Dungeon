/**
 * Attack component system for handling different attack patterns and ranges
 */
import { Position } from '../types/core';
import { GameEntity } from '../types/entities';
import { DungeonManager } from '../dungeon/DungeonManager';
export type AttackRangeType = 'adjacent' | 'line' | 'area' | 'custom';
export interface AttackRangeConfig {
    type: AttackRangeType;
    range: number;
    pattern?: Position[];
    requiresLineOfSight: boolean;
    piercing: boolean;
}
export interface AttackCountConfig {
    count: number;
    multiTarget: boolean;
    consecutiveOnly: boolean;
}
export interface AttackTargetConfig {
    targetType: AttackTargetType;
    maxTargets: number;
    targetSelection: TargetSelectionType;
    friendlyFire: boolean;
}
export type AttackTargetType = 'single' | 'multiple' | 'all-in-range';
export type TargetSelectionType = 'closest' | 'furthest' | 'random' | 'manual';
export interface AttackComponentResult {
    validTargets: GameEntity[];
    targetPositions: Position[];
    attackPattern: Position[];
    canAttack: boolean;
    reason?: string;
}
export interface AttackExecutionResult {
    success: boolean;
    attacker: GameEntity;
    targets: AttackTargetResult[];
    totalDamage: number;
    message: string;
}
export interface AttackTargetResult {
    target: GameEntity;
    position: Position;
    hit: boolean;
    damage: number;
    effects: string[];
}
export declare class AttackComponentSystem {
    private dungeonManager;
    constructor(dungeonManager: DungeonManager);
    /**
     * Calculate attack range positions
     */
    calculateAttackRange(attacker: GameEntity, rangeConfig: AttackRangeConfig, direction?: Position): Position[];
    /**
     * Get valid targets within attack range
     */
    getValidTargets(attacker: GameEntity, rangeConfig: AttackRangeConfig, targetConfig: AttackTargetConfig, direction?: Position): AttackComponentResult;
    /**
     * Execute attack with components
     */
    executeAttack(attacker: GameEntity, rangeConfig: AttackRangeConfig, countConfig: AttackCountConfig, targetConfig: AttackTargetConfig, direction?: Position): AttackExecutionResult;
    /**
     * Execute individual attack between two entities
     */
    private executeIndividualAttack;
    /**
     * Get adjacent positions within range
     */
    private getAdjacentPositions;
    /**
     * Get line positions in direction
     */
    private getLinePositions;
    /**
     * Get area positions (circle/square around center)
     */
    private getAreaPositions;
    /**
     * Get custom pattern positions
     */
    private getCustomPatternPositions;
    /**
     * Check if position is valid (within bounds)
     */
    private isValidPosition;
    /**
     * Check line of sight between two positions
     */
    private hasLineOfSight;
    /**
     * Check if entity is valid target
     */
    private isValidTarget;
    /**
     * Select targets based on configuration
     */
    private selectTargets;
    /**
     * Calculate distance between positions
     */
    private getDistance;
    /**
     * Shuffle array randomly
     */
    private shuffleArray;
    /**
     * Generate attack message
     */
    private generateAttackMessage;
    /**
     * Create default attack range configurations
     */
    static createAdjacentRange(range?: number): AttackRangeConfig;
    static createLineRange(range: number, requiresLineOfSight?: boolean): AttackRangeConfig;
    static createAreaRange(range: number): AttackRangeConfig;
    static createCustomRange(pattern: Position[], requiresLineOfSight?: boolean): AttackRangeConfig;
    /**
     * Create default attack count configurations
     */
    static createSingleAttack(): AttackCountConfig;
    static createMultiAttack(count: number, multiTarget?: boolean): AttackCountConfig;
    /**
     * Create default attack target configurations
     */
    static createSingleTarget(): AttackTargetConfig;
    static createMultiTarget(maxTargets: number, selection?: TargetSelectionType): AttackTargetConfig;
    static createAllTargets(): AttackTargetConfig;
}
//# sourceMappingURL=AttackComponentSystem.d.ts.map