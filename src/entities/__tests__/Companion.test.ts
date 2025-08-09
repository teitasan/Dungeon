/**
 * Tests for Companion entity
 */

import { describe, it, expect } from 'vitest';
import { CompanionEntity } from '../Companion';
import { ItemEntity } from '../Item';
import { Position } from '../../types/core';
import { StatusEffect } from '../../types/entities';

describe('CompanionEntity', () => {
  const mockPosition: Position = { x: 2, y: 8 };

  it('should create a companion with default stats', () => {
    const companion = new CompanionEntity('companion-1', 'Ally', 'warrior', mockPosition);
    
    expect(companion.id).toBe('companion-1');
    expect(companion.name).toBe('Ally');
    expect(companion.companionType).toBe('warrior');
    expect(companion.position).toEqual(mockPosition);
    expect(companion.stats.level).toBe(1);
    expect(companion.stats.hp).toBe(25);
    expect(companion.stats.maxHp).toBe(25);
    expect(companion.stats.attack).toBe(7);
    expect(companion.stats.defense).toBe(4);
    expect(companion.aiType).toBe('companion-follow');
    expect(companion.behaviorMode).toBe('follow');
    expect(companion.equipment).toEqual({});
    expect(companion.statusEffects).toEqual([]);
  });

  it('should manage behavior modes', () => {
    const companion = new CompanionEntity('companion-1', 'Ally', 'warrior', mockPosition);
    
    expect(companion.isFollowing()).toBe(true);
    expect(companion.isInCombat()).toBe(false);
    
    companion.setBehaviorMode('attack');
    expect(companion.behaviorMode).toBe('attack');
    expect(companion.isFollowing()).toBe(false);
    expect(companion.isInCombat()).toBe(true);
    
    companion.setBehaviorMode('defend');
    expect(companion.behaviorMode).toBe('defend');
    expect(companion.isFollowing()).toBe(false);
    expect(companion.isInCombat()).toBe(false);
  });

  it('should equip and unequip items', () => {
    const companion = new CompanionEntity('companion-1', 'Ally', 'warrior', mockPosition);
    const weapon = new ItemEntity('weapon-1', 'Steel Sword', 'weapon-melee', { x: 0, y: 0 });
    weapon.setEquipmentStats({ attackBonus: 8, defenseBonus: 1 });
    
    expect(companion.equipItem(weapon)).toBe(true);
    expect(companion.equipment.weapon).toBe(weapon);
    
    const unequippedWeapon = companion.unequipItem('weapon');
    expect(unequippedWeapon).toBe(weapon);
    expect(companion.equipment.weapon).toBeUndefined();
  });

  it('should not unequip cursed items', () => {
    const companion = new CompanionEntity('companion-1', 'Ally', 'warrior', mockPosition);
    const cursedArmor = new ItemEntity('cursed-armor', 'Cursed Mail', 'armor', { x: 0, y: 0 });
    cursedArmor.cursed = true;
    cursedArmor.setEquipmentStats({ attackBonus: 0, defenseBonus: 15 });
    
    companion.equipItem(cursedArmor);
    
    const result = companion.unequipItem('armor');
    expect(result).toBeUndefined();
    expect(companion.equipment.armor).toBe(cursedArmor);
  });

  it('should manage status effects', () => {
    const companion = new CompanionEntity('companion-1', 'Ally', 'warrior', mockPosition);
    const paralysisEffect: StatusEffect = {
      type: 'paralysis',
      turnsElapsed: 0,
      source: 'paralysis-spell'
    };
    
    expect(companion.hasStatusEffect('paralysis')).toBe(false);
    
    companion.addStatusEffect(paralysisEffect);
    expect(companion.hasStatusEffect('paralysis')).toBe(true);
    expect(companion.statusEffects).toHaveLength(1);
    
    companion.removeStatusEffect('paralysis');
    expect(companion.hasStatusEffect('paralysis')).toBe(false);
    expect(companion.statusEffects).toHaveLength(0);
  });

  it('should manage AI type', () => {
    const companion = new CompanionEntity('companion-1', 'Ally', 'warrior', mockPosition);
    
    expect(companion.aiType).toBe('companion-follow');
    
    companion.setAIType('companion-aggressive');
    expect(companion.aiType).toBe('companion-aggressive');
  });

  it('should return experience value', () => {
    const companion = new CompanionEntity('companion-1', 'Ally', 'warrior', mockPosition);
    
    expect(companion.getExperienceValue()).toBe(10); // level 1 * 10
    
    companion.stats.level = 3;
    companion.stats.experienceValue = 30;
    expect(companion.getExperienceValue()).toBe(30);
  });

  it('should not equip non-equippable items', () => {
    const companion = new CompanionEntity('companion-1', 'Ally', 'warrior', mockPosition);
    const misc = new ItemEntity('misc-1', 'Strange Rock', 'misc', { x: 0, y: 0 });
    
    expect(companion.equipItem(misc)).toBe(false);
    expect(companion.equipment.weapon).toBeUndefined();
  });
});