/**
 * Tests for Item entity
 */

import { describe, it, expect } from 'vitest';
import { ItemEntity } from '../Item';
import { Position } from '../../types/core';
import { ItemEffect, EquipmentStats } from '../../types/entities';

describe('ItemEntity', () => {
  const mockPosition: Position = { x: 1, y: 1 };

  it('should create an item with basic properties', () => {
    const item = new ItemEntity('item-1', 'Health Potion', 'consumable', mockPosition);
    
    expect(item.id).toBe('item-1');
    expect(item.name).toBe('Health Potion');
    expect(item.itemType).toBe('consumable');
    expect(item.position).toEqual(mockPosition);
    expect(item.identified).toBe(false);
    expect(item.cursed).toBe(false);
    expect(item.effects).toEqual([]);
    expect(item.durability).toBeUndefined();
    expect(item.equipmentStats).toBeUndefined();
    expect(item.attributes).toBeUndefined();
  });

  it('should create an identified item', () => {
    const item = new ItemEntity('item-1', 'Magic Sword', 'weapon-melee', mockPosition, true);
    
    expect(item.identified).toBe(true);
  });

  it('should create a cursed item', () => {
    const item = new ItemEntity('item-1', 'Cursed Ring', 'accessory', mockPosition, false, true);
    
    expect(item.cursed).toBe(true);
  });

  it('should manage item effects', () => {
    const item = new ItemEntity('item-1', 'Health Potion', 'consumable', mockPosition);
    const healEffect: ItemEffect = {
      type: 'heal',
      value: 20,
      description: 'Restores 20 HP'
    };
    
    expect(item.hasEffect('heal')).toBe(false);
    
    item.addEffect(healEffect);
    expect(item.hasEffect('heal')).toBe(true);
    expect(item.effects).toHaveLength(1);
    expect(item.getEffect('heal')).toBe(healEffect);
    
    item.removeEffect('heal');
    expect(item.hasEffect('heal')).toBe(false);
    expect(item.effects).toHaveLength(0);
    expect(item.getEffect('heal')).toBeUndefined();
  });

  it('should set equipment stats', () => {
    const item = new ItemEntity('item-1', 'Iron Sword', 'weapon-melee', mockPosition);
    const stats: EquipmentStats = {
      attackBonus: 10,
      defenseBonus: 2
    };
    
    item.setEquipmentStats(stats);
    expect(item.equipmentStats).toBe(stats);
  });

  it('should set item attributes', () => {
    const item = new ItemEntity('item-1', 'Fire Sword', 'weapon-melee', mockPosition);
    const attributes = {
      attackAttribute: 'fire',
      defenseAttributes: ['fire']
    };
    
    item.setAttributes(attributes);
    expect(item.attributes).toBe(attributes);
  });

  it('should manage durability', () => {
    const item = new ItemEntity('item-1', 'Iron Sword', 'weapon-melee', mockPosition);
    
    item.setDurability(10);
    expect(item.durability).toBe(10);
    
    expect(item.reduceDurability(3)).toBe(false); // Not broken
    expect(item.durability).toBe(7);
    
    expect(item.reduceDurability(7)).toBe(true); // Broken
    expect(item.durability).toBe(0);
    
    expect(item.reduceDurability(1)).toBe(true); // Still broken
    expect(item.durability).toBe(0);
  });

  it('should handle items without durability', () => {
    const item = new ItemEntity('item-1', 'Magic Ring', 'accessory', mockPosition);
    
    expect(item.reduceDurability(5)).toBe(false);
    expect(item.durability).toBeUndefined();
  });

  it('should identify items', () => {
    const item = new ItemEntity('item-1', 'Mystery Potion', 'consumable', mockPosition);
    
    expect(item.identified).toBe(false);
    
    item.identify();
    expect(item.identified).toBe(true);
  });

  it('should check item types correctly', () => {
    const weapon = new ItemEntity('weapon', 'Sword', 'weapon-melee', mockPosition);
    const rangedWeapon = new ItemEntity('bow', 'Bow', 'weapon-ranged', mockPosition);
    const armor = new ItemEntity('armor', 'Mail', 'armor', mockPosition);
    const accessory = new ItemEntity('ring', 'Ring', 'accessory', mockPosition);
    const consumable = new ItemEntity('potion', 'Potion', 'consumable', mockPosition);
    const misc = new ItemEntity('misc', 'Rock', 'misc', mockPosition);
    
    expect(weapon.isEquippable()).toBe(true);
    expect(weapon.isWeapon()).toBe(true);
    expect(weapon.isArmor()).toBe(false);
    expect(weapon.isAccessory()).toBe(false);
    expect(weapon.isConsumable()).toBe(false);
    
    expect(rangedWeapon.isEquippable()).toBe(true);
    expect(rangedWeapon.isWeapon()).toBe(true);
    
    expect(armor.isEquippable()).toBe(true);
    expect(armor.isArmor()).toBe(true);
    expect(armor.isWeapon()).toBe(false);
    
    expect(accessory.isEquippable()).toBe(true);
    expect(accessory.isAccessory()).toBe(true);
    
    expect(consumable.isEquippable()).toBe(false);
    expect(consumable.isConsumable()).toBe(true);
    
    expect(misc.isEquippable()).toBe(false);
    expect(misc.isConsumable()).toBe(false);
  });

  it('should return correct display names', () => {
    const identifiedPotion = new ItemEntity('potion1', 'Health Potion', 'consumable', mockPosition, true);
    const unidentifiedPotion = new ItemEntity('potion2', 'Health Potion', 'consumable', mockPosition, false);
    const unidentifiedWeapon = new ItemEntity('weapon1', 'Magic Sword', 'weapon-melee', mockPosition, false);
    const unidentifiedArmor = new ItemEntity('armor1', 'Dragon Mail', 'armor', mockPosition, false);
    
    expect(identifiedPotion.getDisplayName()).toBe('Health Potion');
    expect(unidentifiedPotion.getDisplayName()).toBe('Unknown Item');
    expect(unidentifiedWeapon.getDisplayName()).toBe('Unknown Weapon');
    expect(unidentifiedArmor.getDisplayName()).toBe('Unknown Armor');
  });

  it('should use consumable items', () => {
    const potion = new ItemEntity('potion', 'Health Potion', 'consumable', mockPosition, false);
    const healEffect: ItemEffect = {
      type: 'heal',
      value: 20,
      description: 'Restores 20 HP'
    };
    potion.addEffect(healEffect);
    
    const effects = potion.use();
    
    expect(effects).toHaveLength(1);
    expect(effects[0]).toBe(healEffect);
    expect(potion.identified).toBe(true); // Should be identified after use
  });

  it('should not use non-consumable items', () => {
    const weapon = new ItemEntity('weapon', 'Sword', 'weapon-melee', mockPosition);
    
    const effects = weapon.use();
    
    expect(effects).toEqual([]);
    expect(weapon.identified).toBe(false); // Should not be identified
  });
});