/**
 * Tests for AttributeSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AttributeSystem, AttributeEffectiveness } from '../AttributeSystem';
import { PlayerEntity } from '../../entities/Player';
import { MonsterEntity } from '../../entities/Monster';
import { createDefaultCharacterAttributes } from '../../entities/GameEntity';

describe('AttributeSystem', () => {
  let attributeSystem: AttributeSystem;

  beforeEach(() => {
    attributeSystem = new AttributeSystem();
  });

  it('should calculate basic attribute modifiers', () => {
    // Fire vs Grass should be super effective
    expect(attributeSystem.calculateAttributeModifier('fire', 'grass'))
      .toBe(AttributeEffectiveness.SUPER_EFFECTIVE);

    // Fire vs Water should be not very effective
    expect(attributeSystem.calculateAttributeModifier('fire', 'water'))
      .toBe(AttributeEffectiveness.NOT_VERY_EFFECTIVE);

    // Fire vs Fire should be not very effective
    expect(attributeSystem.calculateAttributeModifier('fire', 'fire'))
      .toBe(AttributeEffectiveness.NOT_VERY_EFFECTIVE);

    // Electric vs Ground should be immune
    expect(attributeSystem.calculateAttributeModifier('electric', 'ground'))
      .toBe(AttributeEffectiveness.IMMUNE);
  });

  it('should handle neutral attributes', () => {
    // Neutral vs anything should be normal
    expect(attributeSystem.calculateAttributeModifier('neutral', 'fire'))
      .toBe(AttributeEffectiveness.NORMAL);

    // Anything vs neutral should be normal
    expect(attributeSystem.calculateAttributeModifier('fire', 'neutral'))
      .toBe(AttributeEffectiveness.NORMAL);

    // Neutral vs neutral should be normal
    expect(attributeSystem.calculateAttributeModifier('neutral', 'neutral'))
      .toBe(AttributeEffectiveness.NORMAL);
  });

  it('should handle unknown attributes', () => {
    // Unknown attributes should default to normal
    expect(attributeSystem.calculateAttributeModifier('unknown', 'fire'))
      .toBe(AttributeEffectiveness.NORMAL);

    expect(attributeSystem.calculateAttributeModifier('fire', 'unknown'))
      .toBe(AttributeEffectiveness.NORMAL);
  });

  it('should calculate entity attribute modifiers', () => {
    const firePlayer = new PlayerEntity('player-1', 'Fire Hero', { x: 5, y: 5 });
    const grassMonster = new MonsterEntity('monster-1', 'Grass Enemy', 'basic-enemy', { x: 6, y: 5 });

    // Set attributes
    firePlayer.attributes = createDefaultCharacterAttributes('fire');
    grassMonster.attributes = createDefaultCharacterAttributes('grass');

    const modifier = attributeSystem.calculateEntityAttributeModifier(firePlayer, grassMonster);
    expect(modifier).toBe(AttributeEffectiveness.SUPER_EFFECTIVE);
  });

  it('should handle entities without attributes', () => {
    const player = new PlayerEntity('player-1', 'Hero', { x: 5, y: 5 });
    const monster = new MonsterEntity('monster-1', 'Enemy', 'basic-enemy', { x: 6, y: 5 });

    // Entities without attributes should return normal effectiveness
    const modifier = attributeSystem.calculateEntityAttributeModifier(player, monster);
    expect(modifier).toBe(AttributeEffectiveness.NORMAL);
  });

  it('should provide available attributes', () => {
    const attributes = attributeSystem.getAvailableAttributes();
    
    expect(attributes).toContain('neutral');
    expect(attributes).toContain('fire');
    expect(attributes).toContain('water');
    expect(attributes).toContain('grass');
    expect(attributes).toContain('electric');
    expect(attributes.length).toBeGreaterThan(10);
  });

  it('should provide effectiveness descriptions', () => {
    expect(attributeSystem.getEffectivenessDescription(AttributeEffectiveness.IMMUNE))
      .toBe('No effect');
    expect(attributeSystem.getEffectivenessDescription(AttributeEffectiveness.NOT_VERY_EFFECTIVE))
      .toBe('Not very effective');
    expect(attributeSystem.getEffectivenessDescription(AttributeEffectiveness.NORMAL))
      .toBe('Normal effectiveness');
    expect(attributeSystem.getEffectivenessDescription(AttributeEffectiveness.SUPER_EFFECTIVE))
      .toBe('Super effective');
  });

  it('should provide attribute colors', () => {
    expect(attributeSystem.getAttributeColor('fire')).toBe('#F08030');
    expect(attributeSystem.getAttributeColor('water')).toBe('#6890F0');
    expect(attributeSystem.getAttributeColor('grass')).toBe('#78C850');
    expect(attributeSystem.getAttributeColor('neutral')).toBe('#A8A878');
  });

  it('should check effectiveness conditions', () => {
    // Super effective
    expect(attributeSystem.isEffective('fire', 'grass')).toBe(true);
    expect(attributeSystem.isEffective('water', 'fire')).toBe(true);

    // Not very effective
    expect(attributeSystem.isNotVeryEffective('fire', 'water')).toBe(true);
    expect(attributeSystem.isNotVeryEffective('grass', 'fire')).toBe(true);

    // No effect
    expect(attributeSystem.hasNoEffect('electric', 'ground')).toBe(true);
    expect(attributeSystem.hasNoEffect('fighting', 'ghost')).toBe(true);

    // Normal effectiveness
    expect(attributeSystem.isEffective('fire', 'electric')).toBe(false);
    expect(attributeSystem.isNotVeryEffective('fire', 'electric')).toBe(false);
    expect(attributeSystem.hasNoEffect('fire', 'electric')).toBe(false);
  });

  it('should get weaknesses for attributes', () => {
    const fireWeaknesses = attributeSystem.getWeaknesses('fire');
    expect(fireWeaknesses).toContain('water');
    expect(fireWeaknesses).toContain('ground');
    expect(fireWeaknesses).toContain('rock');

    const grassWeaknesses = attributeSystem.getWeaknesses('grass');
    expect(grassWeaknesses).toContain('fire');
    expect(grassWeaknesses).toContain('ice');
    expect(grassWeaknesses).toContain('poison');
    expect(grassWeaknesses).toContain('flying');
    expect(grassWeaknesses).toContain('bug');
  });

  it('should get resistances for attributes', () => {
    const fireResistances = attributeSystem.getResistances('fire');
    expect(fireResistances).toContain('fire');
    expect(fireResistances).toContain('grass');
    expect(fireResistances).toContain('ice');
    expect(fireResistances).toContain('bug');
    expect(fireResistances).toContain('steel');

    const waterResistances = attributeSystem.getResistances('water');
    expect(waterResistances).toContain('fire');
    expect(waterResistances).toContain('water');
    expect(waterResistances).toContain('ice');
    expect(waterResistances).toContain('steel');
  });

  it('should get immunities for attributes', () => {
    const groundImmunities = attributeSystem.getImmunities('ground');
    expect(groundImmunities).toContain('electric');

    const flyingImmunities = attributeSystem.getImmunities('flying');
    expect(flyingImmunities).toContain('ground');

    const ghostImmunities = attributeSystem.getImmunities('ghost');
    expect(ghostImmunities).toContain('fighting');

    const steelImmunities = attributeSystem.getImmunities('steel');
    expect(steelImmunities).toContain('poison');
  });

  it('should handle complex type matchups', () => {
    // Water vs Fire (super effective)
    expect(attributeSystem.calculateAttributeModifier('water', 'fire'))
      .toBe(AttributeEffectiveness.SUPER_EFFECTIVE);

    // Grass vs Water (super effective)
    expect(attributeSystem.calculateAttributeModifier('grass', 'water'))
      .toBe(AttributeEffectiveness.SUPER_EFFECTIVE);

    // Electric vs Flying (super effective)
    expect(attributeSystem.calculateAttributeModifier('electric', 'flying'))
      .toBe(AttributeEffectiveness.SUPER_EFFECTIVE);

    // Ice vs Dragon (super effective)
    expect(attributeSystem.calculateAttributeModifier('ice', 'dragon'))
      .toBe(AttributeEffectiveness.SUPER_EFFECTIVE);

    // Fighting vs Steel (super effective)
    expect(attributeSystem.calculateAttributeModifier('fighting', 'steel'))
      .toBe(AttributeEffectiveness.SUPER_EFFECTIVE);
  });

  it('should allow compatibility matrix updates', () => {
    const originalMatrix = attributeSystem.getCompatibilityMatrix();
    
    // Update matrix
    attributeSystem.updateCompatibilityMatrix({
      'custom': {
        'fire': AttributeEffectiveness.SUPER_EFFECTIVE,
        'water': AttributeEffectiveness.NOT_VERY_EFFECTIVE
      }
    });

    expect(attributeSystem.calculateAttributeModifier('custom', 'fire'))
      .toBe(AttributeEffectiveness.SUPER_EFFECTIVE);
    expect(attributeSystem.calculateAttributeModifier('custom', 'water'))
      .toBe(AttributeEffectiveness.NOT_VERY_EFFECTIVE);

    // Original relationships should still work
    expect(attributeSystem.calculateAttributeModifier('fire', 'grass'))
      .toBe(AttributeEffectiveness.SUPER_EFFECTIVE);
  });

  it('should maintain consistency in type chart', () => {
    // Test some key relationships for consistency
    const testCases = [
      { attacker: 'fire', defender: 'grass', expected: AttributeEffectiveness.SUPER_EFFECTIVE },
      { attacker: 'water', defender: 'fire', expected: AttributeEffectiveness.SUPER_EFFECTIVE },
      { attacker: 'grass', defender: 'water', expected: AttributeEffectiveness.SUPER_EFFECTIVE },
      { attacker: 'electric', defender: 'water', expected: AttributeEffectiveness.SUPER_EFFECTIVE },
      { attacker: 'electric', defender: 'ground', expected: AttributeEffectiveness.IMMUNE },
      { attacker: 'fighting', defender: 'ghost', expected: AttributeEffectiveness.IMMUNE },
      { attacker: 'psychic', defender: 'dark', expected: AttributeEffectiveness.IMMUNE }
    ];

    for (const testCase of testCases) {
      expect(attributeSystem.calculateAttributeModifier(testCase.attacker, testCase.defender))
        .toBe(testCase.expected);
    }
  });
});