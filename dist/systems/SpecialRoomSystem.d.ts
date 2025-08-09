/**
 * Special room system for handling monster houses, shops, and treasure rooms
 */
import { GameEntity } from '../types/entities';
import { Position } from '../types/core';
import { DungeonManager } from '../dungeon/DungeonManager';
import { ItemEntity } from '../entities/Item';
import { PlayerEntity } from '../entities/Player';
export type SpecialRoomType = 'monster-house' | 'shop' | 'treasure-room';
export interface SpecialRoomConfig {
    id: string;
    name: string;
    type: SpecialRoomType;
    spawnChance: number;
    minFloor: number;
    maxFloor: number;
    description: string;
}
export interface RoomGenerationResult {
    success: boolean;
    roomType: SpecialRoomType;
    position: Position;
    size: {
        width: number;
        height: number;
    };
    entities: GameEntity[];
    message: string;
}
export interface ShopItem {
    item: ItemEntity;
    price: number;
    position: Position;
}
export interface ShopTransactionResult {
    success: boolean;
    item?: ItemEntity;
    price?: number;
    message: string;
    playerGold?: number;
}
export declare class SpecialRoomSystem {
    private dungeonManager;
    private roomConfigs;
    private shopItems;
    private rng;
    constructor(dungeonManager: DungeonManager);
    /**
     * Generate special rooms for current dungeon floor
     */
    generateSpecialRooms(floorLevel: number): RoomGenerationResult[];
    /**
     * Generate a specific special room
     */
    private generateSpecialRoom;
    /**
     * Generate monster house
     */
    private generateMonsterHouse;
    /**
     * Generate shop
     */
    private generateShop;
    /**
     * Generate treasure room
     */
    private generateTreasureRoom;
    /**
     * Handle shop transaction
     */
    buyFromShop(player: PlayerEntity, itemPosition: Position): ShopTransactionResult;
    /**
     * Get shop item at position
     */
    getShopItemAt(position: Position): ShopItem | undefined;
    /**
     * Check if position is in a shop
     */
    isShopPosition(position: Position): boolean;
    /**
     * Find suitable room location
     */
    private findSuitableRoomLocation;
    /**
     * Get random position within room
     */
    private getRandomPositionInRoom;
    /**
     * Create random monster for monster house
     */
    private createRandomMonster;
    /**
     * Create random shop item
     */
    private createRandomShopItem;
    /**
     * Create random treasure item (higher quality)
     */
    private createRandomTreasureItem;
    /**
     * Calculate item price based on type and floor level
     */
    private calculateItemPrice;
    /**
     * Initialize room configurations
     */
    private initializeRoomConfigs;
    /**
     * Get room configuration
     */
    getRoomConfig(roomType: SpecialRoomType): SpecialRoomConfig | undefined;
    /**
     * Get all room configurations
     */
    getAllRoomConfigs(): Map<SpecialRoomType, SpecialRoomConfig>;
    /**
     * Set custom RNG for testing
     */
    setRNG(rng: () => number): void;
    /**
     * Clear all shop data
     */
    clearShopData(): void;
    /**
     * Get shop statistics
     */
    getShopStats(): {
        totalShops: number;
        totalItems: number;
        averagePrice: number;
    };
}
//# sourceMappingURL=SpecialRoomSystem.d.ts.map