/**
 * Companion entity implementation
 */
import { Position, Component, EntityFlags } from '../types/core';
import { Companion, CharacterStats, CharacterAttributes, StatusEffect, Item } from '../types/entities';
import { BaseGameEntity } from './GameEntity';
export declare class CompanionEntity extends BaseGameEntity implements Companion {
    name: string;
    companionType: string;
    stats: CharacterStats;
    attributes: CharacterAttributes;
    aiType: string;
    behaviorMode: 'follow' | 'attack' | 'defend' | 'explore' | 'wait';
    equipment: {
        weapon?: Item;
        armor?: Item;
        accessory?: Item;
    };
    statusEffects: StatusEffect[];
    constructor(id: string, name: string, companionType: string, position: Position, stats?: CharacterStats, attributes?: CharacterAttributes, aiType?: string, components?: Component[], flags?: EntityFlags);
    /**
     * Set behavior mode
     */
    setBehaviorMode(mode: 'follow' | 'attack' | 'defend' | 'explore' | 'wait'): void;
    /**
     * Equip an item
     */
    equipItem(item: Item): boolean;
    /**
     * Unequip an item
     */
    unequipItem(slot: keyof typeof this.equipment): Item | undefined;
    /**
     * Apply equipment bonuses to stats
     */
    private applyEquipmentBonuses;
    /**
     * Add status effect
     */
    addStatusEffect(effect: StatusEffect): void;
    /**
     * Remove status effect
     */
    removeStatusEffect(type: StatusEffect['type']): void;
    /**
     * Check if companion has a specific status effect
     */
    hasStatusEffect(type: StatusEffect['type']): boolean;
    /**
     * Update AI type
     */
    setAIType(aiType: string): void;
    /**
     * Check if companion is following player
     */
    isFollowing(): boolean;
    /**
     * Check if companion is in combat mode
     */
    isInCombat(): boolean;
    /**
     * Get experience value based on level (companions can be defeated)
     */
    getExperienceValue(): number;
}
//# sourceMappingURL=Companion.d.ts.map