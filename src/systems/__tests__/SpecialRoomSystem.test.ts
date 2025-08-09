/**
 * Tests for SpecialRoomSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpecialRoomSystem } from '../SpecialRoomSystem';
import { DungeonManager } from '../../dungeon/DungeonManager';
import { PlayerEntity } from '../../entities/Player';

describe('SpecialRoomSystem', () => {
  let specialRoomSystem: SpecialRoomSystem;
  let dungeonManager: DungeonManager;
  let player: PlayerEntity;

  beforeEach(() => {
    dungeonManager = new DungeonManager();
    specialRoomSystem = new SpecialRoomSystem(dungeonManager);
    
    // Generate test dungeon
    const dungeon = dungeonManager.generateDungeon('basic-dungeon', 1, 12345);
    
    // Create player
    player = new PlayerEntity('player-1', 'Hero', dungeon.playerSpawn);
    (player as any).gold = 1000; // Give player some gold for shop tests
    
    dungeonManager.addEntity(player, player.position);
  });

  it('should initialize with room configurations', () => {
    const configs = specialRoomSystem.getAllRoomConfigs();
    
    expect(configs.size).toBe(3);
    expect(configs.has('monster-house')).toBe(true);
    expect(configs.has('shop')).toBe(true);
    expect(configs.has('treasure-room')).toBe(true);
  });

  it('should get room configuration by type', () => {
    const monsterHouseConfig = specialRoomSystem.getRoomConfig('monster-house');
    
    expect(monsterHouseConfig).toBeDefined();
    expect(monsterHouseConfig!.name).toBe('Monster House');
    expect(monsterHouseConfig!.type).toBe('monster-house');
    expect(monsterHouseConfig!.spawnChance).toBe(0.15);
  });

  it('should generate special rooms for floor level', () => {
    // Set RNG to guarantee room generation
    specialRoomSystem.setRNG(() => 0.01); // Very low value to trigger all rooms
    
    const results = specialRoomSystem.generateSpecialRooms(5);
    
    expect(results.length).toBeGreaterThan(0);
    
    for (const result of results) {
      expect(result.success).toBe(true);
      expect(['monster-house', 'shop', 'treasure-room']).toContain(result.roomType);
      expect(result.position).toBeDefined();
      expect(result.size).toBeDefined();
      expect(result.message).toBeDefined();
    }
  });

  it('should not generate rooms when spawn chance fails', () => {
    // Set RNG to fail all room generation
    specialRoomSystem.setRNG(() => 0.99); // High value to fail all spawn chances
    
    const results = specialRoomSystem.generateSpecialRooms(5);
    
    expect(results.length).toBe(0);
  });

  it('should generate monster house with monsters', () => {
    // Set RNG to guarantee monster house generation
    let callCount = 0;
    specialRoomSystem.setRNG(() => {
      callCount++;
      if (callCount === 1) return 0.01; // Trigger monster house
      if (callCount === 2) return 0.99; // Skip shop
      if (callCount === 3) return 0.99; // Skip treasure room
      return 0.5; // For other random operations
    });
    
    const results = specialRoomSystem.generateSpecialRooms(5);
    
    const monsterHouse = results.find(r => r.roomType === 'monster-house');
    expect(monsterHouse).toBeDefined();
    expect(monsterHouse!.success).toBe(true);
    expect(monsterHouse!.entities.length).toBeGreaterThan(0);
    expect(monsterHouse!.message).toContain('Monster House generated');
  });

  it('should generate shop with items', () => {
    // Set RNG to guarantee shop generation
    let callCount = 0;
    specialRoomSystem.setRNG(() => {
      callCount++;
      if (callCount === 1) return 0.99; // Skip monster house
      if (callCount === 2) return 0.01; // Trigger shop
      if (callCount === 3) return 0.99; // Skip treasure room
      return 0.5; // For other random operations
    });
    
    const results = specialRoomSystem.generateSpecialRooms(5);
    
    const shop = results.find(r => r.roomType === 'shop');
    expect(shop).toBeDefined();
    expect(shop!.success).toBe(true);
    expect(shop!.entities.length).toBeGreaterThan(0);
    expect(shop!.message).toContain('Shop generated');
  });

  it('should generate treasure room with items', () => {
    // Set RNG to guarantee treasure room generation
    let callCount = 0;
    specialRoomSystem.setRNG(() => {
      callCount++;
      if (callCount === 1) return 0.99; // Skip monster house
      if (callCount === 2) return 0.99; // Skip shop
      if (callCount === 3) return 0.01; // Trigger treasure room
      return 0.5; // For other random operations
    });
    
    const results = specialRoomSystem.generateSpecialRooms(5);
    
    const treasureRoom = results.find(r => r.roomType === 'treasure-room');
    expect(treasureRoom).toBeDefined();
    expect(treasureRoom!.success).toBe(true);
    expect(treasureRoom!.entities.length).toBeGreaterThan(0);
    expect(treasureRoom!.message).toContain('Treasure Room generated');
  });

  it('should handle shop transactions successfully', () => {
    // First generate a shop
    let callCount = 0;
    specialRoomSystem.setRNG(() => {
      callCount++;
      if (callCount === 1) return 0.99; // Skip monster house
      if (callCount === 2) return 0.01; // Trigger shop
      if (callCount === 3) return 0.99; // Skip treasure room
      return 0.5; // For other random operations
    });
    
    const results = specialRoomSystem.generateSpecialRooms(5);
    const shop = results.find(r => r.roomType === 'shop');
    
    expect(shop).toBeDefined();
    expect(shop!.entities.length).toBeGreaterThan(0);
    
    // Try to buy an item
    const itemPosition = shop!.entities[0].position;
    const shopItem = specialRoomSystem.getShopItemAt(itemPosition);
    
    expect(shopItem).toBeDefined();
    expect(shopItem!.price).toBeGreaterThan(0);
    
    const originalGold = (player as any).gold;
    const transaction = specialRoomSystem.buyFromShop(player, itemPosition);
    
    expect(transaction.success).toBe(true);
    expect(transaction.item).toBeDefined();
    expect(transaction.price).toBe(shopItem!.price);
    expect(transaction.playerGold).toBe(originalGold - shopItem!.price);
    expect(player.inventory.length).toBeGreaterThan(0);
  });

  it('should fail shop transaction when player has insufficient gold', () => {
    // Set player gold to 0
    (player as any).gold = 0;
    
    // Generate a shop
    let callCount = 0;
    specialRoomSystem.setRNG(() => {
      callCount++;
      if (callCount === 1) return 0.99; // Skip monster house
      if (callCount === 2) return 0.01; // Trigger shop
      if (callCount === 3) return 0.99; // Skip treasure room
      return 0.5; // For other random operations
    });
    
    const results = specialRoomSystem.generateSpecialRooms(5);
    const shop = results.find(r => r.roomType === 'shop');
    
    expect(shop).toBeDefined();
    
    const itemPosition = shop!.entities[0].position;
    const transaction = specialRoomSystem.buyFromShop(player, itemPosition);
    
    expect(transaction.success).toBe(false);
    expect(transaction.message).toContain('Not enough gold');
    expect(transaction.playerGold).toBe(0);
  });

  it('should fail shop transaction for non-existent item', () => {
    const nonExistentPosition = { x: 999, y: 999 };
    const transaction = specialRoomSystem.buyFromShop(player, nonExistentPosition);
    
    expect(transaction.success).toBe(false);
    expect(transaction.message).toContain('No shop item found');
  });

  it('should identify shop positions correctly', () => {
    // Generate a shop
    let callCount = 0;
    specialRoomSystem.setRNG(() => {
      callCount++;
      if (callCount === 1) return 0.99; // Skip monster house
      if (callCount === 2) return 0.01; // Trigger shop
      if (callCount === 3) return 0.99; // Skip treasure room
      return 0.5; // For other random operations
    });
    
    const results = specialRoomSystem.generateSpecialRooms(5);
    const shop = results.find(r => r.roomType === 'shop');
    
    expect(shop).toBeDefined();
    
    const itemPosition = shop!.entities[0].position;
    expect(specialRoomSystem.isShopPosition(itemPosition)).toBe(true);
    
    const nonShopPosition = { x: 999, y: 999 };
    expect(specialRoomSystem.isShopPosition(nonShopPosition)).toBe(false);
  });

  it('should respect floor level restrictions', () => {
    // Test floor 1 (should only allow shop)
    specialRoomSystem.setRNG(() => 0.01); // Guarantee generation
    
    const floor1Results = specialRoomSystem.generateSpecialRooms(1);
    const floor1Types = floor1Results.map(r => r.roomType);
    
    expect(floor1Types).toContain('shop');
    expect(floor1Types).not.toContain('monster-house'); // minFloor: 2
    expect(floor1Types).not.toContain('treasure-room'); // minFloor: 3
    
    // Test floor 5 (should allow all)
    const floor5Results = specialRoomSystem.generateSpecialRooms(5);
    const floor5Types = floor5Results.map(r => r.roomType);
    
    // All room types should be possible at floor 5
    expect(['monster-house', 'shop', 'treasure-room']).toEqual(
      expect.arrayContaining(floor5Types)
    );
  });

  it('should clear shop data', () => {
    // Generate a shop first
    let callCount = 0;
    specialRoomSystem.setRNG(() => {
      callCount++;
      if (callCount === 1) return 0.99; // Skip monster house
      if (callCount === 2) return 0.01; // Trigger shop
      if (callCount === 3) return 0.99; // Skip treasure room
      return 0.5; // For other random operations
    });
    
    specialRoomSystem.generateSpecialRooms(5);
    
    let stats = specialRoomSystem.getShopStats();
    expect(stats.totalShops).toBeGreaterThan(0);
    
    specialRoomSystem.clearShopData();
    
    stats = specialRoomSystem.getShopStats();
    expect(stats.totalShops).toBe(0);
    expect(stats.totalItems).toBe(0);
  });

  it('should provide shop statistics', () => {
    // Generate a shop
    let callCount = 0;
    specialRoomSystem.setRNG(() => {
      callCount++;
      if (callCount === 1) return 0.99; // Skip monster house
      if (callCount === 2) return 0.01; // Trigger shop
      if (callCount === 3) return 0.99; // Skip treasure room
      return 0.5; // For other random operations
    });
    
    const results = specialRoomSystem.generateSpecialRooms(5);
    const shop = results.find(r => r.roomType === 'shop');
    
    expect(shop).toBeDefined();
    
    const stats = specialRoomSystem.getShopStats();
    
    expect(stats.totalShops).toBe(1);
    expect(stats.totalItems).toBe(shop!.entities.length);
    expect(stats.averagePrice).toBeGreaterThan(0);
  });

  it('should handle empty shop statistics', () => {
    const stats = specialRoomSystem.getShopStats();
    
    expect(stats.totalShops).toBe(0);
    expect(stats.totalItems).toBe(0);
    expect(stats.averagePrice).toBe(0);
  });

  it('should scale monster stats based on floor level', () => {
    // Generate monster house on higher floor
    let callCount = 0;
    specialRoomSystem.setRNG(() => {
      callCount++;
      if (callCount === 1) return 0.01; // Trigger monster house
      if (callCount === 2) return 0.99; // Skip shop
      if (callCount === 3) return 0.99; // Skip treasure room
      return 0.5; // For other random operations
    });
    
    const results = specialRoomSystem.generateSpecialRooms(10); // High floor level
    const monsterHouse = results.find(r => r.roomType === 'monster-house');
    
    expect(monsterHouse).toBeDefined();
    expect(monsterHouse!.entities.length).toBeGreaterThan(0);
    
    // Check that monsters have scaled stats
    const monster = monsterHouse!.entities[0] as any;
    expect(monster.stats.level).toBeGreaterThanOrEqual(10);
    expect(monster.stats.hp).toBeGreaterThan(10); // Should be scaled up
  });

  it('should calculate item prices based on type and floor level', () => {
    // Generate shop on higher floor
    let callCount = 0;
    specialRoomSystem.setRNG(() => {
      callCount++;
      if (callCount === 1) return 0.99; // Skip monster house
      if (callCount === 2) return 0.01; // Trigger shop
      if (callCount === 3) return 0.99; // Skip treasure room
      return 0.5; // For other random operations
    });
    
    const results = specialRoomSystem.generateSpecialRooms(10); // High floor level
    const shop = results.find(r => r.roomType === 'shop');
    
    expect(shop).toBeDefined();
    
    const itemPosition = shop!.entities[0].position;
    const shopItem = specialRoomSystem.getShopItemAt(itemPosition);
    
    expect(shopItem).toBeDefined();
    expect(shopItem!.price).toBeGreaterThan(50); // Should be higher than base price
  });

  it('should handle dungeon without current dungeon', () => {
    const emptyDungeonManager = new DungeonManager();
    const emptyRoomSystem = new SpecialRoomSystem(emptyDungeonManager);
    
    const results = emptyRoomSystem.generateSpecialRooms(5);
    
    expect(results.length).toBe(0);
  });
});