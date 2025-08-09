/**
 * Status effect system for handling poison, confusion, paralysis, and bind
 */
import { GameEntity, StatusEffect } from '../types/entities';
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
export interface StatusEffectAction {
    type: StatusEffectActionType;
    timing: StatusEffectTiming;
    value?: number;
    chance?: number;
    description: string;
}
export type StatusEffectActionType = 'damage' | 'heal' | 'prevent-action' | 'random-action' | 'stat-modifier' | 'movement-restriction';
export type StatusEffectTiming = 'turn-start' | 'turn-end' | 'before-action' | 'after-action' | 'on-attack' | 'on-defend';
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
export declare class StatusEffectSystem {
    private statusConfigs;
    private rng;
    constructor();
    /**
     * Apply status effect to entity
     */
    applyStatusEffect(entity: GameEntity, effectType: string, intensity?: number, source?: string): boolean;
    /**
     * Remove status effect from entity
     */
    removeStatusEffect(entity: GameEntity, effectType: string): boolean;
    /**
     * Process status effects for entity at specific timing
     */
    processStatusEffects(entity: GameEntity, timing: StatusEffectTiming): StatusEffectResult[];
    /**
     * Process individual status effect
     */
    private processStatusEffect;
    /**
     * Execute status effect action
     */
    private executeStatusAction;
    /**
     * Check if status effect recovers
     */
    private checkRecovery;
    /**
     * Check if entity has status effect support
     */
    private hasStatusEffectSupport;
    /**
     * Get entity's status effects array
     */
    private getEntityStatusEffects;
    /**
     * Get all status effects on entity
     */
    getStatusEffects(entity: GameEntity): StatusEffect[];
    /**
     * Check if entity has specific status effect
     */
    hasStatusEffect(entity: GameEntity, effectType: string): boolean;
    /**
     * Get status effect by type
     */
    getStatusEffect(entity: GameEntity, effectType: string): StatusEffect | undefined;
    /**
     * Clear all status effects from entity
     */
    clearAllStatusEffects(entity: GameEntity): void;
    /**
     * Register status effect configuration
     */
    registerStatusEffect(config: StatusEffectConfig): void;
    /**
     * Get status effect configuration
     */
    getStatusEffectConfig(effectType: string): StatusEffectConfig | undefined;
    /**
     * Get all registered status effect types
     */
    getRegisteredStatusEffects(): string[];
    /**
     * Set random number generator (for testing)
     */
    setRNG(rng: () => number): void;
    /**
     * Initialize default status effects
     */
    private initializeDefaultStatusEffects;
}
//# sourceMappingURL=StatusEffectSystem.d.ts.map