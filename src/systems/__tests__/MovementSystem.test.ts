/**
 * Tests for MovementSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MovementSystem } from '../MovementSystem';
import { DungeonManager } from '../../dungeon/DungeonManager';
import { PlayerEntity } from '../../entities/Player';
import { Position } from '../../types/core';

describe('MovementSystem', () => {
  let movementSystem: MovementSystem;
  let dungeonManager: DungeonManager;
  let player: PlayerEntity;

  beforeEach(() => {
    dungeonManager = new DungeonManager();
    movementSystem = new MovementSystem(dungeonManager);
    
    // Generate a test dungeon
    const dungeon = dungeonManager.generateDungeon('basic-dungeon', 1, 12345);
    player = new PlayerEntity('player-1', 'Hero', dungeon.playerSpawn);
    dungeonManager.addEntity(player, dungeon.playerSpawn);
  });

  it('should move entity in valid direction', () => {
    const initialPosition = player.position;
    
    // Find a valid movement direction
    const validDirections = movementSystem.getValidMovements(player);
    expect(validDirections.length).toBeGreaterThan(0);
    
    const direction = validDirections[0];
    const result = movementSystem.moveEntity(player, direction);
    
    expect(result.success).toBe(true);
    expect(result.newPosition).toBeDefined();
    expect(result.newPosition).not.toEqual(initialPosition);
    expect(player.position).toEqual(result.newPosition);
  });

  it('should not move entity into wall', () => {
    // Try to move into a wall (position 0,0 should be a wall)
    const result = movementSystem.moveEntityToPosition(player, { x: 0, y: 0 });
    
    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('not walkable');
  });

  it('should not move entity out of bounds', () => {
    const result = movementSystem.moveEntityToPosition(player, { x: -1, y: -1 });
    
    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('Out of bounds');
  });

  it('should not move entity into occupied space', () => {
    const dungeon = dungeonManager.getCurrentDungeon()!;
    
    // Create another entity at a nearby position
    const nearbyPosition = { x: dungeon.playerSpawn.x + 1, y: dungeon.playerSpawn.y };
    if (dungeonManager.isWalkable(nearbyPosition)) {
      const otherPlayer = new PlayerEntity('player-2', 'Other', nearbyPosition);
      dungeonManager.addEntity(otherPlayer, nearbyPosition);
      
      const result = movementSystem.moveEntityToPosition(player, nearbyPosition);
      
      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('Target cell is occupied');
      expect(result.triggeredEvents).toBeDefined();
      expect(result.triggeredEvents![0].type).toBe('collision');
    }
  });

  it('should allow movement into occupied space with constraints', () => {
    const dungeon = dungeonManager.getCurrentDungeon()!;
    
    // Create another entity at a nearby position
    const nearbyPosition = { x: dungeon.playerSpawn.x + 1, y: dungeon.playerSpawn.y };
    if (dungeonManager.isWalkable(nearbyPosition)) {
      const otherPlayer = new PlayerEntity('player-2', 'Other', nearbyPosition);
      dungeonManager.addEntity(otherPlayer, nearbyPosition);
      
      const result = movementSystem.moveEntityToPosition(
        player, 
        nearbyPosition, 
        { canMoveIntoOccupiedSpace: true }
      );
      
      expect(result.success).toBe(true);
    }
  });

  it('should not allow diagonal movement when constrained', () => {
    const result = movementSystem.moveEntity(
      player, 
      'northeast', 
      { canMoveDiagonally: false }
    );
    
    expect(result.success).toBe(false);
    expect(result.reason).toBe('Diagonal movement not allowed');
  });

  it('should get valid movement directions', () => {
    const validDirections = movementSystem.getValidMovements(player);
    
    expect(Array.isArray(validDirections)).toBe(true);
    expect(validDirections.length).toBeGreaterThan(0);
    
    // All returned directions should be valid
    for (const direction of validDirections) {
      expect(['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'])
        .toContain(direction);
    }
  });

  it('should calculate movement cost correctly', () => {
    const cardinalCost = movementSystem.calculateMovementCost(player, 'north');
    const diagonalCost = movementSystem.calculateMovementCost(player, 'northeast');
    
    expect(cardinalCost).toBe(1.0);
    expect(diagonalCost).toBe(1.4);
  });

  it('should apply speed multiplier to movement cost', () => {
    const normalCost = movementSystem.calculateMovementCost(player, 'north');
    const fastCost = movementSystem.calculateMovementCost(
      player, 
      'north', 
      { movementSpeed: 0.5 }
    );
    
    expect(fastCost).toBe(normalCost * 0.5);
  });

  it('should get direction between positions', () => {
    const from: Position = { x: 5, y: 5 };
    const to: Position = { x: 6, y: 5 };
    
    const direction = movementSystem.getDirectionBetween(from, to);
    expect(direction).toBe('east');
    
    const diagonalTo: Position = { x: 6, y: 4 };
    const diagonalDirection = movementSystem.getDirectionBetween(from, diagonalTo);
    expect(diagonalDirection).toBe('northeast');
    
    const samePosition = movementSystem.getDirectionBetween(from, from);
    expect(samePosition).toBeNull();
  });

  it('should check if positions are adjacent', () => {
    const pos1: Position = { x: 5, y: 5 };
    const pos2: Position = { x: 6, y: 5 };
    const pos3: Position = { x: 6, y: 6 };
    const pos4: Position = { x: 7, y: 5 };
    
    expect(movementSystem.arePositionsAdjacent(pos1, pos2)).toBe(true);
    expect(movementSystem.arePositionsAdjacent(pos1, pos3)).toBe(true);
    expect(movementSystem.arePositionsAdjacent(pos1, pos4)).toBe(false);
    
    // Test without diagonals
    expect(movementSystem.arePositionsAdjacent(pos1, pos2, false)).toBe(true);
    expect(movementSystem.arePositionsAdjacent(pos1, pos3, false)).toBe(false);
  });

  it('should handle invalid direction', () => {
    const result = movementSystem.moveEntity(player, 'invalid' as any);
    
    expect(result.success).toBe(false);
    expect(result.reason).toBe('Invalid direction');
  });

  it('should detect movement events', () => {
    const dungeon = dungeonManager.getCurrentDungeon()!;
    
    // Move to stairs if they exist
    if (dungeon.stairsDown) {
      const result = movementSystem.moveEntityToPosition(player, dungeon.stairsDown);
      
      if (result.success) {
        expect(result.triggeredEvents).toBeDefined();
        const stairEvent = result.triggeredEvents!.find(e => e.type === 'stairs-used');
        expect(stairEvent).toBeDefined();
        expect(stairEvent!.data.stairType).toBe('stairs-down');
      }
    }
  });
});