/**
 * Player entity implementation
 */
import { Position, Component, EntityFlags } from '../types/core';
import { Player, CharacterStats, CharacterAttributes, StatusEffect, Item } from '../types/entities';
import { BaseGameEntity } from './GameEntity';
export declare class PlayerEntity extends BaseGameEntity implements Player {
    name: string;
    stats: CharacterStats;
    attributes: CharacterAttributes;
    hunger: number;
    maxHunger: number;
    inventory: Item[];
    equipment: {
        weapon?: Item;
        armor?: Item;
        accessory?: Item;
    };
    statusEffects: StatusEffect[];
    constructor(id: string, name: string, position: Position, stats?: CharacterStats, attributes?: CharacterAttributes, components?: Component[], flags?: EntityFlags);
    /**
     * Add item to inventory
     */
    addToInventory(item: Item): boolean;
    /**
     * Remove item from inventory
     */
    removeFromInventory(itemId: string): Item | undefined;
    /**
     * Equip an item
     */
    equipItem(item: Item): boolean;
    /**
     * Unequip an item
     */
    unequipItem(slot: keyof typeof this.equipment): boolean;
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
     * Check if player has a specific status effect
     */
    hasStatusEffect(type: StatusEffect['type']): boolean;
    /**
     * Update hunger level
     */
    updateHunger(amount: number): void;
    /**
     * Check if player is hungry (hunger at minimum)
     */
    isHungry(): boolean;
}
//# sourceMappingURL=Player.d.ts.map