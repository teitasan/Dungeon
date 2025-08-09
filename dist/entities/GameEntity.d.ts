/**
 * Base GameEntity class and factory functions
 * Provides common functionality for all game entities
 */
import { GameEntity, Position, Component, EntityStats, EntityFlags } from '../types/core';
import { CharacterStats, CharacterAttributes } from '../types/entities';
/**
 * Base GameEntity implementation
 */
export declare class BaseGameEntity implements GameEntity {
    id: string;
    position: Position;
    components: Component[];
    stats: EntityStats;
    flags: EntityFlags;
    constructor(id: string, position: Position, stats: EntityStats, components?: Component[], flags?: EntityFlags);
    /**
     * Update entity position
     */
    setPosition(position: Position): void;
    /**
     * Add a component to this entity
     */
    addComponent(component: Component): void;
    /**
     * Remove a component by ID
     */
    removeComponent(componentId: string): void;
    /**
     * Get a component by ID
     */
    getComponent(componentId: string): Component | undefined;
    /**
     * Update entity stats
     */
    updateStats(newStats: Partial<EntityStats>): void;
    /**
     * Set a flag value
     */
    setFlag(key: string, value: any): void;
    /**
     * Get a flag value
     */
    getFlag(key: string): any;
}
/**
 * Create default character stats
 */
export declare function createDefaultCharacterStats(level?: number, baseHp?: number, baseAttack?: number, baseDefense?: number): CharacterStats;
/**
 * Create default character attributes
 */
export declare function createDefaultCharacterAttributes(primaryAttribute?: string): CharacterAttributes;
/**
 * Calculate level-up stats based on growth rates
 */
export declare function calculateLevelUpStats(currentStats: CharacterStats, growthRates: {
    hp: number;
    attack: number;
    defense: number;
}): CharacterStats;
/**
 * Check if character has enough experience to level up
 */
export declare function canLevelUp(stats: CharacterStats, experienceTable: number[]): boolean;
/**
 * Add experience to character and handle level up
 */
export declare function addExperience(stats: CharacterStats, amount: number, experienceTable: number[], growthRates: {
    hp: number;
    attack: number;
    defense: number;
}): {
    newStats: CharacterStats;
    leveledUp: boolean;
};
//# sourceMappingURL=GameEntity.d.ts.map