/**
 * Tests for TrapSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TrapSystem } from '../TrapSystem';
import { DungeonManager } from '../../dungeon/DungeonManager';
import { StatusEffectSystem } from '../StatusEffectSystem';
import { MovementSystem } from '../MovementSystem';
import { PlayerEntity } from '../../entities/Player';
import { MonsterEntity } from '../../entities/Monster';
import { Trap } from '../../types/dungeon';

describe('TrapSystem', () => {
  let trapSystem: TrapSystem;
  let dungeonManager: DungeonManager;
  let statusEffectSystem: StatusEffectSystem;
  let movementSystem: MovementSystem;
  let player: PlayerEntity;
  let monster: MonsterEntity;

  beforeEach(() => {
    dungeonManager = new DungeonManager();
    statusEffectSystem = new StatusEffectSystem();
    movementSystem = new MovementSystem(dungeonManager);
    trapSystem = new TrapSystem(dungeonManager, statusEffectSystem, movementSystem);
    
    // Generate test dungeon
    const dungeon = dungeonManager.generateDungeon('basic-dungeon', 1, 12345);
    
    // Create entities
    player = new PlayerEntity('player-1', 'Hero', dungeon.playerSpawn);
    const monsterPos = { x: dungeon.playerSpawn.x + 2, y: dungeon.playerSpawn.y };
    monster = new MonsterEntity('monster-1', 'Goblin', 'aggressive-hostile', monsterPos);
    
    // Add entities to dungeon
    dungeonManager.addEntity(player, player.position);
    if (dungeonManager.isWalkable(monsterPos)) {
      dungeonManager.addEntity(monster, monsterPos);
    }
  });

  it('should place traps at valid positions', () => {
    const position = { x: 5, y: 5 };
    const success = trapSystem.placeTrap(position, 'spike', false);
    
    expect(success).toBe(true);
    
    const cell = dungeonManager.getCellAt(position);
    expect(cell?.trap).toBeDefined();
    expect(cell?.trap?.type).toBe('spike');
    expect(cell?.trap?.visible).toBe(false);
  });

  it('should not place traps at invalid positions', () => {
    const position = { x: 5, y: 5 };
    
    // Place first trap
    trapSystem.placeTrap(position, 'spike', false);
    
    // Try to place second trap at same position
    const success = trapSystem.placeTrap(position, 'poison', false);
    
    expect(success).toBe(false);
  });

  it('should detect traps with proper chance calculation', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'spike', false);
    
    // Set deterministic RNG for testing
    trapSystem.setRNG(() => 0.05); // 5% - should detect with base 10% chance
    
    const detection = trapSystem.detectTraps(player, position);
    
    expect(detection.detected).toBe(true);
    expect(detection.trap).toBeDefined();
    expect(detection.trap?.visible).toBe(true); // Should become visible after detection
  });

  it('should not detect traps when chance fails', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'spike', false);
    
    // Set RNG to fail detection
    trapSystem.setRNG(() => 0.5); // 50% - should fail with base 10% chance
    
    const detection = trapSystem.detectTraps(player, position);
    
    expect(detection.detected).toBe(false);
    expect(detection.trap).toBeUndefined();
  });

  it('should always detect visible traps', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'spike', true); // Visible trap
    
    const detection = trapSystem.detectTraps(player, position);
    
    expect(detection.detected).toBe(true);
    expect(detection.trap).toBeDefined();
    expect(detection.detectionChance).toBe(1.0);
  });

  it('should activate traps when stepped on', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'spike', false);
    
    // Set RNG to guarantee activation
    trapSystem.setRNG(() => 0.1); // Below 80% activation chance
    
    const activation = trapSystem.checkTrapActivation(player, position);
    
    expect(activation).toBeDefined();
    expect(activation!.success).toBe(true);
    expect(activation!.trap.type).toBe('spike');
    expect(activation!.effects.length).toBeGreaterThan(0);
  });

  it('should handle trap activation failure', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'spike', false);
    
    // Set RNG to fail activation
    trapSystem.setRNG(() => 0.9); // Above 80% activation chance
    
    const activation = trapSystem.checkTrapActivation(player, position);
    
    expect(activation).toBeDefined();
    expect(activation!.success).toBe(false);
    expect(activation!.message).toContain('narrowly avoids');
  });

  it('should apply damage from spike traps', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'spike', false);
    
    const originalHp = player.stats.hp;
    
    // Set RNG to guarantee activation and effect
    trapSystem.setRNG(() => 0.1);
    
    const activation = trapSystem.checkTrapActivation(player, position);
    
    expect(activation).toBeDefined();
    expect(activation!.success).toBe(true);
    expect(player.stats.hp).toBeLessThan(originalHp);
    
    const damageEffect = activation!.effects.find(e => e.type === 'damage');
    expect(damageEffect).toBeDefined();
    expect(damageEffect!.success).toBe(true);
  });

  it('should apply status effects from poison traps', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'poison', false);
    
    // Set RNG to guarantee activation and effect
    trapSystem.setRNG(() => 0.1);
    
    const activation = trapSystem.checkTrapActivation(player, position);
    
    expect(activation).toBeDefined();
    expect(activation!.success).toBe(true);
    
    const statusEffect = activation!.effects.find(e => e.type === 'status-effect');
    expect(statusEffect).toBeDefined();
  });

  it('should handle teleport traps', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'teleport', false);
    
    const originalPosition = { ...player.position };
    
    // Set RNG to guarantee activation and teleport success
    trapSystem.setRNG(() => 0.1);
    
    const activation = trapSystem.checkTrapActivation(player, position);
    
    expect(activation).toBeDefined();
    expect(activation!.success).toBe(true);
    
    const teleportEffect = activation!.effects.find(e => e.type === 'teleport');
    expect(teleportEffect).toBeDefined();
  });

  it('should handle hunger drain traps', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'hunger', false);
    
    const originalHunger = player.hunger;
    
    // Set RNG to guarantee activation
    trapSystem.setRNG(() => 0.1);
    
    const activation = trapSystem.checkTrapActivation(player, position);
    
    expect(activation).toBeDefined();
    expect(activation!.success).toBe(true);
    
    const hungerEffect = activation!.effects.find(e => e.type === 'hunger-drain');
    expect(hungerEffect).toBeDefined();
    expect(player.hunger).toBeLessThan(originalHunger);
  });

  it('should disarm visible traps successfully', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'spike', true); // Visible trap
    
    // Set RNG to guarantee disarm success
    trapSystem.setRNG(() => 0.1); // Below 30% base chance + level bonus
    
    const disarm = trapSystem.disarmTrap(player, position);
    
    expect(disarm.success).toBe(true);
    expect(disarm.message).toContain('successfully disarms');
    
    // Trap should be removed
    const cell = dungeonManager.getCellAt(position);
    expect(cell?.trap).toBeUndefined();
  });

  it('should fail to disarm invisible traps', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'spike', false); // Invisible trap
    
    const disarm = trapSystem.disarmTrap(player, position);
    
    expect(disarm.success).toBe(false);
    expect(disarm.message).toContain('undetected trap');
  });

  it('should handle disarm failure', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'spike', true); // Visible trap
    
    // Set RNG to fail disarm
    trapSystem.setRNG(() => 0.9); // Above disarm chance
    
    const disarm = trapSystem.disarmTrap(player, position);
    
    expect(disarm.success).toBe(false);
    expect(disarm.message).toContain('fails to disarm');
  });

  it('should handle disarm failure with trap trigger', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'spike', true); // Visible trap
    
    let callCount = 0;
    trapSystem.setRNG(() => {
      callCount++;
      if (callCount === 1) return 0.9; // Fail disarm
      if (callCount === 2) return 0.1; // Trigger trap
      return 0.1; // Activate trap effects
    });
    
    const disarm = trapSystem.disarmTrap(player, position);
    
    expect(disarm.success).toBe(false);
    expect(disarm.message).toContain('triggers it');
  });

  it('should not activate already triggered non-reusable traps', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'poison', false); // Non-reusable trap
    
    // Set RNG to guarantee activation
    trapSystem.setRNG(() => 0.1);
    
    // First activation
    const activation1 = trapSystem.checkTrapActivation(player, position);
    expect(activation1).toBeDefined();
    expect(activation1!.success).toBe(true);
    
    // Second activation should return null (trap destroyed)
    const activation2 = trapSystem.checkTrapActivation(player, position);
    expect(activation2).toBeNull();
  });

  it('should reactivate reusable traps', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'spike', false); // Reusable trap
    
    // Set RNG to guarantee activation
    trapSystem.setRNG(() => 0.1);
    
    // First activation
    const activation1 = trapSystem.checkTrapActivation(player, position);
    expect(activation1).toBeDefined();
    expect(activation1!.success).toBe(true);
    expect(activation1!.trapDestroyed).toBe(false);
    
    // Second activation should work
    const activation2 = trapSystem.checkTrapActivation(player, position);
    expect(activation2).toBeDefined();
    expect(activation2!.success).toBe(true);
  });

  it('should get all traps in dungeon', () => {
    trapSystem.placeTrap({ x: 5, y: 5 }, 'spike', false);
    trapSystem.placeTrap({ x: 6, y: 6 }, 'poison', true);
    
    const allTraps = trapSystem.getAllTraps();
    expect(allTraps.length).toBe(2);
    
    const visibleTraps = trapSystem.getVisibleTraps();
    expect(visibleTraps.length).toBe(1);
    expect(visibleTraps[0].trap.type).toBe('poison');
  });

  it('should clear all traps', () => {
    trapSystem.placeTrap({ x: 5, y: 5 }, 'spike', false);
    trapSystem.placeTrap({ x: 6, y: 6 }, 'poison', true);
    
    expect(trapSystem.getAllTraps().length).toBe(2);
    
    trapSystem.clearAllTraps();
    
    expect(trapSystem.getAllTraps().length).toBe(0);
  });

  it('should get trap configurations', () => {
    const configs = trapSystem.getTrapConfigs();
    expect(configs.size).toBeGreaterThan(0);
    
    const spikeConfig = trapSystem.getTrapConfig('spike');
    expect(spikeConfig).toBeDefined();
    expect(spikeConfig!.name).toBe('Spike Trap');
    expect(spikeConfig!.reusable).toBe(true);
  });

  it('should handle stat drain traps', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'stat-drain', false);
    
    const originalAttack = player.stats.attack;
    
    // Set RNG to guarantee activation and effect
    trapSystem.setRNG(() => 0.1);
    
    const activation = trapSystem.checkTrapActivation(player, position);
    
    expect(activation).toBeDefined();
    expect(activation!.success).toBe(true);
    
    const statDrainEffect = activation!.effects.find(e => e.type === 'stat-drain');
    expect(statDrainEffect).toBeDefined();
    expect(player.stats.attack).toBeLessThan(originalAttack);
  });

  it('should handle item destruction traps', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'rust', false);
    
    // Add some items to player inventory
    player.inventory.push({ id: 'item1', name: 'Test Item', type: 'consumable' } as any);
    player.inventory.push({ id: 'item2', name: 'Test Item 2', type: 'consumable' } as any);
    
    const originalInventorySize = player.inventory.length;
    
    // Set RNG to guarantee activation and effect
    trapSystem.setRNG(() => 0.1);
    
    const activation = trapSystem.checkTrapActivation(player, position);
    
    expect(activation).toBeDefined();
    expect(activation!.success).toBe(true);
    
    const itemDestructionEffect = activation!.effects.find(e => e.type === 'item-destruction');
    expect(itemDestructionEffect).toBeDefined();
    expect(player.inventory.length).toBeLessThan(originalInventorySize);
  });

  it('should handle confusion traps', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'confusion', false);
    
    // Set RNG to guarantee activation and effect
    trapSystem.setRNG(() => 0.1);
    
    const activation = trapSystem.checkTrapActivation(player, position);
    
    expect(activation).toBeDefined();
    expect(activation!.success).toBe(true);
    
    const confusionEffect = activation!.effects.find(e => e.type === 'confusion');
    expect(confusionEffect).toBeDefined();
  });

  it('should handle entities without required properties gracefully', () => {
    const position = { x: 5, y: 5 };
    trapSystem.placeTrap(position, 'hunger', false);
    
    // Set RNG to guarantee activation
    trapSystem.setRNG(() => 0.1);
    
    // Test with monster (no hunger property)
    const activation = trapSystem.checkTrapActivation(monster, position);
    
    expect(activation).toBeDefined();
    expect(activation!.success).toBe(true);
    
    const hungerEffect = activation!.effects.find(e => e.type === 'hunger-drain');
    expect(hungerEffect).toBeDefined();
    expect(hungerEffect!.success).toBe(false); // Should fail for entities without hunger
  });
});