/**
 * Tests for StatusEffectSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StatusEffectSystem, StatusEffectConfig } from '../StatusEffectSystem';
import { PlayerEntity } from '../../entities/Player';
import { MonsterEntity } from '../../entities/Monster';

describe('StatusEffectSystem', () => {
  let statusSystem: StatusEffectSystem;
  let player: PlayerEntity;
  let monster: MonsterEntity;

  beforeEach(() => {
    statusSystem = new StatusEffectSystem();
    player = new PlayerEntity('player-1', 'Hero', { x: 5, y: 5 });
    monster = new MonsterEntity('monster-1', 'Goblin', 'basic-enemy', { x: 6, y: 5 });
    
    // Set up stats
    player.stats.hp = 30;
    player.stats.maxHp = 30;
    monster.stats.hp = 20;
    monster.stats.maxHp = 20;
  });

  it('should apply status effects to entities', () => {
    expect(statusSystem.applyStatusEffect(player, 'poison', 1)).toBe(true);
    expect(statusSystem.hasStatusEffect(player, 'poison')).toBe(true);
    
    const statusEffects = statusSystem.getStatusEffects(player);
    expect(statusEffects).toHaveLength(1);
    expect(statusEffects[0].type).toBe('poison');
    expect(statusEffects[0].intensity).toBe(1);
    expect(statusEffects[0].turnsElapsed).toBe(0);
  });

  it('should not apply unknown status effects', () => {
    expect(statusSystem.applyStatusEffect(player, 'unknown-effect')).toBe(false);
    expect(statusSystem.hasStatusEffect(player, 'unknown-effect')).toBe(false);
  });

  it('should handle stackable status effects', () => {
    // Poison is stackable
    statusSystem.applyStatusEffect(player, 'poison', 1);
    statusSystem.applyStatusEffect(player, 'poison', 2);
    
    const poisonEffect = statusSystem.getStatusEffect(player, 'poison');
    expect(poisonEffect).toBeDefined();
    expect(poisonEffect!.intensity).toBe(3); // 1 + 2
  });

  it('should handle non-stackable status effects', () => {
    // Confusion is not stackable
    statusSystem.applyStatusEffect(player, 'confusion', 1);
    statusSystem.applyStatusEffect(player, 'confusion', 2);
    
    const confusionEffect = statusSystem.getStatusEffect(player, 'confusion');
    expect(confusionEffect).toBeDefined();
    expect(confusionEffect!.intensity).toBe(1); // Should remain 1
    expect(confusionEffect!.turnsElapsed).toBe(0); // Should reset duration
  });

  it('should remove status effects', () => {
    statusSystem.applyStatusEffect(player, 'poison');
    expect(statusSystem.hasStatusEffect(player, 'poison')).toBe(true);
    
    expect(statusSystem.removeStatusEffect(player, 'poison')).toBe(true);
    expect(statusSystem.hasStatusEffect(player, 'poison')).toBe(false);
    
    // Removing non-existent effect should return false
    expect(statusSystem.removeStatusEffect(player, 'poison')).toBe(false);
  });

  it('should process poison damage', () => {
    statusSystem.applyStatusEffect(player, 'poison', 2); // Intensity 2
    const initialHp = player.stats.hp;
    
    const results = statusSystem.processStatusEffects(player, 'turn-end');
    
    expect(results).toHaveLength(1);
    expect(results[0].effectId).toBe('poison');
    expect(results[0].actions).toHaveLength(1);
    expect(results[0].actions[0].type).toBe('damage');
    expect(results[0].actions[0].success).toBe(true);
    expect(results[0].actions[0].value).toBe(4); // 2 damage * 2 intensity
    expect(player.stats.hp).toBe(initialHp - 4);
  });

  it('should handle status effect recovery', () => {
    statusSystem.applyStatusEffect(player, 'poison');
    
    // Force recovery by setting RNG to always succeed
    statusSystem.setRNG(() => 0.05); // Less than base recovery chance (0.1)
    
    const results = statusSystem.processStatusEffects(player, 'turn-end');
    
    expect(results[0].recovered).toBe(true);
    expect(statusSystem.hasStatusEffect(player, 'poison')).toBe(false);
  });

  it('should handle status effect expiration', () => {
    statusSystem.applyStatusEffect(player, 'poison');
    
    // Force no recovery
    statusSystem.setRNG(() => 0.9);
    
    const poisonConfig = statusSystem.getStatusEffectConfig('poison')!;
    
    // Simulate turns until expiration
    for (let i = 0; i < poisonConfig.maxDuration; i++) {
      const results = statusSystem.processStatusEffects(player, 'turn-end');
      
      if (i === poisonConfig.maxDuration - 1) {
        expect(results[0].expired).toBe(true);
      } else {
        expect(results[0].expired).toBe(false);
      }
    }
    
    expect(statusSystem.hasStatusEffect(player, 'poison')).toBe(false);
  });

  it('should handle paralysis preventing actions', () => {
    statusSystem.applyStatusEffect(player, 'paralysis');
    
    // Force paralysis to trigger
    statusSystem.setRNG(() => 0.1); // Less than 0.25 chance
    
    const results = statusSystem.processStatusEffects(player, 'before-action');
    
    expect(results).toHaveLength(1);
    expect(results[0].actions).toHaveLength(1);
    expect(results[0].actions[0].type).toBe('prevent-action');
    expect(results[0].actions[0].success).toBe(true);
    expect(results[0].actions[0].message).toContain('unable to act');
  });

  it('should handle confusion random actions', () => {
    statusSystem.applyStatusEffect(player, 'confusion');
    
    // Force confusion to trigger
    statusSystem.setRNG(() => 0.3); // Less than 0.5 chance
    
    const results = statusSystem.processStatusEffects(player, 'before-action');
    
    expect(results).toHaveLength(1);
    expect(results[0].actions).toHaveLength(1);
    expect(results[0].actions[0].type).toBe('random-action');
    expect(results[0].actions[0].success).toBe(true);
  });

  it('should handle bind movement restriction', () => {
    statusSystem.applyStatusEffect(player, 'bind');
    
    const results = statusSystem.processStatusEffects(player, 'before-action');
    
    expect(results).toHaveLength(1);
    expect(results[0].actions).toHaveLength(1);
    expect(results[0].actions[0].type).toBe('movement-restriction');
    expect(results[0].actions[0].success).toBe(true);
    expect(results[0].actions[0].message).toContain('movement is restricted');
  });

  it('should clear all status effects', () => {
    statusSystem.applyStatusEffect(player, 'poison');
    statusSystem.applyStatusEffect(player, 'confusion');
    statusSystem.applyStatusEffect(player, 'paralysis');
    
    expect(statusSystem.getStatusEffects(player)).toHaveLength(3);
    
    statusSystem.clearAllStatusEffects(player);
    
    expect(statusSystem.getStatusEffects(player)).toHaveLength(0);
    expect(statusSystem.hasStatusEffect(player, 'poison')).toBe(false);
    expect(statusSystem.hasStatusEffect(player, 'confusion')).toBe(false);
    expect(statusSystem.hasStatusEffect(player, 'paralysis')).toBe(false);
  });

  it('should register custom status effects', () => {
    const customEffect: StatusEffectConfig = {
      id: 'custom-burn',
      name: 'Burn',
      description: 'Custom burn effect',
      maxDuration: 5,
      stackable: true,
      recoveryChance: {
        base: 0.2,
        increase: 0.1,
        max: 0.8
      },
      effects: [
        {
          type: 'damage',
          timing: 'turn-start',
          value: 3,
          description: 'Burn damage'
        }
      ]
    };
    
    statusSystem.registerStatusEffect(customEffect);
    
    expect(statusSystem.getStatusEffectConfig('custom-burn')).toBe(customEffect);
    expect(statusSystem.getRegisteredStatusEffects()).toContain('custom-burn');
    
    // Test applying custom effect
    expect(statusSystem.applyStatusEffect(player, 'custom-burn')).toBe(true);
    expect(statusSystem.hasStatusEffect(player, 'custom-burn')).toBe(true);
  });

  it('should handle different timing phases', () => {
    // Create effect with multiple timings
    const multiTimingEffect: StatusEffectConfig = {
      id: 'multi-timing',
      name: 'Multi Timing',
      description: 'Effect with multiple timings',
      maxDuration: 3,
      stackable: false,
      recoveryChance: {
        base: 0.0,
        increase: 0.0,
        max: 0.0
      },
      effects: [
        {
          type: 'damage',
          timing: 'turn-start',
          value: 1,
          description: 'Start damage'
        },
        {
          type: 'damage',
          timing: 'turn-end',
          value: 2,
          description: 'End damage'
        }
      ]
    };
    
    statusSystem.registerStatusEffect(multiTimingEffect);
    statusSystem.applyStatusEffect(player, 'multi-timing');
    
    const initialHp = player.stats.hp;
    
    // Process turn start
    const startResults = statusSystem.processStatusEffects(player, 'turn-start');
    expect(startResults[0].actions).toHaveLength(1);
    expect(startResults[0].actions[0].value).toBe(1);
    expect(player.stats.hp).toBe(initialHp - 1);
    
    // Process turn end
    const endResults = statusSystem.processStatusEffects(player, 'turn-end');
    expect(endResults[0].actions).toHaveLength(1);
    expect(endResults[0].actions[0].value).toBe(2);
    expect(player.stats.hp).toBe(initialHp - 3);
  });

  it('should handle recovery chance progression', () => {
    statusSystem.applyStatusEffect(player, 'poison');
    
    const poisonConfig = statusSystem.getStatusEffectConfig('poison')!;
    const { base, increase } = poisonConfig.recoveryChance;
    
    // Simulate several turns to test recovery chance increase
    let recovered = false;
    let turns = 0;
    
    // Set RNG to a value that will eventually trigger recovery
    statusSystem.setRNG(() => 0.3);
    
    while (!recovered && turns < 10) {
      const results = statusSystem.processStatusEffects(player, 'turn-end');
      recovered = results[0]?.recovered || false;
      turns++;
      
      if (!recovered) {
        const effect = statusSystem.getStatusEffect(player, 'poison');
        const expectedChance = Math.min(
          poisonConfig.recoveryChance.max,
          base + (increase * effect!.turnsElapsed)
        );
        
        // Recovery chance should increase each turn
        expect(expectedChance).toBeGreaterThanOrEqual(base);
      }
    }
    
    // Should eventually recover due to increasing chance
    expect(recovered).toBe(true);
  });

  it('should handle entities without status effect support', () => {
    // Create a basic object without statusEffects property
    const basicEntity = {
      id: 'basic',
      position: { x: 0, y: 0 },
      stats: { hp: 10, maxHp: 10, attack: 5, defense: 3, evasionRate: 0 },
      components: [],
      flags: {}
    } as any;
    
    expect(statusSystem.applyStatusEffect(basicEntity, 'poison')).toBe(false);
    expect(statusSystem.hasStatusEffect(basicEntity, 'poison')).toBe(false);
    expect(statusSystem.getStatusEffects(basicEntity)).toEqual([]);
    expect(statusSystem.processStatusEffects(basicEntity, 'turn-end')).toEqual([]);
  });
});