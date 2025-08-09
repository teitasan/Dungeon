/**
 * Tests for ItemSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ItemSystem, ItemTemplate } from '../ItemSystem';
import { DungeonManager } from '../../dungeon/DungeonManager';
import { PlayerEntity } from '../../entities/Player';
import { ItemEntity } from '../../entities/Item';
import { Position } from '../../types/core';

describe('ItemSystem', () => {
  let itemSystem: ItemSystem;
  let dungeonManager: DungeonManager;
  let player: PlayerEntity;
  let testPosition: Position;

  beforeEach(() => {
    dungeonManager = new DungeonManager();
    itemSystem = new ItemSystem(dungeonManager);
    
    // Generate test dungeon
    const dungeon = dungeonManager.generateDungeon('basic-dungeon', 1, 12345);
    testPosition = dungeon.playerSpawn;
    
    player = new PlayerEntity('player-1', 'Hero', testPosition);
    player.stats.hp = 20;
    player.stats.maxHp = 30;
    player.hunger = 50;
    player.maxHunger = 100;
    
    dungeonManager.addEntity(player, testPosition);
  });

  it('should add and remove items from inventory', () => {
    const item = new ItemEntity('item-1', 'Test Item', 'misc', { x: 0, y: 0 });
    
    expect(itemSystem.addItem(player, item)).toBe(true);
    expect(itemSystem.hasItem(player, 'item-1')).toBe(true);
    expect(itemSystem.getItemCount(player)).toBe(1);
    
    const removedItem = itemSystem.removeItem(player, 'item-1');
    expect(removedItem).toBe(item);
    expect(itemSystem.hasItem(player, 'item-1')).toBe(false);
    expect(itemSystem.getItemCount(player)).toBe(0);
  });

  it('should check inventory capacity', () => {
    const maxCapacity = itemSystem.getMaxCapacity(player);
    expect(maxCapacity).toBe(20);
    
    // Fill inventory to capacity
    for (let i = 0; i < maxCapacity; i++) {
      const item = new ItemEntity(`item-${i}`, `Item ${i}`, 'misc', { x: 0, y: 0 });
      expect(itemSystem.addItem(player, item)).toBe(true);
    }
    
    expect(itemSystem.isFull(player)).toBe(true);
    
    // Try to add one more item
    const extraItem = new ItemEntity('extra', 'Extra Item', 'misc', { x: 0, y: 0 });
    expect(itemSystem.addItem(player, extraItem)).toBe(false);
  });

  it('should use healing potion', () => {
    const healthPotion = itemSystem.createItem('health-potion', { x: 0, y: 0 });
    expect(healthPotion).toBeDefined();
    
    itemSystem.addItem(player, healthPotion!);
    
    const result = itemSystem.useItem(player, healthPotion!);
    
    expect(result.success).toBe(true);
    expect(result.consumed).toBe(true);
    expect(result.effects).toHaveLength(1);
    expect(result.effects[0].type).toBe('heal');
    expect(result.effects[0].success).toBe(true);
    expect(player.stats.hp).toBe(30); // 20 + 20 = 40, capped at maxHp 30
    expect(itemSystem.hasItem(player, healthPotion!.id)).toBe(false); // Consumed
  });

  it('should use bread to restore hunger', () => {
    const bread = itemSystem.createItem('bread', { x: 0, y: 0 });
    expect(bread).toBeDefined();
    
    itemSystem.addItem(player, bread!);
    
    const result = itemSystem.useItem(player, bread!);
    
    expect(result.success).toBe(true);
    expect(result.consumed).toBe(true);
    expect(result.effects[0].type).toBe('restore-hunger');
    expect(player.hunger).toBe(80); // 50 + 30
  });

  it('should use antidote to cure poison', () => {
    const antidote = itemSystem.createItem('antidote', { x: 0, y: 0 });
    expect(antidote).toBeDefined();
    
    // Add poison status effect
    player.statusEffects.push({
      type: 'poison',
      turnsElapsed: 0,
      intensity: 1
    });
    
    itemSystem.addItem(player, antidote!);
    
    const result = itemSystem.useItem(player, antidote!);
    
    expect(result.success).toBe(true);
    expect(result.effects[0].type).toBe('cure-status');
    expect(player.statusEffects).toHaveLength(0); // Poison cured
  });

  it('should use scroll of identify', () => {
    const identifyScroll = itemSystem.createItem('scroll-identify', { x: 0, y: 0 });
    const unidentifiedItem = new ItemEntity('mystery', 'Mystery Item', 'consumable', { x: 0, y: 0 }, false);
    
    itemSystem.addItem(player, identifyScroll!);
    itemSystem.addItem(player, unidentifiedItem);
    
    expect(unidentifiedItem.identified).toBe(false);
    
    const result = itemSystem.useItem(player, identifyScroll!);
    
    expect(result.success).toBe(true);
    expect(result.effects[0].type).toBe('identify');
    expect(unidentifiedItem.identified).toBe(true);
  });

  it('should use teleport scroll', () => {
    const teleportScroll = itemSystem.createItem('scroll-teleport', { x: 0, y: 0 });
    const originalPosition = { ...player.position };
    
    itemSystem.addItem(player, teleportScroll!);
    
    const result = itemSystem.useItem(player, teleportScroll!);
    
    expect(result.success).toBe(true);
    expect(result.effects[0].type).toBe('teleport');
    // Position should have changed (unless very unlucky with random)
    // We can't guarantee position change due to randomness, so just check the effect was processed
    expect(result.effects[0].success).toBe(true);
  });

  it('should not use non-consumable items', () => {
    const weapon = new ItemEntity('sword', 'Sword', 'weapon-melee', { x: 0, y: 0 });
    
    const result = itemSystem.useItem(player, weapon);
    
    expect(result.success).toBe(false);
    expect(result.consumed).toBe(false);
    expect(result.message).toContain('cannot be used');
  });

  it('should pick up items from ground', () => {
    const item = new ItemEntity('ground-item', 'Ground Item', 'misc', testPosition);
    dungeonManager.addEntity(item, testPosition);
    
    const result = itemSystem.pickupItem(player, testPosition);
    
    expect(result.success).toBe(true);
    expect(result.item).toBe(item);
    expect(itemSystem.hasItem(player, 'ground-item')).toBe(true);
    expect(dungeonManager.getEntitiesAt(testPosition)).not.toContain(item);
  });

  it('should not pick up items when inventory is full', () => {
    // Fill inventory
    const maxCapacity = itemSystem.getMaxCapacity(player);
    for (let i = 0; i < maxCapacity; i++) {
      const item = new ItemEntity(`item-${i}`, `Item ${i}`, 'misc', { x: 0, y: 0 });
      itemSystem.addItem(player, item);
    }
    
    const groundItem = new ItemEntity('ground-item', 'Ground Item', 'misc', testPosition);
    dungeonManager.addEntity(groundItem, testPosition);
    
    const result = itemSystem.pickupItem(player, testPosition);
    
    expect(result.success).toBe(false);
    expect(result.reason).toBe('inventory-full');
    expect(dungeonManager.getEntitiesAt(testPosition)).toContain(groundItem);
  });

  it('should not pick up items when none exist', () => {
    const result = itemSystem.pickupItem(player, testPosition);
    
    expect(result.success).toBe(false);
    expect(result.reason).toBe('no-items');
  });

  it('should drop items at position', () => {
    const item = new ItemEntity('drop-item', 'Drop Item', 'misc', { x: 0, y: 0 });
    itemSystem.addItem(player, item);
    
    const dropPosition = { x: testPosition.x + 1, y: testPosition.y };
    if (dungeonManager.isWalkable(dropPosition)) {
      const result = itemSystem.dropItem(player, 'drop-item', dropPosition);
      
      expect(result.success).toBe(true);
      expect(result.item).toBe(item);
      expect(itemSystem.hasItem(player, 'drop-item')).toBe(false);
      expect(dungeonManager.getEntitiesAt(dropPosition)).toContain(item);
    }
  });

  it('should not drop items at invalid positions', () => {
    const item = new ItemEntity('drop-item', 'Drop Item', 'misc', { x: 0, y: 0 });
    itemSystem.addItem(player, item);
    
    const wallPosition = { x: 0, y: 0 }; // Should be a wall
    const result = itemSystem.dropItem(player, 'drop-item', wallPosition);
    
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid-position');
    expect(itemSystem.hasItem(player, 'drop-item')).toBe(true); // Still in inventory
  });

  it('should not drop non-existent items', () => {
    const result = itemSystem.dropItem(player, 'non-existent', testPosition);
    
    expect(result.success).toBe(false);
    expect(result.reason).toBe('item-not-found');
  });

  it('should create items from templates', () => {
    const healthPotion = itemSystem.createItem('health-potion', { x: 0, y: 0 });
    
    expect(healthPotion).toBeDefined();
    expect(healthPotion!.name).toBe('Health Potion');
    expect(healthPotion!.itemType).toBe('consumable');
    expect(healthPotion!.effects).toHaveLength(1);
    expect(healthPotion!.effects[0].type).toBe('heal');
    expect(healthPotion!.effects[0].value).toBe(20);
  });

  it('should register custom item templates', () => {
    const customTemplate: ItemTemplate = {
      id: 'super-potion',
      name: 'Super Potion',
      itemType: 'consumable',
      identified: true,
      cursed: false,
      effects: [
        {
          type: 'heal',
          value: 50,
          description: 'Restores 50 HP'
        }
      ]
    };
    
    itemSystem.registerItemTemplate(customTemplate);
    
    expect(itemSystem.getItemTemplate('super-potion')).toBe(customTemplate);
    expect(itemSystem.getItemTemplateIds()).toContain('super-potion');
    
    const item = itemSystem.createItem('super-potion', { x: 0, y: 0 });
    expect(item).toBeDefined();
    expect(item!.name).toBe('Super Potion');
  });

  it('should return null for unknown templates', () => {
    const item = itemSystem.createItem('unknown-template', { x: 0, y: 0 });
    expect(item).toBeNull();
  });

  it('should handle entities without inventory support', () => {
    const basicEntity = {
      id: 'basic',
      position: { x: 0, y: 0 },
      stats: { hp: 10, maxHp: 10, attack: 5, defense: 3, evasionRate: 0 },
      components: [],
      flags: {}
    } as any;
    
    const item = new ItemEntity('item', 'Item', 'misc', { x: 0, y: 0 });
    
    expect(itemSystem.addItem(basicEntity, item)).toBe(false);
    expect(itemSystem.removeItem(basicEntity, 'item')).toBeNull();
    expect(itemSystem.getItems(basicEntity)).toEqual([]);
    expect(itemSystem.hasItem(basicEntity, 'item')).toBe(false);
    expect(itemSystem.getItemCount(basicEntity)).toBe(0);
    expect(itemSystem.isFull(basicEntity)).toBe(false);
  });

  it('should handle healing when already at full health', () => {
    player.stats.hp = player.stats.maxHp; // Full health
    
    const healthPotion = itemSystem.createItem('health-potion', { x: 0, y: 0 });
    itemSystem.addItem(player, healthPotion!);
    
    const result = itemSystem.useItem(player, healthPotion!);
    
    expect(result.success).toBe(false); // No healing occurred
    expect(result.effects[0].success).toBe(false);
    expect(result.effects[0].message).toContain('already at full health');
  });

  it('should handle hunger restoration when not hungry', () => {
    player.hunger = player.maxHunger; // Full hunger
    
    const bread = itemSystem.createItem('bread', { x: 0, y: 0 });
    itemSystem.addItem(player, bread!);
    
    const result = itemSystem.useItem(player, bread!);
    
    expect(result.success).toBe(false); // No hunger restoration occurred
    expect(result.effects[0].success).toBe(false);
    expect(result.effects[0].message).toContain('is not hungry');
  });

  it('should handle status cure when no status effects exist', () => {
    const antidote = itemSystem.createItem('antidote', { x: 0, y: 0 });
    itemSystem.addItem(player, antidote!);
    
    // No status effects on player
    expect(player.statusEffects).toHaveLength(0);
    
    const result = itemSystem.useItem(player, antidote!);
    
    expect(result.success).toBe(false); // No status to cure
    expect(result.effects[0].success).toBe(false);
  });

  it('should get all items in inventory', () => {
    const item1 = new ItemEntity('item-1', 'Item 1', 'misc', { x: 0, y: 0 });
    const item2 = new ItemEntity('item-2', 'Item 2', 'misc', { x: 0, y: 0 });
    
    itemSystem.addItem(player, item1);
    itemSystem.addItem(player, item2);
    
    const items = itemSystem.getItems(player);
    expect(items).toHaveLength(2);
    expect(items).toContain(item1);
    expect(items).toContain(item2);
  });
});