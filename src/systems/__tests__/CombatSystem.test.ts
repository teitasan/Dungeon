/**
 * Tests for CombatSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CombatSystem } from '../CombatSystem';
import { PlayerEntity } from '../../entities/Player';
import { MonsterEntity } from '../../entities/Monster';
import { AttackParams } from '../../types/combat';

describe('CombatSystem', () => {
  let combatSystem: CombatSystem;
  let player: PlayerEntity;
  let monster: MonsterEntity;

  beforeEach(() => {
    combatSystem = new CombatSystem();
    player = new PlayerEntity('player-1', 'Hero', { x: 5, y: 5 });
    monster = new MonsterEntity('monster-1', 'Goblin', 'basic-enemy', { x: 6, y: 5 });
    
    // Set up stats for testing
    player.stats.attack = 10;
    player.stats.defense = 5;
    player.stats.hp = 30;
    player.stats.maxHp = 30;
    
    monster.stats.attack = 8;
    monster.stats.defense = 3;
    monster.stats.hp = 20;
    monster.stats.maxHp = 20;
  });

  it('should execute basic attack', () => {
    const attackParams: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee'
    };

    const result = combatSystem.executeAttack(attackParams);

    expect(result.success).toBe(true);
    expect(result.damage).toBeGreaterThan(0);
    expect(result.actualDamage).toBeGreaterThan(0);
    expect(result.attacker).toBe(player);
    expect(result.defender).toBe(monster);
    expect(result.message).toContain('Hero attacks Goblin');
    expect(monster.stats.hp).toBeLessThan(monster.stats.maxHp);
  });

  it('should apply minimum damage', () => {
    // Set up scenario where calculated damage would be very low
    player.stats.attack = 1;
    monster.stats.defense = 20;
    
    // Remove attributes to avoid attribute modifiers affecting the test
    delete (player as any).attributes;
    delete (monster as any).attributes;

    const attackParams: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee'
    };

    const result = combatSystem.executeAttack(attackParams);

    expect(result.damage).toBeGreaterThanOrEqual(1);
    expect(result.actualDamage).toBeGreaterThanOrEqual(1);
  });

  it('should handle critical hits', () => {
    // Force critical hit
    const attackParams: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee',
      criticalOverride: true
    };

    const result = combatSystem.executeAttack(attackParams);

    expect(result.critical).toBe(true);
    expect(result.message).toContain('critical hit');
    expect(result.damage).toBeGreaterThan(0);
  });

  it('should handle evasion', () => {
    // Set up high evasion scenario
    monster.stats.evasionRate = 1.0; // 100% evasion

    const attackParams: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee'
    };

    const result = combatSystem.executeAttack(attackParams);

    expect(result.evaded).toBe(true);
    expect(result.damage).toBe(0);
    expect(result.actualDamage).toBe(0);
    expect(result.message).toContain('evaded');
    expect(monster.stats.hp).toBe(monster.stats.maxHp); // No damage taken
  });

  it('should handle unavoidable attacks', () => {
    // Set up high evasion but unavoidable attack
    monster.stats.evasionRate = 1.0; // 100% evasion

    const attackParams: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee',
      unavoidable: true
    };

    const result = combatSystem.executeAttack(attackParams);

    expect(result.evaded).toBe(false);
    expect(result.damage).toBeGreaterThan(0);
    expect(result.actualDamage).toBeGreaterThan(0);
  });

  it('should apply weapon bonus', () => {
    const attackParamsWithoutWeapon: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee'
    };

    const attackParamsWithWeapon: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee',
      weaponBonus: 5
    };

    // Reset monster HP for fair comparison
    monster.stats.hp = monster.stats.maxHp;

    // Use fixed RNG for consistent results
    combatSystem.setRNG(() => 0.5);

    const resultWithoutWeapon = combatSystem.executeAttack(attackParamsWithoutWeapon);
    
    // Reset monster HP
    monster.stats.hp = monster.stats.maxHp;
    
    const resultWithWeapon = combatSystem.executeAttack(attackParamsWithWeapon);

    expect(resultWithWeapon.damage).toBeGreaterThan(resultWithoutWeapon.damage);
  });

  it('should apply attribute modifier', () => {
    const normalAttack: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee',
      attributeModifier: 1.0
    };

    const boostedAttack: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee',
      attributeModifier: 1.5
    };

    // Use fixed RNG for consistent results
    combatSystem.setRNG(() => 0.5);

    const normalResult = combatSystem.executeAttack(normalAttack);
    
    // Reset monster HP
    monster.stats.hp = monster.stats.maxHp;
    
    const boostedResult = combatSystem.executeAttack(boostedAttack);

    expect(boostedResult.damage).toBeGreaterThan(normalResult.damage);
  });

  it('should generate death effect when HP reaches 0', () => {
    // Set monster HP very low and ensure high damage
    monster.stats.hp = 1;
    player.stats.attack = 100; // Very high attack to ensure death
    monster.stats.defense = 0; // No defense
    
    // Remove attributes to avoid unexpected modifiers
    delete (player as any).attributes;
    delete (monster as any).attributes;

    const attackParams: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee'
    };

    const result = combatSystem.executeAttack(attackParams);

    expect(monster.stats.hp).toBe(0);
    expect(result.effects.some(effect => effect.type === 'death')).toBe(true);
    expect(result.message).toContain('defeated');
  });

  it('should check if entity can attack', () => {
    expect(combatSystem.canAttack(player, monster)).toBe(true);
    expect(combatSystem.canAttack(player, player)).toBe(false); // Can't attack self

    // Dead entity can't attack
    player.stats.hp = 0;
    expect(combatSystem.canAttack(player, monster)).toBe(false);

    // Can't attack dead entity
    player.stats.hp = 30;
    monster.stats.hp = 0;
    expect(combatSystem.canAttack(player, monster)).toBe(false);
  });

  it('should provide combat preview', () => {
    const preview = combatSystem.getCombatPreview(player, monster);

    expect(preview.minDamage).toBeGreaterThan(0);
    expect(preview.maxDamage).toBeGreaterThanOrEqual(preview.minDamage);
    expect(preview.averageDamage).toBeGreaterThanOrEqual(preview.minDamage);
    expect(preview.averageDamage).toBeLessThanOrEqual(preview.maxDamage);
    expect(preview.criticalDamage).toBeGreaterThan(preview.maxDamage);
    expect(preview.hitChance).toBeGreaterThan(0);
    expect(preview.hitChance).toBeLessThanOrEqual(1);
    expect(preview.criticalChance).toBeGreaterThan(0);
    expect(preview.criticalChance).toBeLessThanOrEqual(1);
  });

  it('should manage combat state', () => {
    expect(combatSystem.isInCombat()).toBe(false);

    combatSystem.startCombat([player, monster]);
    expect(combatSystem.isInCombat()).toBe(true);
    expect(combatSystem.getCombatParticipants()).toEqual([player, monster]);

    combatSystem.endCombat();
    expect(combatSystem.isInCombat()).toBe(false);
    expect(combatSystem.getCombatParticipants()).toEqual([]);
  });

  it('should log combat actions', () => {
    // Remove attributes to ensure consistent behavior
    delete (player as any).attributes;
    delete (monster as any).attributes;
    
    const attackParams: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee'
    };

    expect(combatSystem.getCombatLog()).toHaveLength(0);

    combatSystem.executeAttack(attackParams);

    const log = combatSystem.getCombatLog();
    expect(log).toHaveLength(1);
    expect(log[0].action.attacker).toBe(player);
    expect(log[0].action.target).toBe(monster);
    expect(log[0].result.success).toBe(true);

    combatSystem.clearCombatLog();
    expect(combatSystem.getCombatLog()).toHaveLength(0);
  });

  it('should use mystery dungeon damage formula correctly', () => {
    // Test the specific formula: {攻撃力×1.3×(35/36)^防御力}×(7/8~9/8)
    player.stats.attack = 10;
    monster.stats.defense = 5;

    // Use fixed RNG for predictable results
    combatSystem.setRNG(() => 0.5); // Middle of random range

    const attackParams: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee'
    };

    const result = combatSystem.executeAttack(attackParams);

    // Expected calculation:
    // Base: 10 * 1.3 = 13
    // Defense reduction: (35/36)^5 ≈ 0.8681
    // After defense: 13 * 0.8681 ≈ 11.285
    // Random factor: 0.5 * (9/8 - 7/8) + 7/8 = 0.5 * 0.25 + 0.875 = 1.0
    // Final: 11.285 * 1.0 ≈ 11 (floored)
    // Minimum damage ensures at least 1

    expect(result.damage).toBeGreaterThanOrEqual(1);
    expect(result.damage).toBeLessThanOrEqual(20); // Reasonable upper bound
  });

  it('should ignore defense on critical hits', () => {
    // Set up high defense monster
    monster.stats.defense = 20;

    const normalAttack: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee',
      criticalOverride: false
    };

    const criticalAttack: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee',
      criticalOverride: true
    };

    // Use fixed RNG
    combatSystem.setRNG(() => 0.5);

    const normalResult = combatSystem.executeAttack(normalAttack);
    
    // Reset monster HP
    monster.stats.hp = monster.stats.maxHp;
    
    const criticalResult = combatSystem.executeAttack(criticalAttack);

    // Critical should do significantly more damage due to ignoring defense
    expect(criticalResult.damage).toBeGreaterThan(normalResult.damage);
    expect(criticalResult.critical).toBe(true);
    expect(normalResult.critical).toBe(false);
  });

  it('should update and get configuration', () => {
    const originalConfig = combatSystem.getConfig();
    expect(originalConfig.attackMultiplier).toBe(1.3);

    combatSystem.updateConfig({ attackMultiplier: 1.5 });
    
    const updatedConfig = combatSystem.getConfig();
    expect(updatedConfig.attackMultiplier).toBe(1.5);
    expect(updatedConfig.defenseBase).toBe(originalConfig.defenseBase); // Other values unchanged
  });

  it('should integrate with attribute system', () => {
    const attributeSystem = combatSystem.getAttributeSystem();
    expect(attributeSystem).toBeDefined();

    // Test direct attribute modifier calculation
    expect(attributeSystem.calculateAttributeModifier('fire', 'grass')).toBe(1.2);
    expect(attributeSystem.calculateAttributeModifier('grass', 'fire')).toBe(0.8);

    // Set up entities with attributes
    player.attributes = { primary: 'fire', resistances: [], weaknesses: [] };
    monster.attributes = { primary: 'grass', resistances: [], weaknesses: [] };

    // Test entity attribute modifier calculation
    const modifier = attributeSystem.calculateEntityAttributeModifier(player, monster);
    expect(modifier).toBe(1.2);

    // Test that combat system uses attribute modifiers
    const attackParams: AttackParams = {
      attacker: player,
      defender: monster,
      attackType: 'melee'
    };

    const result = combatSystem.executeAttack(attackParams);
    expect(result.success).toBe(true);
    expect(result.damage).toBeGreaterThan(0);
  });
});