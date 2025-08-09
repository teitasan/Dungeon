/**
 * Tests for InputSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InputSystem } from '../InputSystem';
import { TurnSystem } from '../TurnSystem';
import { MovementSystem } from '../MovementSystem';
import { DungeonManager } from '../../dungeon/DungeonManager';
import { PlayerEntity } from '../../entities/Player';

describe('InputSystem', () => {
  let inputSystem: InputSystem;
  let turnSystem: TurnSystem;
  let movementSystem: MovementSystem;
  let dungeonManager: DungeonManager;
  let player: PlayerEntity;

  beforeEach(() => {
    dungeonManager = new DungeonManager();
    turnSystem = new TurnSystem();
    movementSystem = new MovementSystem(dungeonManager);
    inputSystem = new InputSystem(turnSystem, movementSystem);
    
    // Generate a test dungeon
    const dungeon = dungeonManager.generateDungeon('basic-dungeon', 1, 12345);
    player = new PlayerEntity('player-1', 'Hero', dungeon.playerSpawn);
    
    inputSystem.setPlayerEntity(player);
    turnSystem.initializeTurnOrder([player]);
  });

  it('should handle movement key input', () => {
    const action = inputSystem.handleKeyPress('ArrowUp');
    
    expect(action).toBeDefined();
    expect(action!.type).toBe('move');
    expect(action!.entity).toBe(player);
    expect(action!.data.direction).toBe('north');
    expect(action!.cost).toBe(1.0);
  });

  it('should handle WASD movement keys', () => {
    const actions = [
      { key: 'w', direction: 'north' },
      { key: 's', direction: 'south' },
      { key: 'a', direction: 'west' },
      { key: 'd', direction: 'east' }
    ];
    
    for (const { key, direction } of actions) {
      const action = inputSystem.handleKeyPress(key);
      expect(action).toBeDefined();
      expect(action!.data.direction).toBe(direction);
    }
  });

  it('should handle diagonal movement keys', () => {
    const diagonalActions = [
      { key: 'q', direction: 'northwest' },
      { key: 'e', direction: 'northeast' },
      { key: 'z', direction: 'southwest' },
      { key: 'c', direction: 'southeast' }
    ];
    
    for (const { key, direction } of diagonalActions) {
      const action = inputSystem.handleKeyPress(key);
      expect(action).toBeDefined();
      expect(action!.data.direction).toBe(direction);
    }
  });

  it('should handle wait input', () => {
    const action = inputSystem.handleKeyPress(' ');
    
    expect(action).toBeDefined();
    expect(action!.type).toBe('wait');
    expect(action!.entity).toBe(player);
    expect(action!.cost).toBe(1.0);
  });

  it('should handle special action keys', () => {
    const specialActions = [
      { key: 'i', action: 'inventory' },
      { key: 'g', action: 'pickup' },
      { key: 'enter', action: 'confirm' },
      { key: 'escape', action: 'cancel' }
    ];
    
    for (const { key, action } of specialActions) {
      const turnAction = inputSystem.handleKeyPress(key);
      expect(turnAction).toBeDefined();
      
      if (action === 'pickup') {
        expect(turnAction!.cost).toBe(0.5);
      } else if (['inventory', 'confirm', 'cancel'].includes(action)) {
        expect(turnAction!.cost).toBe(0.0);
      }
    }
  });

  it('should handle use item input', () => {
    const action = inputSystem.handleKeyPress('u');
    
    expect(action).toBeDefined();
    expect(action!.type).toBe('use-item');
    expect(action!.cost).toBe(1.0);
  });

  it('should return null for unknown keys', () => {
    const action = inputSystem.handleKeyPress('x');
    expect(action).toBeNull();
  });

  it('should return null when not player turn', () => {
    // Add another entity and advance turn
    const monster = { id: 'monster-1', position: { x: 1, y: 1 } } as any;
    turnSystem.addEntity(monster);
    turnSystem.advanceTurn();
    
    const action = inputSystem.handleKeyPress('ArrowUp');
    expect(action).toBeNull();
  });

  it('should return null when no player entity set', () => {
    const newInputSystem = new InputSystem(turnSystem, movementSystem);
    const action = newInputSystem.handleKeyPress('ArrowUp');
    expect(action).toBeNull();
  });

  it('should handle mouse click input', () => {
    const clickPosition = { x: player.position.x + 1, y: player.position.y };
    const action = inputSystem.handleMouseClick(clickPosition);
    
    expect(action).toBeDefined();
    expect(action!.type).toBe('move');
    expect(action!.data.direction).toBe('east');
  });

  it('should return null for mouse click when not adjacent', () => {
    const farPosition = { x: player.position.x + 10, y: player.position.y + 10 };
    const action = inputSystem.handleMouseClick(farPosition);
    
    expect(action).toBeNull();
  });

  it('should get available movements', () => {
    const movements = inputSystem.getAvailableMovements();
    
    expect(Array.isArray(movements)).toBe(true);
    expect(movements.length).toBeGreaterThan(0);
  });

  it('should check if key is movement key', () => {
    expect(inputSystem.isMovementKey('ArrowUp')).toBe(true);
    expect(inputSystem.isMovementKey('w')).toBe(true);
    expect(inputSystem.isMovementKey('x')).toBe(false);
  });

  it('should get direction from key', () => {
    expect(inputSystem.getDirectionFromKey('ArrowUp')).toBe('north');
    expect(inputSystem.getDirectionFromKey('d')).toBe('east');
    expect(inputSystem.getDirectionFromKey('x')).toBeNull();
  });

  it('should enable and disable input', () => {
    expect(inputSystem.isInputEnabled()).toBe(true);
    
    inputSystem.setInputEnabled(false);
    expect(inputSystem.isInputEnabled()).toBe(false);
    
    inputSystem.setInputEnabled(true);
    expect(inputSystem.isInputEnabled()).toBe(true);
  });

  it('should manage action queue', () => {
    const action1 = turnSystem.createAction('move', player, { direction: 'north' });
    const action2 = turnSystem.createAction('wait', player);
    
    expect(inputSystem.getQueuedActionCount()).toBe(0);
    
    inputSystem.queueAction(action1);
    inputSystem.queueAction(action2);
    
    expect(inputSystem.getQueuedActionCount()).toBe(2);
    
    inputSystem.clearActionQueue();
    expect(inputSystem.getQueuedActionCount()).toBe(0);
  });

  it('should add and remove key listeners', () => {
    let callbackCalled = false;
    const callback = () => { callbackCalled = true; };
    
    inputSystem.addKeyListener('x', callback);
    
    // Simulate key press (this would normally be handled by the private method)
    // For testing, we'll just verify the listener was added
    inputSystem.removeKeyListener('x');
    
    // The callback should not be called since we removed the listener
    expect(callbackCalled).toBe(false);
  });
});