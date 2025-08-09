/**
 * Tests for DungeonManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DungeonManager } from '../DungeonManager';
import { PlayerEntity } from '../../entities/Player';
import { Position } from '../../types/core';

describe('DungeonManager', () => {
  let manager: DungeonManager;

  beforeEach(() => {
    manager = new DungeonManager();
  });

  it('should initialize with default templates', () => {
    const templateIds = manager.getTemplateIds();
    
    expect(templateIds).toContain('basic-dungeon');
    expect(templateIds).toContain('large-dungeon');
    expect(templateIds.length).toBeGreaterThanOrEqual(2);
  });

  it('should generate dungeon from template', () => {
    const dungeon = manager.generateDungeon('basic-dungeon', 1);
    
    expect(dungeon).toBeDefined();
    expect(dungeon.id).toBe('basic-dungeon-floor-1');
    expect(dungeon.name).toBe('Basic Dungeon Floor 1');
    expect(dungeon.floor).toBe(1);
    expect(manager.getCurrentDungeon()).toBe(dungeon);
  });

  it('should throw error for unknown template', () => {
    expect(() => {
      manager.generateDungeon('unknown-template', 1);
    }).toThrow('Dungeon template not found: unknown-template');
  });

  it('should get cell at position', () => {
    const dungeon = manager.generateDungeon('basic-dungeon', 1);
    
    const cell = manager.getCellAt({ x: 0, y: 0 });
    expect(cell).toBeDefined();
    expect(cell?.type).toBe('wall');
    
    const invalidCell = manager.getCellAt({ x: -1, y: -1 });
    expect(invalidCell).toBeNull();
    
    const outOfBoundsCell = manager.getCellAt({ x: 1000, y: 1000 });
    expect(outOfBoundsCell).toBeNull();
  });

  it('should check walkability correctly', () => {
    const dungeon = manager.generateDungeon('basic-dungeon', 1);
    
    // Wall should not be walkable
    expect(manager.isWalkable({ x: 0, y: 0 })).toBe(false);
    
    // Player spawn should be walkable
    expect(manager.isWalkable(dungeon.playerSpawn)).toBe(true);
    
    // Out of bounds should not be walkable
    expect(manager.isWalkable({ x: -1, y: -1 })).toBe(false);
  });

  it('should check transparency correctly', () => {
    const dungeon = manager.generateDungeon('basic-dungeon', 1);
    
    // Wall should not be transparent
    expect(manager.isTransparent({ x: 0, y: 0 })).toBe(false);
    
    // Player spawn should be transparent
    expect(manager.isTransparent(dungeon.playerSpawn)).toBe(true);
  });

  it('should manage entities correctly', () => {
    const dungeon = manager.generateDungeon('basic-dungeon', 1);
    const player = new PlayerEntity('player-1', 'Hero', dungeon.playerSpawn);
    
    // Add entity
    expect(manager.addEntity(player, dungeon.playerSpawn)).toBe(true);
    expect(manager.getEntitiesAt(dungeon.playerSpawn)).toContain(player);
    expect(manager.getAllEntities()).toContain(player);
    
    // Move entity
    const newPosition = { x: dungeon.playerSpawn.x + 1, y: dungeon.playerSpawn.y };
    if (manager.isWalkable(newPosition)) {
      expect(manager.moveEntity(player, newPosition)).toBe(true);
      expect(player.position).toEqual(newPosition);
      expect(manager.getEntitiesAt(dungeon.playerSpawn)).not.toContain(player);
      expect(manager.getEntitiesAt(newPosition)).toContain(player);
    }
    
    // Remove entity
    expect(manager.removeEntity(player)).toBe(true);
    expect(manager.getAllEntities()).not.toContain(player);
  });

  it('should not add entity to invalid position', () => {
    manager.generateDungeon('basic-dungeon', 1);
    const player = new PlayerEntity('player-1', 'Hero', { x: 0, y: 0 });
    
    // Try to add to wall
    expect(manager.addEntity(player, { x: 0, y: 0 })).toBe(false);
    
    // Try to add out of bounds
    expect(manager.addEntity(player, { x: -1, y: -1 })).toBe(false);
  });

  it('should not move entity to invalid position', () => {
    const dungeon = manager.generateDungeon('basic-dungeon', 1);
    const player = new PlayerEntity('player-1', 'Hero', dungeon.playerSpawn);
    
    manager.addEntity(player, dungeon.playerSpawn);
    
    // Try to move to wall
    expect(manager.moveEntity(player, { x: 0, y: 0 })).toBe(false);
    expect(player.position).toEqual(dungeon.playerSpawn);
  });

  it('should get adjacent positions correctly', () => {
    manager.generateDungeon('basic-dungeon', 1);
    
    const center = { x: 5, y: 5 };
    const adjacent = manager.getAdjacentPositions(center);
    
    expect(adjacent).toHaveLength(4);
    expect(adjacent).toContainEqual({ x: 5, y: 4 }); // North
    expect(adjacent).toContainEqual({ x: 6, y: 5 }); // East
    expect(adjacent).toContainEqual({ x: 5, y: 6 }); // South
    expect(adjacent).toContainEqual({ x: 4, y: 5 }); // West
    
    const adjacentWithDiagonals = manager.getAdjacentPositions(center, true);
    expect(adjacentWithDiagonals).toHaveLength(8);
  });

  it('should calculate distance correctly', () => {
    manager.generateDungeon('basic-dungeon', 1);
    
    const pos1 = { x: 0, y: 0 };
    const pos2 = { x: 3, y: 4 };
    
    expect(manager.getDistance(pos1, pos2)).toBe(7); // Manhattan distance
    expect(manager.getDistance(pos1, pos1)).toBe(0);
  });

  it('should find entities by type', () => {
    const dungeon = manager.generateDungeon('basic-dungeon', 1);
    const player1 = new PlayerEntity('player-1', 'Hero1', dungeon.playerSpawn);
    const player2 = new PlayerEntity('player-2', 'Hero2', { x: dungeon.playerSpawn.x + 1, y: dungeon.playerSpawn.y });
    
    manager.addEntity(player1, dungeon.playerSpawn);
    if (manager.isWalkable({ x: dungeon.playerSpawn.x + 1, y: dungeon.playerSpawn.y })) {
      manager.addEntity(player2, { x: dungeon.playerSpawn.x + 1, y: dungeon.playerSpawn.y });
    }
    
    const players = manager.findEntitiesByType((entity): entity is PlayerEntity => 
      entity instanceof PlayerEntity
    );
    
    expect(players).toContain(player1);
    if (manager.isWalkable({ x: dungeon.playerSpawn.x + 1, y: dungeon.playerSpawn.y })) {
      expect(players).toContain(player2);
    }
  });

  it('should find simple paths', () => {
    const dungeon = manager.generateDungeon('basic-dungeon', 1);
    
    // Find a walkable position near spawn
    let targetPos: Position | null = null;
    for (const adjacent of manager.getAdjacentPositions(dungeon.playerSpawn)) {
      if (manager.isWalkable(adjacent)) {
        targetPos = adjacent;
        break;
      }
    }
    
    if (targetPos) {
      const path = manager.findPath(dungeon.playerSpawn, targetPos);
      expect(path).toHaveLength(1);
      expect(path[0]).toEqual(targetPos);
    }
  });

  it('should return empty path when no path exists', () => {
    const dungeon = manager.generateDungeon('basic-dungeon', 1);
    
    // Try to find path to a wall
    const path = manager.findPath(dungeon.playerSpawn, { x: 0, y: 0 });
    expect(path).toEqual([]);
  });

  it('should register and retrieve custom templates', () => {
    const customTemplate = {
      id: 'custom-dungeon',
      name: 'Custom Dungeon',
      description: 'A custom test dungeon',
      floors: 5,
      generationParams: {
        width: 20,
        height: 15,
        minRooms: 2,
        maxRooms: 4,
        minRoomSize: 3,
        maxRoomSize: 6,
        corridorWidth: 1,
        roomDensity: 0.3,
        specialRoomChance: 0.1,
        trapDensity: 0.05
      },
      tileSet: 'custom',
      monsterTable: [],
      itemTable: [],
      specialRules: []
    };
    
    manager.registerTemplate(customTemplate);
    
    expect(manager.getTemplate('custom-dungeon')).toBe(customTemplate);
    expect(manager.getTemplateIds()).toContain('custom-dungeon');
    
    const dungeon = manager.generateDungeon('custom-dungeon', 1);
    expect(dungeon.width).toBe(20);
    expect(dungeon.height).toBe(15);
  });

  it('should provide dungeon statistics', () => {
    const dungeon = manager.generateDungeon('basic-dungeon', 1);
    const stats = manager.getDungeonStats();
    
    expect(stats).toBeDefined();
    expect(stats!.rooms).toBe(dungeon.rooms.length);
    expect(stats!.totalCells).toBe(dungeon.width * dungeon.height);
    expect(stats!.corridorCells).toBeGreaterThanOrEqual(0);
  });

  it('should return null stats when no dungeon is loaded', () => {
    const emptyManager = new DungeonManager();
    expect(emptyManager.getDungeonStats()).toBeNull();
  });

  it('should handle dungeon state management', () => {
    const dungeon1 = manager.generateDungeon('basic-dungeon', 1);
    expect(manager.getCurrentDungeon()).toBe(dungeon1);
    
    const dungeon2 = manager.generateDungeon('basic-dungeon', 2);
    expect(manager.getCurrentDungeon()).toBe(dungeon2);
    
    manager.setCurrentDungeon(dungeon1);
    expect(manager.getCurrentDungeon()).toBe(dungeon1);
  });
});