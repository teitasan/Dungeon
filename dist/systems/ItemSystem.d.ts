/**
 * Item system for managing items, inventory, and item usage
 */
import { GameEntity } from '../types/entities';
import { ItemEntity } from '../entities/Item';
import { Position } from '../types/core';
import { DungeonManager } from '../dungeon/DungeonManager';
export interface ItemUsageResult {
    success: boolean;
    item: ItemEntity;
    user: GameEntity;
    effects: ItemUsageEffect[];
    message: string;
    consumed: boolean;
}
export interface ItemUsageEffect {
    type: ItemUsageEffectType;
    value?: number;
    target: GameEntity;
    success: boolean;
    message: string;
}
export type ItemUsageEffectType = 'heal' | 'restore-hunger' | 'cure-status' | 'stat-boost' | 'teleport' | 'identify' | 'damage' | 'special';
export interface ItemPickupResult {
    success: boolean;
    item: ItemEntity;
    entity: GameEntity;
    message: string;
    reason?: string;
}
export interface ItemDropResult {
    success: boolean;
    item: ItemEntity;
    entity: GameEntity;
    position: Position;
    message: string;
    reason?: string;
}
export interface InventoryManager {
    addItem(entity: GameEntity, item: ItemEntity): boolean;
    removeItem(entity: GameEntity, itemId: string): ItemEntity | null;
    getItems(entity: GameEntity): ItemEntity[];
    hasItem(entity: GameEntity, itemId: string): boolean;
    getItemCount(entity: GameEntity): number;
    getMaxCapacity(entity: GameEntity): number;
    isFull(entity: GameEntity): boolean;
}
export declare class ItemSystem implements InventoryManager {
    private dungeonManager;
    private itemTemplates;
    constructor(dungeonManager: DungeonManager);
    /**
     * Use an item
     */
    useItem(user: GameEntity, item: ItemEntity, target?: GameEntity): ItemUsageResult;
    /**
     * Process individual item effect
     */
    private processItemEffect;
    /**
     * Generate usage message
     */
    private generateUsageMessage;
    /**
     * Pick up item from ground
     */
    pickupItem(entity: GameEntity, position: Position): ItemPickupResult;
    /**
     * Drop item at position
     */
    dropItem(entity: GameEntity, itemId: string, position: Position): ItemDropResult;
    /**
     * Add item to entity inventory
     */
    addItem(entity: GameEntity, item: ItemEntity): boolean;
    /**
     * Remove item from entity inventory
     */
    removeItem(entity: GameEntity, itemId: string): ItemEntity | null;
    /**
     * Get all items in entity inventory
     */
    getItems(entity: GameEntity): ItemEntity[];
    /**
     * Check if entity has specific item
     */
    hasItem(entity: GameEntity, itemId: string): boolean;
    /**
     * Get item count in inventory
     */
    getItemCount(entity: GameEntity): number;
    /**
     * Get maximum inventory capacity
     */
    getMaxCapacity(entity: GameEntity): number;
    /**
     * Check if inventory is full
     */
    isFull(entity: GameEntity): boolean;
    /**
     * Check if entity has inventory support
     */
    private hasInventorySupport;
    /**
     * Get entity inventory array
     */
    private getInventory;
    /**
     * Create item from template
     */
    createItem(templateId: string, position: Position): ItemEntity | null;
    /**
     * Register item template
     */
    registerItemTemplate(template: ItemTemplate): void;
    /**
     * Get item template
     */
    getItemTemplate(templateId: string): ItemTemplate | undefined;
    /**
     * Get all item template IDs
     */
    getItemTemplateIds(): string[];
    /**
     * Initialize default item templates
     */
    private initializeDefaultItems;
}
export interface ItemTemplate {
    id: string;
    name: string;
    itemType: any;
    identified: boolean;
    cursed: boolean;
    effects?: any[];
    equipmentStats?: any;
    attributes?: any;
    durability?: number;
}
//# sourceMappingURL=ItemSystem.d.ts.map