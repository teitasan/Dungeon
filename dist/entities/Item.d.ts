/**
 * Item entity implementation
 */
import { Position, Component, EntityFlags } from '../types/core';
import { Item, ItemType, ItemEffect, EquipmentStats } from '../types/entities';
import { BaseGameEntity } from './GameEntity';
export declare class ItemEntity extends BaseGameEntity implements Item {
    name: string;
    itemType: ItemType;
    identified: boolean;
    cursed: boolean;
    durability?: number;
    effects: ItemEffect[];
    attributes?: {
        attackAttribute?: string;
        defenseAttributes?: string[];
    };
    equipmentStats?: EquipmentStats;
    constructor(id: string, name: string, itemType: ItemType, position: Position, identified?: boolean, cursed?: boolean, components?: Component[], flags?: EntityFlags);
    /**
     * Add an effect to this item
     */
    addEffect(effect: ItemEffect): void;
    /**
     * Remove an effect from this item
     */
    removeEffect(effectType: string): void;
    /**
     * Check if item has a specific effect
     */
    hasEffect(effectType: string): boolean;
    /**
     * Get effect by type
     */
    getEffect(effectType: string): ItemEffect | undefined;
    /**
     * Set equipment stats for equippable items
     */
    setEquipmentStats(stats: EquipmentStats): void;
    /**
     * Set item attributes (for weapons and armor)
     */
    setAttributes(attributes: {
        attackAttribute?: string;
        defenseAttributes?: string[];
    }): void;
    /**
     * Set durability for items that can break
     */
    setDurability(durability: number): void;
    /**
     * Reduce durability (returns true if item breaks)
     */
    reduceDurability(amount?: number): boolean;
    /**
     * Identify the item
     */
    identify(): void;
    /**
     * Check if item is equippable
     */
    isEquippable(): boolean;
    /**
     * Check if item is consumable
     */
    isConsumable(): boolean;
    /**
     * Check if item is a weapon
     */
    isWeapon(): boolean;
    /**
     * Check if item is armor
     */
    isArmor(): boolean;
    /**
     * Check if item is an accessory
     */
    isAccessory(): boolean;
    /**
     * Get display name (may be different if unidentified)
     */
    getDisplayName(): string;
    /**
     * Use the item (for consumables)
     */
    use(): ItemEffect[];
}
//# sourceMappingURL=Item.d.ts.map