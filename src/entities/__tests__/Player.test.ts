/**
 * Tests for Player entity
 */

import { describe, it, expect } from 'vitest';
import { PlayerEntity } from '../Player';
import { ItemEntity } from '../Item';
import { Position } from '../../types/core';
import { StatusEffect } from '../../types/entities';

describe('PlayerEntity', () => {
  const mockPosition: Position = { x: 5, y: 10 };

  it('should create a player with default stats', () => {
    const player = new PlayerEntity('player-1', 'Hero', mockPosition);
    
    expect(player.id).toBe('player-1');
    expect(player.name).toBe('Hero');
    expect(player.position).toEqual(mockPosition);
    expect(player.stats.level).toBe(1);
    expect(player.stats.hp).toBe(30);
    expect(player.stats.maxHp).toBe(30);
    expect(player.stats.attack).toBe(8);
    expect(player.stats.defense).toBe(5);
    expect(player.hunger).toBe(100);
    expect(player.maxHunger).toBe(100);
    expect(player.inventory).toEqual([]);
    expect(player.equipment).toEqual({});
    expect(player.statusEffects).toEqual([]);
  });

  it('should manage inventory', () => {
    const player = new PlayerEntity('player-1', 'Hero', mockPosition);
    const item = new ItemEntity('item-1', 'Health Potion', 'consumable', { x: 0, y: 0 });
    
    expect(player.addToInventory(item)).toBe(true);
    expect(player.inventory).toHaveLength(1);
    expect(player.inventory[0]).toBe(item);
    
    const removedItem = player.removeFromInventory('item-1');
    expect(removedItem).toBe(item);
    expect(player.inventory).toHaveLength(0);
    
    const notFound = player.removeFromInventory('non-existent');
    expect(notFound).toBeUndefined();
  });

  it('should equip and unequip items', () => {
    const player = new PlayerEntity('player-1', 'Hero', mockPosition);
    const weapon = new ItemEntity('weapon-1', 'Iron Sword', 'weapon-melee', { x: 0, y: 0 });
    weapon.setEquipmentStats({ attackBonus: 5, defenseBonus: 0 });
    
    // Add weapon to inventory first
    player.addToInventory(weapon);
    
    expect(player.equipItem(weapon)).toBe(true);
    expect(player.equipment.weapon).toBe(weapon);
    expect(player.inventory).toHaveLength(0); // Removed from inventory
    
    expect(player.unequipItem('weapon')).toBe(true);
    expect(player.equipment.weapon).toBeUndefined();
    expect(player.inventory).toHaveLength(1); // Back in inventory
  });

  it('should not unequip cursed items', () => {
    const player = new PlayerEntity('player-1', 'Hero', mockPosition);
    const cursedWeapon = new ItemEntity('cursed-weapon', 'Cursed Blade', 'weapon-melee', { x: 0, y: 0 });
    cursedWeapon.cursed = true;
    cursedWeapon.setEquipmentStats({ attackBonus: 10, defenseBonus: 0 });
    
    player.addToInventory(cursedWeapon);
    player.equipItem(cursedWeapon);
    
    expect(player.unequipItem('weapon')).toBe(false);
    expect(player.equipment.weapon).toBe(cursedWeapon);
  });

  it('should manage status effects', () => {
    const player = new PlayerEntity('player-1', 'Hero', mockPosition);
    const poisonEffect: StatusEffect = {
      type: 'poison',
      turnsElapsed: 0,
      intensity: 5,
      source: 'poison-trap'
    };
    
    expect(player.hasStatusEffect('poison')).toBe(false);
    
    player.addStatusEffect(poisonEffect);
    expect(player.hasStatusEffect('poison')).toBe(true);
    expect(player.statusEffects).toHaveLength(1);
    
    player.removeStatusEffect('poison');
    expect(player.hasStatusEffect('poison')).toBe(false);
    expect(player.statusEffects).toHaveLength(0);
  });

  it('should manage hunger', () => {
    const player = new PlayerEntity('player-1', 'Hero', mockPosition);
    
    expect(player.isHungry()).toBe(false);
    
    player.updateHunger(-50);
    expect(player.hunger).toBe(50);
    expect(player.isHungry()).toBe(false);
    
    player.updateHunger(-60);
    expect(player.hunger).toBe(0); // Clamped to 0
    expect(player.isHungry()).toBe(true);
    
    player.updateHunger(30);
    expect(player.hunger).toBe(30);
    expect(player.isHungry()).toBe(false);
    
    player.updateHunger(100);
    expect(player.hunger).toBe(100); // Clamped to max
  });

  it('should not equip non-equippable items', () => {
    const player = new PlayerEntity('player-1', 'Hero', mockPosition);
    const potion = new ItemEntity('potion-1', 'Health Potion', 'consumable', { x: 0, y: 0 });
    
    player.addToInventory(potion);
    
    expect(player.equipItem(potion)).toBe(false);
    expect(player.equipment.weapon).toBeUndefined();
    expect(player.inventory).toHaveLength(1); // Still in inventory
  });
});