/**
 * Tests for base GameEntity functionality
 */

import { describe, it, expect } from 'vitest';
import { BaseGameEntity, createDefaultCharacterStats, createDefaultCharacterAttributes, calculateLevelUpStats, canLevelUp, addExperience } from '../GameEntity';
import { Position, EntityStats } from '../../types/core';

describe('BaseGameEntity', () => {
  const mockPosition: Position = { x: 5, y: 10 };
  const mockStats: EntityStats = {
    hp: 20,
    maxHp: 20,
    attack: 8,
    defense: 5,
    evasionRate: 0.05
  };

  it('should create a basic game entity', () => {
    const entity = new BaseGameEntity('test-id', mockPosition, mockStats);
    
    expect(entity.id).toBe('test-id');
    expect(entity.position).toEqual(mockPosition);
    expect(entity.stats).toEqual(mockStats);
    expect(entity.components).toEqual([]);
    expect(entity.flags).toEqual({});
  });

  it('should update position', () => {
    const entity = new BaseGameEntity('test-id', mockPosition, mockStats);
    const newPosition: Position = { x: 15, y: 20 };
    
    entity.setPosition(newPosition);
    
    expect(entity.position).toEqual(newPosition);
  });

  it('should manage components', () => {
    const entity = new BaseGameEntity('test-id', mockPosition, mockStats);
    const mockComponent = {
      id: 'test-component',
      type: 'movement' as const,
      config: {},
      execute: () => ({ success: true })
    };
    
    entity.addComponent(mockComponent);
    expect(entity.components).toHaveLength(1);
    expect(entity.getComponent('test-component')).toBe(mockComponent);
    
    entity.removeComponent('test-component');
    expect(entity.components).toHaveLength(0);
    expect(entity.getComponent('test-component')).toBeUndefined();
  });

  it('should manage flags', () => {
    const entity = new BaseGameEntity('test-id', mockPosition, mockStats);
    
    entity.setFlag('test-flag', 'test-value');
    expect(entity.getFlag('test-flag')).toBe('test-value');
    
    entity.setFlag('number-flag', 42);
    expect(entity.getFlag('number-flag')).toBe(42);
  });

  it('should update stats', () => {
    const entity = new BaseGameEntity('test-id', mockPosition, mockStats);
    
    entity.updateStats({ hp: 15, attack: 10 });
    
    expect(entity.stats.hp).toBe(15);
    expect(entity.stats.attack).toBe(10);
    expect(entity.stats.defense).toBe(5); // Unchanged
  });
});

describe('Character Stats Functions', () => {
  it('should create default character stats', () => {
    const stats = createDefaultCharacterStats();
    
    expect(stats.level).toBe(1);
    expect(stats.experience).toBe(0);
    expect(stats.experienceValue).toBe(10); // level * 10
    expect(stats.hp).toBe(20);
    expect(stats.maxHp).toBe(20);
    expect(stats.attack).toBe(5);
    expect(stats.defense).toBe(3);
    expect(stats.evasionRate).toBe(0.05);
  });

  it('should create custom character stats', () => {
    const stats = createDefaultCharacterStats(5, 50, 15, 10);
    
    expect(stats.level).toBe(5);
    expect(stats.experienceValue).toBe(50); // level * 10
    expect(stats.hp).toBe(50);
    expect(stats.maxHp).toBe(50);
    expect(stats.attack).toBe(15);
    expect(stats.defense).toBe(10);
  });

  it('should create default character attributes', () => {
    const attributes = createDefaultCharacterAttributes();
    
    expect(attributes.primary).toBe('neutral');
    expect(attributes.secondary).toBeUndefined();
    expect(attributes.resistances).toEqual([]);
    expect(attributes.weaknesses).toEqual([]);
  });

  it('should create custom character attributes', () => {
    const attributes = createDefaultCharacterAttributes('fire');
    
    expect(attributes.primary).toBe('fire');
  });
});

describe('Level Up System', () => {
  const experienceTable = [100, 250, 450, 700, 1000]; // Levels 1-5
  const growthRates = { hp: 1.1, attack: 1.2, defense: 1.2 };

  it('should check if character can level up', () => {
    const stats = createDefaultCharacterStats(1, 20, 8, 5);
    stats.experience = 50;
    
    expect(canLevelUp(stats, experienceTable)).toBe(false);
    
    stats.experience = 100;
    expect(canLevelUp(stats, experienceTable)).toBe(true);
    
    stats.experience = 150;
    expect(canLevelUp(stats, experienceTable)).toBe(true);
  });

  it('should not level up at max level', () => {
    const stats = createDefaultCharacterStats(5, 20, 8, 5);
    stats.experience = 2000;
    
    expect(canLevelUp(stats, experienceTable)).toBe(false);
  });

  it('should calculate level up stats', () => {
    const stats = createDefaultCharacterStats(1, 20, 8, 5);
    stats.experience = 150;
    
    const newStats = calculateLevelUpStats(stats, growthRates);
    
    expect(newStats.level).toBe(2);
    expect(newStats.experience).toBe(150); // Experience is preserved in calculateLevelUpStats
    expect(newStats.experienceValue).toBe(20); // level * 10
    expect(newStats.maxHp).toBe(22); // 20 * 1.1 = 22
    expect(newStats.hp).toBe(22); // Current HP increased by same amount
    expect(newStats.attack).toBe(9); // 8 * 1.2 = 9.6, floored to 9
    expect(newStats.defense).toBe(6); // 5 * 1.2 = 6
  });

  it('should add experience and handle level up', () => {
    const stats = createDefaultCharacterStats(1, 20, 8, 5);
    stats.experience = 80;
    
    const result = addExperience(stats, 30, experienceTable, growthRates);
    
    expect(result.leveledUp).toBe(true);
    expect(result.newStats.level).toBe(2);
    expect(result.newStats.experience).toBe(10); // 110 - 100 = 10 remaining
  });

  it('should add experience without level up', () => {
    const stats = createDefaultCharacterStats(1, 20, 8, 5);
    stats.experience = 50;
    
    const result = addExperience(stats, 30, experienceTable, growthRates);
    
    expect(result.leveledUp).toBe(false);
    expect(result.newStats.level).toBe(1);
    expect(result.newStats.experience).toBe(80);
  });

  it('should handle multiple level ups', () => {
    const stats = createDefaultCharacterStats(1, 20, 8, 5);
    stats.experience = 50;
    
    const result = addExperience(stats, 500, experienceTable, growthRates);
    
    expect(result.leveledUp).toBe(true);
    expect(result.newStats.level).toBe(3); // Should level up to 3
    expect(result.newStats.experience).toBe(200); // 550 total - 100 (level 2) - 250 (level 3) = 200 remaining
  });
});