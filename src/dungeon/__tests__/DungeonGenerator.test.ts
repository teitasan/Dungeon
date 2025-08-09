/**
 * Tests for DungeonGenerator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DungeonGenerator } from '../DungeonGenerator';
import { DungeonGenerationParams } from '../../types/dungeon';

describe('DungeonGenerator', () => {
  let generator: DungeonGenerator;
  let basicParams: DungeonGenerationParams;

  beforeEach(() => {
    generator = new DungeonGenerator(12345); // Fixed seed for consistent tests
    basicParams = {
      width: 30,
      height: 20,
      minRooms: 3,
      maxRooms: 6,
      minRoomSize: 4,
      maxRoomSize: 8,
      corridorWidth: 1,
      roomDensity: 0.3,
      specialRoomChance: 0.1,
      trapDensity: 0.05
    };
  });

  it('should generate a dungeon with correct dimensions', () => {
    const dungeon = generator.generateDungeon('test-dungeon', 'Test Dungeon', 1, basicParams);
    
    expect(dungeon.id).toBe('test-dungeon');
    expect(dungeon.name).toBe('Test Dungeon');
    expect(dungeon.floor).toBe(1);
    expect(dungeon.width).toBe(30);
    expect(dungeon.height).toBe(20);
    expect(dungeon.cells).toHaveLength(20);
    expect(dungeon.cells[0]).toHaveLength(30);
  });

  it('should generate rooms within specified parameters', () => {
    const dungeon = generator.generateDungeon('test-dungeon', 'Test Dungeon', 1, basicParams);
    
    expect(dungeon.rooms.length).toBeGreaterThanOrEqual(basicParams.minRooms);
    expect(dungeon.rooms.length).toBeLessThanOrEqual(basicParams.maxRooms);
    
    for (const room of dungeon.rooms) {
      expect(room.width).toBeGreaterThanOrEqual(basicParams.minRoomSize);
      expect(room.width).toBeLessThanOrEqual(basicParams.maxRoomSize);
      expect(room.height).toBeGreaterThanOrEqual(basicParams.minRoomSize);
      expect(room.height).toBeLessThanOrEqual(basicParams.maxRoomSize);
      
      // Check room is within dungeon bounds
      expect(room.x).toBeGreaterThanOrEqual(1);
      expect(room.y).toBeGreaterThanOrEqual(1);
      expect(room.x + room.width).toBeLessThan(dungeon.width);
      expect(room.y + room.height).toBeLessThan(dungeon.height);
    }
  });

  it('should create floor cells in rooms', () => {
    const dungeon = generator.generateDungeon('test-dungeon', 'Test Dungeon', 1, basicParams);
    
    for (const room of dungeon.rooms) {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          const cell = dungeon.cells[y][x];
          // Cell should be walkable and transparent (floor or stairs)
          expect(cell.walkable).toBe(true);
          expect(cell.transparent).toBe(true);
          // Cell type should be floor or stairs
          expect(['floor', 'stairs-up', 'stairs-down']).toContain(cell.type);
        }
      }
    }
  });

  it('should connect all rooms', () => {
    const dungeon = generator.generateDungeon('test-dungeon', 'Test Dungeon', 1, basicParams);
    
    // All rooms should be marked as connected
    for (const room of dungeon.rooms) {
      expect(room.connected).toBe(true);
    }
  });

  it('should place stairs correctly', () => {
    const dungeon = generator.generateDungeon('test-dungeon', 'Test Dungeon', 2, basicParams);
    
    // Should have stairs down
    expect(dungeon.stairsDown).toBeDefined();
    if (dungeon.stairsDown) {
      const stairsCell = dungeon.cells[dungeon.stairsDown.y][dungeon.stairsDown.x];
      expect(stairsCell.type).toBe('stairs-down');
    }
    
    // Should have stairs up (floor > 1)
    expect(dungeon.stairsUp).toBeDefined();
    if (dungeon.stairsUp) {
      const stairsCell = dungeon.cells[dungeon.stairsUp.y][dungeon.stairsUp.x];
      expect(stairsCell.type).toBe('stairs-up');
    }
  });

  it('should not place stairs up on floor 1', () => {
    const dungeon = generator.generateDungeon('test-dungeon', 'Test Dungeon', 1, basicParams);
    
    expect(dungeon.stairsUp).toBeUndefined();
    expect(dungeon.stairsDown).toBeDefined();
  });

  it('should set player spawn point', () => {
    const dungeon = generator.generateDungeon('test-dungeon', 'Test Dungeon', 1, basicParams);
    
    expect(dungeon.playerSpawn).toBeDefined();
    
    // Player spawn should be on a walkable cell
    const spawnCell = dungeon.cells[dungeon.playerSpawn.y][dungeon.playerSpawn.x];
    expect(spawnCell.walkable).toBe(true);
  });

  it('should generate consistent dungeons with same seed', () => {
    const generator1 = new DungeonGenerator(54321);
    const generator2 = new DungeonGenerator(54321);
    
    const dungeon1 = generator1.generateDungeon('test', 'Test', 1, basicParams);
    const dungeon2 = generator2.generateDungeon('test', 'Test', 1, basicParams);
    
    expect(dungeon1.rooms.length).toBe(dungeon2.rooms.length);
    expect(dungeon1.playerSpawn).toEqual(dungeon2.playerSpawn);
    
    // Check that room positions are the same
    for (let i = 0; i < dungeon1.rooms.length; i++) {
      expect(dungeon1.rooms[i].x).toBe(dungeon2.rooms[i].x);
      expect(dungeon1.rooms[i].y).toBe(dungeon2.rooms[i].y);
      expect(dungeon1.rooms[i].width).toBe(dungeon2.rooms[i].width);
      expect(dungeon1.rooms[i].height).toBe(dungeon2.rooms[i].height);
    }
  });

  it('should generate different dungeons with different seeds', () => {
    const generator1 = new DungeonGenerator(11111);
    const generator2 = new DungeonGenerator(22222);
    
    const dungeon1 = generator1.generateDungeon('test', 'Test', 1, basicParams);
    const dungeon2 = generator2.generateDungeon('test', 'Test', 1, basicParams);
    
    // Should have different layouts (very unlikely to be identical)
    let different = false;
    if (dungeon1.rooms.length !== dungeon2.rooms.length) {
      different = true;
    } else {
      for (let i = 0; i < dungeon1.rooms.length; i++) {
        if (dungeon1.rooms[i].x !== dungeon2.rooms[i].x || 
            dungeon1.rooms[i].y !== dungeon2.rooms[i].y) {
          different = true;
          break;
        }
      }
    }
    
    expect(different).toBe(true);
  });

  it('should handle edge cases with small dungeons', () => {
    const smallParams: DungeonGenerationParams = {
      width: 15,
      height: 10,
      minRooms: 1,
      maxRooms: 2,
      minRoomSize: 3,
      maxRoomSize: 5,
      corridorWidth: 1,
      roomDensity: 0.3,
      specialRoomChance: 0.1,
      trapDensity: 0.05
    };
    
    const dungeon = generator.generateDungeon('small-dungeon', 'Small', 1, smallParams);
    
    expect(dungeon.width).toBe(15);
    expect(dungeon.height).toBe(10);
    expect(dungeon.rooms.length).toBeGreaterThanOrEqual(1);
    expect(dungeon.playerSpawn).toBeDefined();
  });

  it('should maintain seed state correctly', () => {
    const initialSeed = generator.getSeed();
    expect(initialSeed).toBe(12345);
    
    generator.setSeed(99999);
    expect(generator.getSeed()).toBe(99999);
    
    const dungeon = generator.generateDungeon('test', 'Test', 1, basicParams);
    expect(dungeon.generationSeed).toBe(99999);
  });
});