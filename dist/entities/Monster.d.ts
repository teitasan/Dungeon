/**
 * Monster entity implementation
 */
import { Position, Component, EntityFlags } from '../types/core';
import { Monster, CharacterStats, CharacterAttributes, StatusEffect, DropTableEntry, SpawnCondition } from '../types/entities';
import { BaseGameEntity } from './GameEntity.js';
export declare class MonsterEntity extends BaseGameEntity implements Monster {
    name: string;
    monsterType: string;
    stats: CharacterStats;
    attributes: CharacterAttributes;
    aiType: string;
    dropTable: DropTableEntry[];
    spawnWeight: number;
    spawnConditions: SpawnCondition[];
    statusEffects: StatusEffect[];
    constructor(id: string, name: string, monsterType: string, position: Position, stats?: CharacterStats, attributes?: CharacterAttributes, aiType?: string, components?: Component[], flags?: EntityFlags);
    /**
     * Add drop table entry
     */
    addDropTableEntry(entry: DropTableEntry): void;
    /**
     * Remove drop table entry
     */
    removeDropTableEntry(itemId: string): void;
    /**
     * Get total drop weight for probability calculations
     */
    getTotalDropWeight(): number;
    /**
     * Add spawn condition
     */
    addSpawnCondition(condition: SpawnCondition): void;
    /**
     * Check if monster can spawn based on conditions
     */
    canSpawn(context: any): boolean;
    /**
     * Add status effect
     */
    addStatusEffect(effect: StatusEffect): void;
    /**
     * Remove status effect
     */
    removeStatusEffect(type: StatusEffect['type']): void;
    /**
     * Check if monster has a specific status effect
     */
    hasStatusEffect(type: StatusEffect['type']): boolean;
    /**
     * Update AI type
     */
    setAIType(aiType: string): void;
    /**
     * Check if monster is hostile
     */
    isHostile(): boolean;
    /**
     * Get experience value based on level
     */
    getExperienceValue(): number;
}
//# sourceMappingURL=Monster.d.ts.map