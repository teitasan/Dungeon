/**
 * Tests for HungerSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HungerSystem, FoodItem } from '../HungerSystem';
import { PlayerEntity } from '../../entities/Player';

describe('HungerSystem', () => {
  let hungerSystem: HungerSystem;
  let player: PlayerEntity;

  beforeEach(() => {
    hungerSystem = new HungerSystem();
    player = new PlayerEntity('player-1', 'Hero', { x: 5, y: 5 });
    
    // Set up initial stats
    player.stats.hp = 30;
    player.stats.maxHp = 30;
    player.hunger = 100;
    player.maxHunger = 100;
  });

  it('should process hunger decrease over time', () => {
    const initialHunger = player.hunger;
    
    const result = hungerSystem.processHunger(player);
    
    expect(result).toBeDefined();
    expect(result!.previousHunger).toBe(initialHunger);
    expect(result!.currentHunger).toBe(initialHunger - 1); // Default decrease rate
    expect(player.hunger).toBe(99);
  });

  it('should determine hunger states correctly', () => {
    expect(hungerSystem.getHungerState(100)).toBe('full');
    expect(hungerSystem.getHungerState(50)).toBe('satisfied');
    expect(hungerSystem.getHungerState(25)).toBe('hungry');
    expect(hungerSystem.getHungerState(10)).toBe('very-hungry');
    expect(hungerSystem.getHungerState(0)).toBe('starving');
    expect(hungerSystem.getHungerState(120)).toBe('overfed');
  });

  it('should apply starvation damage', () => {
    player.hunger = 0; // Set to starving
    const initialHp = player.stats.hp;
    
    const result = hungerSystem.processHunger(player);
    
    expect(result!.currentState).toBe('starving');
    expect(result!.effects).toHaveLength(2); // damage-over-time and stat-modifier
    
    const damageEffect = result!.effects.find(e => e.type === 'damage-over-time');
    expect(damageEffect).toBeDefined();
    expect(damageEffect!.applied).toBe(true);
    expect(player.stats.hp).toBeLessThan(initialHp);
  });

  it('should feed entity with food items', () => {
    player.hunger = 50;
    
    const apple: FoodItem = {
      id: 'apple',
      name: 'Apple',
      hungerValue: 20
    };
    
    const result = hungerSystem.feedEntity(player, apple);
    
    expect(result).toBeDefined();
    expect(result!.previousHunger).toBe(50);
    expect(result!.currentHunger).toBe(70);
    expect(player.hunger).toBe(70);
    expect(result!.messages).toContain('Hero ate Apple');
  });

  it('should handle overeating', () => {
    player.hunger = 95;
    
    const largeMeal: FoodItem = {
      id: 'large-meal',
      name: 'Large Meal',
      hungerValue: 50
    };
    
    const result = hungerSystem.feedEntity(player, largeMeal);
    
    expect(result!.currentState).toBe('overfed');
    expect(player.hunger).toBeGreaterThan(100);
    
    // Should apply overfed effects
    const speedEffect = result!.effects.find(e => e.type === 'movement-speed');
    expect(speedEffect).toBeDefined();
    expect(speedEffect!.value).toBe(0.5);
  });

  it('should handle food with max hunger increase', () => {
    const initialMaxHunger = player.maxHunger;
    
    const specialFood: FoodItem = {
      id: 'special-food',
      name: 'Special Food',
      hungerValue: 10,
      maxHungerIncrease: 5
    };
    
    hungerSystem.feedEntity(player, specialFood);
    
    expect(player.maxHunger).toBe(initialMaxHunger + 5);
  });

  it('should handle food with special effects', () => {
    const magicFood: FoodItem = {
      id: 'magic-food',
      name: 'Magic Food',
      hungerValue: 15,
      specialEffects: [
        {
          type: 'heal',
          value: 10,
          description: 'Restores 10 HP'
        },
        {
          type: 'stat-boost',
          value: 2,
          duration: 10,
          description: 'Increases attack by 2 for 10 turns'
        }
      ]
    };
    
    const result = hungerSystem.feedEntity(player, magicFood);
    
    expect(result).toBeDefined();
    expect(result!.messages).toContain('Hero ate Magic Food');
  });

  it('should get hunger percentage correctly', () => {
    player.hunger = 75;
    player.maxHunger = 100;
    
    expect(hungerSystem.getHungerPercentage(player)).toBe(75);
    
    player.hunger = 50;
    expect(hungerSystem.getHungerPercentage(player)).toBe(50);
  });

  it('should check hunger status correctly', () => {
    player.hunger = 100;
    expect(hungerSystem.isHungry(player)).toBe(false);
    expect(hungerSystem.isStarving(player)).toBe(false);
    expect(hungerSystem.isOverfed(player)).toBe(false);
    
    player.hunger = 15;
    expect(hungerSystem.isHungry(player)).toBe(true);
    expect(hungerSystem.isStarving(player)).toBe(false);
    
    player.hunger = 0;
    expect(hungerSystem.isHungry(player)).toBe(true);
    expect(hungerSystem.isStarving(player)).toBe(true);
    
    player.hunger = 120;
    expect(hungerSystem.isOverfed(player)).toBe(true);
  });

  it('should handle hunger state transitions', () => {
    player.hunger = 25; // hungry
    
    const result1 = hungerSystem.processHunger(player);
    expect(result1!.previousState).toBe('hungry');
    expect(result1!.currentState).toBe('hungry');
    
    // Change hunger to trigger state transition from satisfied to hungry
    player.hunger = 21; // This should be hungry (above 20 but below 40)
    const result2 = hungerSystem.processHunger(player);
    expect(result2!.previousState).toBe('hungry');
    expect(result2!.currentState).toBe('hungry'); // After processing, it becomes 20 (still hungry)
    
    // Test actual state transition
    player.hunger = 41; // satisfied
    const result3 = hungerSystem.processHunger(player);
    expect(result3!.previousState).toBe('satisfied');
    expect(result3!.currentState).toBe('satisfied'); // 41-1=40, still satisfied
    
    player.hunger = 40; // satisfied
    const result4 = hungerSystem.processHunger(player);
    expect(result4!.previousState).toBe('satisfied');
    expect(result4!.currentState).toBe('hungry'); // 40-1=39, now hungry
    expect(result4!.messages.length).toBeGreaterThan(0); // Should have state change message
  });

  it('should apply stat modifiers for hunger states', () => {
    player.hunger = 15; // This is very-hungry state (between 5 and 20)
    
    const result = hungerSystem.processHunger(player);
    
    const statEffect = result!.effects.find(e => e.type === 'stat-modifier');
    expect(statEffect).toBeDefined();
    expect(statEffect!.value).toBe(-3); // very-hungry has -3 modifier
    expect(statEffect!.applied).toBe(true);
  });

  it('should prevent hunger from going below minimum', () => {
    player.hunger = 1;
    
    hungerSystem.processHunger(player);
    
    expect(player.hunger).toBe(0); // Should not go below 0
    
    hungerSystem.processHunger(player);
    
    expect(player.hunger).toBe(0); // Should stay at 0
  });

  it('should create food items correctly', () => {
    const food = hungerSystem.createFoodItem(
      'bread',
      'Bread',
      25,
      2,
      [{ type: 'heal', value: 5, description: 'Heals 5 HP' }]
    );
    
    expect(food.id).toBe('bread');
    expect(food.name).toBe('Bread');
    expect(food.hungerValue).toBe(25);
    expect(food.maxHungerIncrease).toBe(2);
    expect(food.specialEffects).toHaveLength(1);
  });

  it('should reset and set hunger values', () => {
    player.hunger = 30;
    player.maxHunger = 100;
    
    expect(hungerSystem.resetHunger(player)).toBe(true);
    expect(player.hunger).toBe(100);
    
    expect(hungerSystem.setHunger(player, 75)).toBe(true);
    expect(player.hunger).toBe(75);
    
    // Test bounds
    expect(hungerSystem.setHunger(player, -10)).toBe(true);
    expect(player.hunger).toBe(0); // Clamped to minimum
    
    expect(hungerSystem.setHunger(player, 150)).toBe(true);
    expect(player.hunger).toBe(120); // Clamped to max + 20
  });

  it('should handle entities without hunger support', () => {
    const basicEntity = {
      id: 'basic',
      position: { x: 0, y: 0 },
      stats: { hp: 10, maxHp: 10, attack: 5, defense: 3, evasionRate: 0 },
      components: [],
      flags: {}
    } as any;
    
    expect(hungerSystem.processHunger(basicEntity)).toBeNull();
    expect(hungerSystem.getHungerPercentage(basicEntity)).toBe(100);
    expect(hungerSystem.isHungry(basicEntity)).toBe(false);
    expect(hungerSystem.resetHunger(basicEntity)).toBe(false);
  });

  it('should get and update configuration', () => {
    const originalConfig = hungerSystem.getConfig();
    expect(originalConfig.maxValue).toBe(100);
    expect(originalConfig.decreaseRate).toBe(1);
    
    hungerSystem.updateConfig({
      decreaseRate: 2,
      damageAmount: 10
    });
    
    const updatedConfig = hungerSystem.getConfig();
    expect(updatedConfig.decreaseRate).toBe(2);
    expect(updatedConfig.damageAmount).toBe(10);
    expect(updatedConfig.maxValue).toBe(100); // Unchanged
  });

  it('should provide hunger state descriptions', () => {
    expect(hungerSystem.getHungerStateDescription('full')).toContain('Full');
    expect(hungerSystem.getHungerStateDescription('hungry')).toContain('Hungry');
    expect(hungerSystem.getHungerStateDescription('starving')).toContain('Starving');
    expect(hungerSystem.getHungerStateDescription('overfed')).toContain('Overfed');
  });

  it('should handle custom hunger configuration', () => {
    const customHungerSystem = new HungerSystem({
      maxValue: 200,
      decreaseRate: 2,
      damageAmount: 10
    });
    
    const config = customHungerSystem.getConfig();
    expect(config.maxValue).toBe(200);
    expect(config.decreaseRate).toBe(2);
    expect(config.damageAmount).toBe(10);
  });
});