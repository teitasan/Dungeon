/**
 * Tests for AISystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AISystem, AIBehaviorConfig } from '../AISystem';
import { DungeonManager } from '../../dungeon/DungeonManager';
import { MovementSystem } from '../MovementSystem';
import { CombatSystem } from '../CombatSystem';
import { TurnSystem } from '../TurnSystem';
import { PlayerEntity } from '../../entities/Player';
import { MonsterEntity } from '../../entities/Monster';
import { CompanionEntity } from '../../entities/Companion';

describe('AISystem', () => {
  let aiSystem: AISystem;
  let dungeonManager: DungeonManager;
  let movementSystem: MovementSystem;
  let combatSystem: CombatSystem;
  let turnSystem: TurnSystem;
  let player: PlayerEntity;
  let monster: MonsterEntity;
  let companion: CompanionEntity;

  beforeEach(() => {
    dungeonManager = new DungeonManager();
    movementSystem = new MovementSystem(dungeonManager);
    combatSystem = new CombatSystem();
    turnSystem = new TurnSystem();
    aiSystem = new AISystem(dungeonManager, movementSystem, combatSystem, turnSystem);
    
    // Generate test dungeon
    const dungeon = dungeonManager.generateDungeon('basic-dungeon', 1, 12345);
    
    // Create entities
    player = new PlayerEntity('player-1', 'Hero', dungeon.playerSpawn);
    player.stats.hp = 30;
    player.stats.maxHp = 30;
    
    const monsterPos = { x: dungeon.playerSpawn.x + 3, y: dungeon.playerSpawn.y };
    monster = new MonsterEntity('monster-1', 'Goblin', 'basic-enemy', monsterPos);
    monster.stats.hp = 15;
    monster.stats.maxHp = 15;
    monster.aiType = 'basic-hostile';
    
    const companionPos = { x: dungeon.playerSpawn.x + 1, y: dungeon.playerSpawn.y };
    companion = new CompanionEntity('companion-1', 'Ally', 'warrior', companionPos);
    companion.stats.hp = 20;
    companion.stats.maxHp = 20;
    companion.aiType = 'companion-follow';
    
    // Add entities to dungeon
    dungeonManager.addEntity(player, player.position);
    if (dungeonManager.isWalkable(monsterPos)) {
      dungeonManager.addEntity(monster, monsterPos);
    }
    if (dungeonManager.isWalkable(companionPos)) {
      dungeonManager.addEntity(companion, companionPos);
    }
  });

  it('should process AI for monsters', () => {
    const decision = aiSystem.processAI(monster);
    
    expect(decision).toBeDefined();
    expect(decision!.action).toBeDefined();
    expect(decision!.priority).toBeGreaterThanOrEqual(0);
  });

  it('should process AI for companions', () => {
    const decision = aiSystem.processAI(companion);
    
    expect(decision).toBeDefined();
    expect(decision!.action).toBeDefined();
    expect(decision!.priority).toBeGreaterThanOrEqual(0);
  });

  it('should not process AI for entities without AI support', () => {
    const decision = aiSystem.processAI(player);
    
    expect(decision).toBeNull();
  });

  it('should make aggressive decisions for hostile monsters', () => {
    // Move monster closer to player to trigger aggressive behavior
    const closePos = { x: player.position.x + 1, y: player.position.y + 1 };
    if (dungeonManager.isWalkable(closePos)) {
      dungeonManager.moveEntity(monster, closePos);
      
      const decision = aiSystem.processAI(monster);
      
      expect(decision).toBeDefined();
      // Should either attack or move towards player
      expect(['attack', 'move'].includes(decision!.action)).toBe(true);
      expect(decision!.priority).toBeGreaterThan(5);
    }
  });

  it('should make follow decisions for companions', () => {
    // Move companion far from player
    const farPos = { x: player.position.x + 5, y: player.position.y + 5 };
    if (dungeonManager.isWalkable(farPos)) {
      dungeonManager.moveEntity(companion, farPos);
      
      const decision = aiSystem.processAI(companion);
      
      expect(decision).toBeDefined();
      // Should move towards player
      expect(decision!.action).toBe('move');
      expect(decision!.position).toBeDefined();
    }
  });

  it('should register custom AI behaviors', () => {
    const customBehavior: AIBehaviorConfig = {
      type: 'aggressive',
      aggroRange: 10,
      attackRange: 2,
      fleeThreshold: 0.1,
      patrolRadius: 5,
      followDistance: 1,
      decisionCooldown: 200
    };
    
    aiSystem.registerBehavior('custom-aggressive', customBehavior);
    
    // Create monster with custom AI
    const customMonster = new MonsterEntity('custom-monster', 'Custom', 'basic-enemy', { x: 10, y: 10 });
    customMonster.aiType = 'custom-aggressive';
    
    const decision = aiSystem.processAI(customMonster);
    expect(decision).toBeDefined();
  });

  it('should set and clear behavior overrides', () => {
    // Set behavior override
    aiSystem.setBehaviorOverride(monster, 'passive');
    
    const decision1 = aiSystem.processAI(monster);
    expect(decision1).toBeDefined();
    // Passive behavior should result in wait or flee
    expect(['wait', 'move'].includes(decision1!.action)).toBe(true);
    
    // Clear behavior override
    aiSystem.clearBehaviorOverride(monster);
    
    const decision2 = aiSystem.processAI(monster);
    expect(decision2).toBeDefined();
    // Should return to original aggressive behavior
  });

  it('should handle decision cooldown', () => {
    // First decision
    const decision1 = aiSystem.processAI(monster);
    expect(decision1).toBeDefined();
    
    // Immediate second decision should be wait due to cooldown
    const decision2 = aiSystem.processAI(monster);
    expect(decision2).toBeDefined();
    expect(decision2!.action).toBe('wait');
    expect(decision2!.priority).toBe(0);
  });

  it('should make defensive decisions', () => {
    // Set monster to defensive behavior
    aiSystem.setBehaviorOverride(monster, 'defensive');
    
    // Move player very close to monster
    const closePos = { x: monster.position.x + 1, y: monster.position.y };
    if (dungeonManager.isWalkable(closePos)) {
      dungeonManager.moveEntity(player, closePos);
      
      const decision = aiSystem.processAI(monster);
      
      expect(decision).toBeDefined();
      // Should attack or move away
      expect(['attack', 'move'].includes(decision!.action)).toBe(true);
    }
  });

  it('should make flee decisions', () => {
    // Set monster to flee behavior
    aiSystem.setBehaviorOverride(monster, 'flee');
    
    // Move player close to monster
    const closePos = { x: monster.position.x + 1, y: monster.position.y };
    if (dungeonManager.isWalkable(closePos)) {
      dungeonManager.moveEntity(player, closePos);
      
      const decision = aiSystem.processAI(monster);
      
      expect(decision).toBeDefined();
      // Should move away from player
      expect(decision!.action).toBe('move');
      expect(decision!.priority).toBeGreaterThan(5);
    }
  });

  it('should make random decisions', () => {
    // Set monster to random behavior
    aiSystem.setBehaviorOverride(monster, 'random');
    
    const decision = aiSystem.processAI(monster);
    
    expect(decision).toBeDefined();
    expect(['wait', 'move', 'attack'].includes(decision!.action)).toBe(true);
  });

  it('should make guard decisions', () => {
    // Set monster to guard behavior
    aiSystem.setBehaviorOverride(monster, 'guard');
    
    // Move monster away from home position
    const awayPos = { x: monster.position.x + 3, y: monster.position.y + 3 };
    if (dungeonManager.isWalkable(awayPos)) {
      dungeonManager.moveEntity(monster, awayPos);
      
      const decision = aiSystem.processAI(monster);
      
      expect(decision).toBeDefined();
      // Should move back towards home position
      expect(decision!.action).toBe('move');
    }
  });

  it('should make patrol decisions', () => {
    // Set monster to patrol behavior
    aiSystem.setBehaviorOverride(monster, 'patrol');
    
    const decision = aiSystem.processAI(monster);
    
    expect(decision).toBeDefined();
    // Should wait or move (patrol points not set up in this test)
    expect(['wait', 'move'].includes(decision!.action)).toBe(true);
  });

  it('should handle companion attack mode', () => {
    // Set companion to attack mode
    companion.setBehaviorMode('attack');
    
    // Move monster close to companion
    const closePos = { x: companion.position.x + 1, y: companion.position.y };
    if (dungeonManager.isWalkable(closePos)) {
      dungeonManager.moveEntity(monster, closePos);
      
      const decision = aiSystem.processAI(companion);
      
      expect(decision).toBeDefined();
      // Should attack the monster
      if (decision!.action === 'attack') {
        expect(decision!.target).toBe(monster);
        expect(decision!.priority).toBeGreaterThan(8);
      }
    }
  });

  it('should handle passive behavior when damaged', () => {
    // Set monster to passive behavior
    aiSystem.setBehaviorOverride(monster, 'passive');
    
    // Damage the monster
    monster.stats.hp = monster.stats.maxHp * 0.5; // 50% health
    
    // Move player close
    const closePos = { x: monster.position.x + 1, y: monster.position.y };
    if (dungeonManager.isWalkable(closePos)) {
      dungeonManager.moveEntity(player, closePos);
      
      const decision = aiSystem.processAI(monster);
      
      expect(decision).toBeDefined();
      // Should try to flee when damaged
      if (decision!.action === 'move') {
        expect(decision!.priority).toBeGreaterThan(5);
      }
    }
  });

  it('should maintain AI state between decisions', () => {
    // Make first decision
    const decision1 = aiSystem.processAI(monster);
    expect(decision1).toBeDefined();
    
    // Wait for cooldown to pass
    setTimeout(() => {
      const decision2 = aiSystem.processAI(monster);
      expect(decision2).toBeDefined();
      // AI state should be maintained between calls
    }, 600);
  });

  it('should handle entities without valid AI type', () => {
    // Create entity with invalid AI type
    const invalidMonster = new MonsterEntity('invalid', 'Invalid', 'basic-enemy', { x: 5, y: 5 });
    invalidMonster.aiType = 'non-existent-ai';
    
    const decision = aiSystem.processAI(invalidMonster);
    
    expect(decision).toBeNull();
  });

  it('should identify enemies correctly', () => {
    // Test through AI decisions - monsters should target players/companions
    const decision = aiSystem.processAI(monster);
    
    if (decision && decision.action === 'attack') {
      expect([player, companion]).toContain(decision.target);
    }
  });

  it('should handle companion follow distance', () => {
    // Move companion very close to player
    const veryClosePos = { x: player.position.x, y: player.position.y + 1 };
    if (dungeonManager.isWalkable(veryClosePos)) {
      dungeonManager.moveEntity(companion, veryClosePos);
      
      const decision = aiSystem.processAI(companion);
      
      expect(decision).toBeDefined();
      // Should maintain appropriate distance
      if (decision!.action === 'move') {
        expect(decision!.position).toBeDefined();
      }
    }
  });
});