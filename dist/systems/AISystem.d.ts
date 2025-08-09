/**
 * AI system for managing enemy and companion behavior
 */
import { GameEntity } from '../types/entities';
import { Position } from '../types/core';
import { DungeonManager } from '../dungeon/DungeonManager';
import { MovementSystem } from './MovementSystem';
import { CombatSystem } from './CombatSystem';
import { TurnSystem } from './TurnSystem';
export type AIBehaviorType = 'aggressive' | 'defensive' | 'passive' | 'patrol' | 'guard' | 'follow' | 'flee' | 'random';
export type AIActionType = 'move' | 'attack' | 'wait' | 'use-item' | 'special';
export interface AIDecision {
    action: AIActionType;
    target?: GameEntity;
    position?: Position;
    data?: any;
    priority: number;
}
export interface AIBehaviorConfig {
    type: AIBehaviorType;
    aggroRange: number;
    attackRange: number;
    fleeThreshold: number;
    patrolRadius: number;
    followDistance: number;
    decisionCooldown: number;
}
export interface AIState {
    target?: GameEntity;
    lastKnownTargetPosition?: Position;
    homePosition: Position;
    patrolPoints: Position[];
    currentPatrolIndex: number;
    aggroLevel: number;
    lastDecisionTime: number;
    behaviorOverride?: AIBehaviorType;
}
export declare class AISystem {
    private dungeonManager;
    private movementSystem;
    private combatSystem;
    private turnSystem;
    private aiStates;
    private behaviorConfigs;
    constructor(dungeonManager: DungeonManager, movementSystem: MovementSystem, combatSystem: CombatSystem, turnSystem: TurnSystem);
    /**
     * Process AI for an entity
     */
    processAI(entity: GameEntity): AIDecision | null;
    /**
     * Make AI decision based on behavior type
     */
    private makeDecision;
    /**
     * Aggressive AI behavior
     */
    private makeAggressiveDecision;
    /**
     * Defensive AI behavior
     */
    private makeDefensiveDecision;
    /**
     * Follow AI behavior (for companions)
     */
    private makeFollowDecision;
    /**
     * Passive AI behavior
     */
    private makePassiveDecision;
    /**
     * Patrol AI behavior
     */
    private makePatrolDecision;
    /**
     * Guard AI behavior
     */
    private makeGuardDecision;
    /**
     * Flee AI behavior
     */
    private makeFleeDecision;
    /**
     * Random AI behavior
     */
    private makeRandomDecision;
    /**
     * Find nearest enemy
     */
    private findNearestEnemy;
    /**
     * Find nearby enemies
     */
    private findNearbyEnemies;
    /**
     * Check if two entities are enemies
     */
    private isEnemy;
    /**
     * Find player entity
     */
    private findPlayer;
    /**
     * Get next move towards target
     */
    private getNextMoveTowards;
    /**
     * Get flee position away from threat
     */
    private getFleePosition;
    /**
     * Get random adjacent position
     */
    private getRandomAdjacentPosition;
    /**
     * Calculate distance between positions
     */
    private getDistance;
    /**
     * Get or create AI state for entity
     */
    private getOrCreateAIState;
    /**
     * Update AI state based on decision
     */
    private updateAIState;
    /**
     * Check if entity has AI support
     */
    private hasAISupport;
    /**
     * Get AI type from entity
     */
    private getAIType;
    /**
     * Register AI behavior configuration
     */
    registerBehavior(aiType: string, config: AIBehaviorConfig): void;
    /**
     * Set behavior override for entity
     */
    setBehaviorOverride(entity: GameEntity, behavior: AIBehaviorType): void;
    /**
     * Clear behavior override for entity
     */
    clearBehaviorOverride(entity: GameEntity): void;
    /**
     * Initialize default AI behaviors
     */
    private initializeDefaultBehaviors;
}
//# sourceMappingURL=AISystem.d.ts.map