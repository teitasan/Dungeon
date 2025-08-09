/**
 * Tests for Monster entity
 */

import { describe, it, expect } from 'vitest';
import { MonsterEntity } from '../Monster';
import { Position } from '../../types/core';
import { StatusEffect, DropTableEntry } from '../../types/entities';

describe('MonsterEntity', () => {
  const mockPosition: Position = { x: 3, y: 7 };

  it('should create a monster with default stats', () => {
    const monster = new MonsterEntity('monster-1', 'Goblin', 'basic-enemy', mockPosition);
    
    expect(monster.id).toBe('monster-1');
    expect(monster.name).toBe('Goblin');
    expect(monster.monsterType).toBe('basic-enemy');
    expect(monster.position).toEqual(mockPosition);
    expect(monster.stats.level).toBe(1);
    expect(monster.stats.hp).toBe(15);
    expect(monster.stats.maxHp).toBe(15);
    expect(monster.stats.attack).toBe(6);
    expect(monster.stats.defense).toBe(2);
    expect(monster.aiType).toBe('basic-hostile');
    expect(monster.dropTable).toEqual([]);
    expect(monster.spawnWeight).toBe(1.0);
    expect(monster.spawnConditions).toEqual([]);
    expect(monster.statusEffects).toEqual([]);
  });

  it('should manage drop table', () => {
    const monster = new MonsterEntity('monster-1', 'Goblin', 'basic-enemy', mockPosition);
    const dropEntry: DropTableEntry = {
      itemId: 'health-potion',
      weight: 0.3,
      quantity: { min: 1, max: 1 }
    };
    
    monster.addDropTableEntry(dropEntry);
    expect(monster.dropTable).toHaveLength(1);
    expect(monster.dropTable[0]).toBe(dropEntry);
    expect(monster.getTotalDropWeight()).toBe(0.3);
    
    const dropEntry2: DropTableEntry = {
      itemId: 'gold-coin',
      weight: 0.7,
      quantity: { min: 1, max: 3 }
    };
    
    monster.addDropTableEntry(dropEntry2);
    expect(monster.getTotalDropWeight()).toBe(1.0);
    
    monster.removeDropTableEntry('health-potion');
    expect(monster.dropTable).toHaveLength(1);
    expect(monster.getTotalDropWeight()).toBe(0.7);
  });

  it('should manage status effects', () => {
    const monster = new MonsterEntity('monster-1', 'Goblin', 'basic-enemy', mockPosition);
    const confusionEffect: StatusEffect = {
      type: 'confusion',
      turnsElapsed: 0,
      source: 'confusion-spell'
    };
    
    expect(monster.hasStatusEffect('confusion')).toBe(false);
    
    monster.addStatusEffect(confusionEffect);
    expect(monster.hasStatusEffect('confusion')).toBe(true);
    expect(monster.statusEffects).toHaveLength(1);
    
    monster.removeStatusEffect('confusion');
    expect(monster.hasStatusEffect('confusion')).toBe(false);
    expect(monster.statusEffects).toHaveLength(0);
  });

  it('should manage AI type', () => {
    const monster = new MonsterEntity('monster-1', 'Goblin', 'basic-enemy', mockPosition);
    
    expect(monster.isHostile()).toBe(true); // 'basic-hostile' contains 'hostile'
    
    monster.setAIType('passive-neutral');
    expect(monster.aiType).toBe('passive-neutral');
    expect(monster.isHostile()).toBe(false);
    
    monster.setAIType('aggressive-hostile');
    expect(monster.isHostile()).toBe(true);
  });

  it('should return experience value', () => {
    const monster = new MonsterEntity('monster-1', 'Goblin', 'basic-enemy', mockPosition);
    
    expect(monster.getExperienceValue()).toBe(10); // level 1 * 10
    
    monster.stats.level = 5;
    monster.stats.experienceValue = 50;
    expect(monster.getExperienceValue()).toBe(50);
  });

  it('should manage spawn conditions', () => {
    const monster = new MonsterEntity('monster-1', 'Goblin', 'basic-enemy', mockPosition);
    const spawnCondition = {
      type: 'floor-range',
      value: { min: 1, max: 5 }
    };
    
    monster.addSpawnCondition(spawnCondition);
    expect(monster.spawnConditions).toHaveLength(1);
    expect(monster.spawnConditions[0]).toBe(spawnCondition);
    
    // canSpawn currently returns true (placeholder implementation)
    expect(monster.canSpawn({})).toBe(true);
  });
});