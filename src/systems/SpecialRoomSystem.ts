/**
 * Special room system for handling monster houses, shops, and treasure rooms
 */

import { GameEntity } from '../types/entities';
import { Position } from '../types/core';
import { DungeonManager } from '../dungeon/DungeonManager';
import { MonsterEntity } from '../entities/Monster';
import { ItemEntity } from '../entities/Item';
import { PlayerEntity } from '../entities/Player';

// Special room types
export type SpecialRoomType = 'monster-house' | 'shop' | 'treasure-room';

// Special room configuration
export interface SpecialRoomConfig {
  id: string;
  name: string;
  type: SpecialRoomType;
  spawnChance: number;
  minFloor: number;
  maxFloor: number;
  description: string;
}

// Room generation result
export interface RoomGenerationResult {
  success: boolean;
  roomType: SpecialRoomType;
  position: Position;
  size: { width: number; height: number };
  entities: GameEntity[];
  message: string;
}

// Shop item with price
export interface ShopItem {
  item: ItemEntity;
  price: number;
  position: Position;
}

// Shop transaction result
export interface ShopTransactionResult {
  success: boolean;
  item?: ItemEntity;
  price?: number;
  message: string;
  playerGold?: number;
}

export class SpecialRoomSystem {
  private dungeonManager: DungeonManager;
  private roomConfigs: Map<SpecialRoomType, SpecialRoomConfig> = new Map();
  private shopItems: Map<string, ShopItem[]> = new Map(); // roomId -> items
  private rng: () => number;

  constructor(dungeonManager: DungeonManager) {
    this.dungeonManager = dungeonManager;
    this.rng = Math.random;
    this.initializeRoomConfigs();
  }

  /**
   * Generate special rooms for current dungeon floor
   */
  generateSpecialRooms(floorLevel: number): RoomGenerationResult[] {
    const results: RoomGenerationResult[] = [];
    const dungeon = this.dungeonManager.getCurrentDungeon();
    if (!dungeon) return results;

    // Get available rooms for this floor
    const availableRooms = Array.from(this.roomConfigs.values())
      .filter(config => floorLevel >= config.minFloor && floorLevel <= config.maxFloor);

    for (const config of availableRooms) {
      if (this.rng() < config.spawnChance) {
        const result = this.generateSpecialRoom(config, floorLevel);
        if (result.success) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Generate a specific special room
   */
  private generateSpecialRoom(config: SpecialRoomConfig, floorLevel: number): RoomGenerationResult {
    const dungeon = this.dungeonManager.getCurrentDungeon();
    if (!dungeon) {
      return {
        success: false,
        roomType: config.type,
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
        entities: [],
        message: 'No dungeon available'
      };
    }

    // Find suitable room location
    const roomLocation = this.findSuitableRoomLocation(dungeon.width, dungeon.height);
    if (!roomLocation) {
      return {
        success: false,
        roomType: config.type,
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
        entities: [],
        message: 'No suitable location found'
      };
    }

    switch (config.type) {
      case 'monster-house':
        return this.generateMonsterHouse(roomLocation, floorLevel);
      case 'shop':
        return this.generateShop(roomLocation, floorLevel);
      case 'treasure-room':
        return this.generateTreasureRoom(roomLocation, floorLevel);
      default:
        return {
          success: false,
          roomType: config.type,
          position: roomLocation.position,
          size: roomLocation.size,
          entities: [],
          message: 'Unknown room type'
        };
    }
  }

  /**
   * Generate monster house
   */
  private generateMonsterHouse(
    location: { position: Position; size: { width: number; height: number } },
    floorLevel: number
  ): RoomGenerationResult {
    const entities: GameEntity[] = [];
    const monsterCount = Math.floor(this.rng() * 8) + 5; // 5-12 monsters

    // Generate monsters
    for (let i = 0; i < monsterCount; i++) {
      const monsterPos = this.getRandomPositionInRoom(location.position, location.size);
      if (monsterPos) {
        const monster = this.createRandomMonster(monsterPos, floorLevel);
        if (monster) {
          entities.push(monster);
          // Try to add to dungeon, but don't fail if position is not walkable
          try {
            this.dungeonManager.addEntity(monster, monsterPos);
          } catch (error) {
            // Position might not be walkable, but we still count the monster as generated
          }
        }
      }
    }

    return {
      success: true,
      roomType: 'monster-house',
      position: location.position,
      size: location.size,
      entities,
      message: `Monster House generated with ${entities.length} monsters`
    };
  }

  /**
   * Generate shop
   */
  private generateShop(
    location: { position: Position; size: { width: number; height: number } },
    floorLevel: number
  ): RoomGenerationResult {
    const entities: GameEntity[] = [];
    const shopItems: ShopItem[] = [];
    const itemCount = Math.floor(this.rng() * 6) + 4; // 4-9 items

    // Generate shop items
    for (let i = 0; i < itemCount; i++) {
      const itemPos = this.getRandomPositionInRoom(location.position, location.size);
      if (itemPos) {
        const item = this.createRandomShopItem(itemPos, floorLevel);
        if (item) {
          const price = this.calculateItemPrice(item, floorLevel);
          const shopItem: ShopItem = {
            item,
            price,
            position: itemPos
          };
          
          shopItems.push(shopItem);
          entities.push(item);
          
          // Try to add to dungeon, but don't fail if position is not walkable
          try {
            this.dungeonManager.addEntity(item, itemPos);
          } catch (error) {
            // Position might not be walkable, but we still count the item as generated
          }
        }
      }
    }

    // Store shop items for transaction handling
    const roomId = `shop-${location.position.x}-${location.position.y}`;
    this.shopItems.set(roomId, shopItems);

    return {
      success: true,
      roomType: 'shop',
      position: location.position,
      size: location.size,
      entities,
      message: `Shop generated with ${shopItems.length} items`
    };
  }

  /**
   * Generate treasure room
   */
  private generateTreasureRoom(
    location: { position: Position; size: { width: number; height: number } },
    floorLevel: number
  ): RoomGenerationResult {
    const entities: GameEntity[] = [];
    const itemCount = Math.floor(this.rng() * 4) + 3; // 3-6 items

    // Generate treasure items (higher quality)
    for (let i = 0; i < itemCount; i++) {
      const itemPos = this.getRandomPositionInRoom(location.position, location.size);
      if (itemPos) {
        const item = this.createRandomTreasureItem(itemPos, floorLevel);
        if (item) {
          entities.push(item);
          
          // Try to add to dungeon, but don't fail if position is not walkable
          try {
            this.dungeonManager.addEntity(item, itemPos);
          } catch (error) {
            // Position might not be walkable, but we still count the item as generated
          }
        }
      }
    }

    return {
      success: true,
      roomType: 'treasure-room',
      position: location.position,
      size: location.size,
      entities,
      message: `Treasure Room generated with ${entities.length} valuable items`
    };
  }

  /**
   * Handle shop transaction
   */
  buyFromShop(player: PlayerEntity, itemPosition: Position): ShopTransactionResult {
    // Find shop item at position
    let shopItem: ShopItem | undefined;
    let roomId: string | undefined;

    for (const [id, items] of this.shopItems.entries()) {
      const item = items.find(i => 
        i.position.x === itemPosition.x && i.position.y === itemPosition.y
      );
      if (item) {
        shopItem = item;
        roomId = id;
        break;
      }
    }

    if (!shopItem) {
      return {
        success: false,
        message: 'No shop item found at this position'
      };
    }

    // Check if player has enough gold
    const playerGold = (player as any).gold || 0;
    if (playerGold < shopItem.price) {
      return {
        success: false,
        item: shopItem.item,
        price: shopItem.price,
        message: `Not enough gold. Need ${shopItem.price}, have ${playerGold}`,
        playerGold
      };
    }

    // Process transaction
    (player as any).gold = playerGold - shopItem.price;
    
    // Add item to player inventory
    if (player.inventory.length < 20) { // Assuming max inventory size
      player.inventory.push(shopItem.item);
    }

    // Remove item from shop and dungeon
    if (roomId) {
      const shopItems = this.shopItems.get(roomId);
      if (shopItems) {
        const index = shopItems.indexOf(shopItem);
        if (index >= 0) {
          shopItems.splice(index, 1);
        }
      }
    }
    
    this.dungeonManager.removeEntity(shopItem.item);

    return {
      success: true,
      item: shopItem.item,
      price: shopItem.price,
      message: `Purchased ${shopItem.item.name} for ${shopItem.price} gold`,
      playerGold: (player as any).gold
    };
  }

  /**
   * Get shop item at position
   */
  getShopItemAt(position: Position): ShopItem | undefined {
    for (const items of this.shopItems.values()) {
      const item = items.find(i => 
        i.position.x === position.x && i.position.y === position.y
      );
      if (item) return item;
    }
    return undefined;
  }

  /**
   * Check if position is in a shop
   */
  isShopPosition(position: Position): boolean {
    return this.getShopItemAt(position) !== undefined;
  }

  /**
   * Find suitable room location
   */
  private findSuitableRoomLocation(
    dungeonWidth: number, 
    dungeonHeight: number
  ): { position: Position; size: { width: number; height: number } } | null {
    const attempts = 50;
    
    for (let i = 0; i < attempts; i++) {
      const width = Math.floor(this.rng() * 4) + 3; // 3-6 width (smaller rooms)
      const height = Math.floor(this.rng() * 4) + 3; // 3-6 height (smaller rooms)
      
      const x = Math.floor(this.rng() * (dungeonWidth - width - 2)) + 1;
      const y = Math.floor(this.rng() * (dungeonHeight - height - 2)) + 1;
      
      // Check if area has some walkable cells
      let walkableCount = 0;
      let totalCells = 0;
      
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          const pos = { x: x + dx, y: y + dy };
          const cell = this.dungeonManager.getCellAt(pos);
          if (cell) {
            totalCells++;
            if (this.dungeonManager.isWalkable(pos)) {
              walkableCount++;
            }
          }
        }
      }
      
      // Require at least 30% walkable area (more lenient)
      if (totalCells > 0 && walkableCount / totalCells >= 0.3) {
        return {
          position: { x, y },
          size: { width, height }
        };
      }
    }
    
    // Fallback: return a small area near player spawn
    return {
      position: { x: 5, y: 5 },
      size: { width: 3, height: 3 }
    };
  }

  /**
   * Get random position within room
   */
  private getRandomPositionInRoom(
    roomPos: Position, 
    roomSize: { width: number; height: number }
  ): Position | null {
    const attempts = 20;
    
    for (let i = 0; i < attempts; i++) {
      const x = roomPos.x + Math.floor(this.rng() * roomSize.width);
      const y = roomPos.y + Math.floor(this.rng() * roomSize.height);
      const pos = { x, y };
      
      if (this.dungeonManager.isWalkable(pos) && 
          this.dungeonManager.getEntitiesAt(pos).length === 0) {
        return pos;
      }
    }
    
    // Fallback: return any position in the room
    const x = roomPos.x + Math.floor(roomSize.width / 2);
    const y = roomPos.y + Math.floor(roomSize.height / 2);
    return { x, y };
  }

  /**
   * Create random monster for monster house
   */
  private createRandomMonster(position: Position, floorLevel: number): MonsterEntity | null {
    const monsterTypes = ['goblin', 'orc', 'skeleton', 'spider', 'rat'];
    const randomType = monsterTypes[Math.floor(this.rng() * monsterTypes.length)];
    
    const characterInfo = {
      name: randomType.charAt(0).toUpperCase() + randomType.slice(1),
      gender: 'other' as const,
      age: 0,
      height: 150,
      weight: 50,
      race: 'human' as const,
      class: 'unemployed' as const,
      stats: {
        STR: 5,
        DEX: 10,
        INT: 5,
        CON: 2,
        POW: 5,
        APP: 5,
        LUK: 5
      },
      features: []
    };
    
    const monster = new MonsterEntity(
      `monster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      characterInfo,
      'aggressive-hostile',
      position
    );
    
    // Scale monster stats based on floor level
    const levelMultiplier = 1 + (floorLevel - 1) * 0.1;
    monster.characterStats.hp.current = Math.floor(monster.characterStats.hp.current * levelMultiplier);
    monster.characterStats.hp.max = monster.characterStats.hp.current;
    monster.characterStats.level = Math.max(1, floorLevel);
    
    // Scale basic stats
    monster.characterInfo.stats.STR = Math.floor(monster.characterInfo.stats.STR * levelMultiplier);
    monster.characterInfo.stats.CON = Math.floor(monster.characterInfo.stats.CON * levelMultiplier);
    
    return monster;
  }

  /**
   * Create random shop item
   */
  private createRandomShopItem(position: Position, floorLevel: number): ItemEntity | null {
    const itemTypes = ['potion', 'scroll', 'weapon', 'armor', 'food'];
    const randomType = itemTypes[Math.floor(this.rng() * itemTypes.length)];
    
    const item = new ItemEntity(
      `shop-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      `${randomType.charAt(0).toUpperCase() + randomType.slice(1)} Lv${floorLevel}`,
      randomType as any,
      position
    );
    
    return item;
  }

  /**
   * Create random treasure item (higher quality)
   */
  private createRandomTreasureItem(position: Position, floorLevel: number): ItemEntity | null {
    const treasureTypes = ['weapon', 'armor', 'accessory', 'rare-scroll'];
    const randomType = treasureTypes[Math.floor(this.rng() * treasureTypes.length)];
    
    const item = new ItemEntity(
      `treasure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      `Rare ${randomType.charAt(0).toUpperCase() + randomType.slice(1)} +${floorLevel}`,
      randomType as any,
      position
    );
    
    return item;
  }

  /**
   * Calculate item price based on type and floor level
   */
  private calculateItemPrice(item: ItemEntity, floorLevel: number): number {
    const basePrices: Record<string, number> = {
      'potion': 50,
      'scroll': 100,
      'weapon': 200,
      'armor': 250,
      'accessory': 300,
      'food': 30
    };
    
    const itemTypeKey = (item as any).itemType || (item as any).type;
    const basePrice = basePrices[itemTypeKey] || 100;
    const levelMultiplier = 1 + (floorLevel - 1) * 0.2;
    
    return Math.floor(basePrice * levelMultiplier);
  }

  /**
   * Initialize room configurations
   */
  private initializeRoomConfigs(): void {
    // Monster House
    this.roomConfigs.set('monster-house', {
      id: 'monster-house',
      name: 'Monster House',
      type: 'monster-house',
      spawnChance: 0.15, // 15% chance
      minFloor: 2,
      maxFloor: 99,
      description: 'A room packed with dangerous monsters'
    });

    // Shop
    this.roomConfigs.set('shop', {
      id: 'shop',
      name: 'Shop',
      type: 'shop',
      spawnChance: 0.1, // 10% chance
      minFloor: 1,
      maxFloor: 99,
      description: 'A merchant selling various items'
    });

    // Treasure Room
    this.roomConfigs.set('treasure-room', {
      id: 'treasure-room',
      name: 'Treasure Room',
      type: 'treasure-room',
      spawnChance: 0.05, // 5% chance
      minFloor: 3,
      maxFloor: 99,
      description: 'A room filled with valuable treasures'
    });
  }

  /**
   * Get room configuration
   */
  getRoomConfig(roomType: SpecialRoomType): SpecialRoomConfig | undefined {
    return this.roomConfigs.get(roomType);
  }

  /**
   * Get all room configurations
   */
  getAllRoomConfigs(): Map<SpecialRoomType, SpecialRoomConfig> {
    return new Map(this.roomConfigs);
  }

  /**
   * Set custom RNG for testing
   */
  setRNG(rng: () => number): void {
    this.rng = rng;
  }

  /**
   * Clear all shop data
   */
  clearShopData(): void {
    this.shopItems.clear();
  }

  /**
   * Get shop statistics
   */
  getShopStats(): {
    totalShops: number;
    totalItems: number;
    averagePrice: number;
  } {
    let totalShops = this.shopItems.size;
    let totalItems = 0;
    let totalValue = 0;

    for (const items of this.shopItems.values()) {
      totalItems += items.length;
      totalValue += items.reduce((sum, item) => sum + item.price, 0);
    }

    return {
      totalShops,
      totalItems,
      averagePrice: totalItems > 0 ? Math.floor(totalValue / totalItems) : 0
    };
  }
}
