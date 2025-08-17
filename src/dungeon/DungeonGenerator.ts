/**
 * Dungeon generation system
 * Implements grid-based dungeon generation with 9-division layout
 */

import { Position } from '../types/core';
import {
  Dungeon,
  DungeonCell,
  Room,
  DungeonGenerationParams
} from '../types/dungeon';

interface GridCell {
  x: number;
  y: number;
  width: number;
  height: number;
  occupied: boolean;
}

export class DungeonGenerator {
  private rng: () => number;
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed || Math.floor(Math.random() * 1000000);
    this.rng = this.createSeededRandom(this.seed);
  }

  /**
   * Generate a complete dungeon using 9-division grid system
   */
  generateDungeon(
    dungeonId: string,
    dungeonName: string,
    floor: number,
    params: DungeonGenerationParams
  ): Dungeon {
    // Initialize empty dungeon
    const dungeon: Dungeon = {
      id: dungeonId,
      name: dungeonName,
      floor,
      width: params.width,
      height: params.height,
      cells: this.initializeCells(params.width, params.height),
      rooms: [],
      playerSpawn: { x: 0, y: 0 },
      generationSeed: this.seed
    };

    // Generate rooms using new grid-based algorithm
    this.generateGridBasedRooms(dungeon, params);

    // Connect rooms with corridors
    this.connectRooms(dungeon, params);

    // Place stairs
    this.placeStairs(dungeon, params);

    // Set player spawn point
    this.setPlayerSpawn(dungeon);

    return dungeon;
  }

  /**
   * Initialize dungeon cells with walls
   */
  private initializeCells(width: number, height: number): DungeonCell[][] {
    const cells: DungeonCell[][] = [];

    for (let y = 0; y < height; y++) {
      cells[y] = [];
      for (let x = 0; x < width; x++) {
        cells[y][x] = {
          type: 'wall',
          walkable: false,
          transparent: false,
          entities: []
        };
      }
    }

    return cells;
  }

  /**
   * Generate rooms using 9-division grid system
   */
  private generateGridBasedRooms(dungeon: Dungeon, params: DungeonGenerationParams): void {
    // Create 9-division grid (3x3)
    const grid = this.create9DivisionGrid(dungeon.width, dungeon.height);

    // Randomly decide how many rooms to create (4-9)
    const roomCount = this.randomInt(4, 9);

    // Shuffle grid cells for random selection
    const shuffledGrid = this.shuffleArray([...grid]);

    // Generate rooms in selected grid cells
    for (let i = 0; i < roomCount && i < shuffledGrid.length; i++) {
      const gridCell = shuffledGrid[i];
      const room = this.createRoomInGridCell(gridCell, i, params);

      if (room) {
        this.carveRoom(dungeon, room);
        dungeon.rooms.push(room);
        gridCell.occupied = true;
      }
    }
  }

  /**
   * Create 9-division grid (3x3)
   */
  private create9DivisionGrid(dungeonWidth: number, dungeonHeight: number): GridCell[] {
    const grid: GridCell[] = [];

    // 3x3 grid layout
    const cols = 3;
    const rows = 3;

    const cellWidth = Math.floor(dungeonWidth / cols);
    const cellHeight = Math.floor(dungeonHeight / rows);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        grid.push({
          x: col * cellWidth,
          y: row * cellHeight,
          width: cellWidth,
          height: cellHeight,
          occupied: false
        });
      }
    }

    return grid;
  }

  /**
   * Create a room within a grid cell with minimum size constraints
   */
  private createRoomInGridCell(gridCell: GridCell, roomIndex: number, params: DungeonGenerationParams): Room | null {
    // Minimum room size (ensure rooms are not too small)
    const minSize = Math.max(params.minRoomSize, 5);
    const maxSize = params.maxRoomSize;

    // Calculate available space in grid cell (with padding)
    const padding = 2;
    const availableWidth = gridCell.width - padding * 2;
    const availableHeight = gridCell.height - padding * 2;

    // Check if we can fit minimum room size
    if (availableWidth < minSize || availableHeight < minSize) {
      return null;
    }

    // Generate room dimensions within constraints
    const roomWidth = this.randomInt(
      minSize,
      Math.min(maxSize, availableWidth)
    );
    const roomHeight = this.randomInt(
      minSize,
      Math.min(maxSize, availableHeight)
    );

    // Position room randomly within grid cell
    const maxX = gridCell.x + gridCell.width - roomWidth - padding;
    const maxY = gridCell.y + gridCell.height - roomHeight - padding;
    const roomX = this.randomInt(gridCell.x + padding, maxX);
    const roomY = this.randomInt(gridCell.y + padding, maxY);

    return {
      id: `room-${roomIndex}`,
      x: roomX,
      y: roomY,
      width: roomWidth,
      height: roomHeight,
      type: 'normal',
      connected: false,
      connections: []
    };
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Carve out a room in the dungeon
   */
  private carveRoom(dungeon: Dungeon, room: Room): void {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        dungeon.cells[y][x] = {
          type: 'floor',
          walkable: true,
          transparent: true,
          entities: []
        };
      }
    }
  }

  /**
   * Connect all rooms with corridors
   */
  private connectRooms(dungeon: Dungeon, params: DungeonGenerationParams): void {
    if (dungeon.rooms.length === 0) return;

    // Start with the first room
    dungeon.rooms[0].connected = true;
    const connectedRooms = [dungeon.rooms[0]];
    const unconnectedRooms = dungeon.rooms.slice(1);

    // Connect each unconnected room to the nearest connected room
    while (unconnectedRooms.length > 0) {
      let bestConnection: { from: Room; to: Room; distance: number } | null = null;

      // Find the closest pair of connected/unconnected rooms
      for (const connectedRoom of connectedRooms) {
        for (const unconnectedRoom of unconnectedRooms) {
          const distance = this.getRoomDistance(connectedRoom, unconnectedRoom);

          if (!bestConnection || distance < bestConnection.distance) {
            bestConnection = { from: connectedRoom, to: unconnectedRoom, distance };
          }
        }
      }

      if (bestConnection) {
        // Create corridor between rooms
        const corridor = this.createCorridor(dungeon, bestConnection.from, bestConnection.to, params);

        // Add connection to both rooms
        bestConnection.from.connections.push({
          roomId: bestConnection.to.id,
          corridorPath: corridor
        });

        bestConnection.to.connections.push({
          roomId: bestConnection.from.id,
          corridorPath: corridor
        });

        // Move room to connected list
        bestConnection.to.connected = true;
        connectedRooms.push(bestConnection.to);
        const index = unconnectedRooms.indexOf(bestConnection.to);
        unconnectedRooms.splice(index, 1);
      }
    }
  }



  /**
   * Calculate distance between two rooms (center to center)
   */
  private getRoomDistance(room1: Room, room2: Room): number {
    const center1 = {
      x: room1.x + Math.floor(room1.width / 2),
      y: room1.y + Math.floor(room1.height / 2)
    };
    const center2 = {
      x: room2.x + Math.floor(room2.width / 2),
      y: room2.y + Math.floor(room2.height / 2)
    };

    return Math.abs(center1.x - center2.x) + Math.abs(center1.y - center2.y);
  }

  /**
   * Create a corridor between two rooms using room edge connection points
   */
  private createCorridor(dungeon: Dungeon, from: Room, to: Room, params: DungeonGenerationParams): Position[] {
    // Find optimal connection points on room edges
    const fromExit = this.findRoomExitPoint(from, to);
    const toEntrance = this.findRoomEntrancePoint(to, from);

    const path: Position[] = [];
    let current = { ...fromExit };

    // Create L-shaped corridor from exit to entrance
    // Move horizontally first
    while (current.x !== toEntrance.x) {
      if (current.x < toEntrance.x) {
        current.x++;
      } else {
        current.x--;
      }
      path.push({ ...current });
      this.carveCorridor(dungeon, current, params.corridorWidth);
    }

    // Move vertically
    while (current.y !== toEntrance.y) {
      if (current.y < toEntrance.y) {
        current.y++;
      } else {
        current.y--;
      }
      path.push({ ...current });
      this.carveCorridor(dungeon, current, params.corridorWidth);
    }

    return path;
  }

  /**
   * Find the best exit point on the edge of a room facing another room
   */
  private findRoomExitPoint(room: Room, targetRoom: Room): Position {
    const roomCenter = {
      x: room.x + Math.floor(room.width / 2),
      y: room.y + Math.floor(room.height / 2)
    };
    const targetCenter = {
      x: targetRoom.x + Math.floor(targetRoom.width / 2),
      y: targetRoom.y + Math.floor(targetRoom.height / 2)
    };

    // Determine which edge to use based on direction to target
    const dx = targetCenter.x - roomCenter.x;
    const dy = targetCenter.y - roomCenter.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection - use left or right edge
      if (dx > 0) {
        // Target is to the right, use right edge
        return {
          x: room.x + room.width - 1,
          y: roomCenter.y
        };
      } else {
        // Target is to the left, use left edge
        return {
          x: room.x,
          y: roomCenter.y
        };
      }
    } else {
      // Vertical connection - use top or bottom edge
      if (dy > 0) {
        // Target is below, use bottom edge
        return {
          x: roomCenter.x,
          y: room.y + room.height - 1
        };
      } else {
        // Target is above, use top edge
        return {
          x: roomCenter.x,
          y: room.y
        };
      }
    }
  }

  /**
   * Find the best entrance point on the edge of a room from another room
   */
  private findRoomEntrancePoint(room: Room, sourceRoom: Room): Position {
    const roomCenter = {
      x: room.x + Math.floor(room.width / 2),
      y: room.y + Math.floor(room.height / 2)
    };
    const sourceCenter = {
      x: sourceRoom.x + Math.floor(sourceRoom.width / 2),
      y: sourceRoom.y + Math.floor(sourceRoom.height / 2)
    };

    // Determine which edge to use based on direction from source
    const dx = roomCenter.x - sourceCenter.x;
    const dy = roomCenter.y - sourceCenter.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection - use left or right edge
      if (dx > 0) {
        // Source is to the left, use left edge
        return {
          x: room.x,
          y: roomCenter.y
        };
      } else {
        // Source is to the right, use right edge
        return {
          x: room.x + room.width - 1,
          y: roomCenter.y
        };
      }
    } else {
      // Vertical connection - use top or bottom edge
      if (dy > 0) {
        // Source is above, use top edge
        return {
          x: roomCenter.x,
          y: room.y
        };
      } else {
        // Source is below, use bottom edge
        return {
          x: roomCenter.x,
          y: room.y + room.height - 1
        };
      }
    }
  }

  /**
   * Carve corridor at position
   */
  private carveCorridor(dungeon: Dungeon, position: Position, width: number): void {
    const halfWidth = Math.floor(width / 2);

    for (let dy = -halfWidth; dy <= halfWidth; dy++) {
      for (let dx = -halfWidth; dx <= halfWidth; dx++) {
        const x = position.x + dx;
        const y = position.y + dy;

        if (x >= 0 && x < dungeon.width && y >= 0 && y < dungeon.height) {
          if (dungeon.cells[y][x].type === 'wall') {
            dungeon.cells[y][x] = {
              type: 'floor',
              walkable: true,
              transparent: true,
              entities: []
            };
          }
        }
      }
    }
  }

  /**
   * Place stairs in the dungeon
   */
  private placeStairs(dungeon: Dungeon, params: DungeonGenerationParams): void {
    if (dungeon.rooms.length === 0) return;

    const direction = params.progressionDirection || 'down';

    if (direction === 'down') {
      // Only stairs-down per floor
      const lastRoom = dungeon.rooms[dungeon.rooms.length - 1];
      const stairsDown = {
        x: lastRoom.x + Math.floor(lastRoom.width / 2),
        y: lastRoom.y + Math.floor(lastRoom.height / 2)
      };
      dungeon.stairsDown = stairsDown;
      dungeon.cells[stairsDown.y][stairsDown.x].type = 'stairs-down';
      // Ensure no stairs-up
      dungeon.stairsUp = undefined;
    } else {
      // direction === 'up' → Only stairs-up per floor
      const firstRoom = dungeon.rooms[0];
      const stairsUp = {
        x: firstRoom.x + Math.floor(firstRoom.width / 2),
        y: firstRoom.y + Math.floor(firstRoom.height / 2)
      };
      dungeon.stairsUp = stairsUp;
      dungeon.cells[stairsUp.y][stairsUp.x].type = 'stairs-up';
      // Ensure no stairs-down
      dungeon.stairsDown = undefined;
    }
  }

  /**
   * Set player spawn point
   */
  private setPlayerSpawn(dungeon: Dungeon): void {
    if (dungeon.rooms.length === 0) {
      dungeon.playerSpawn = { x: 1, y: 1 };
      return;
    }

    // Spawn in the first room, avoiding stairs
    const firstRoom = dungeon.rooms[0];
    let spawnX = firstRoom.x + 1;
    let spawnY = firstRoom.y + 1;

    // If stairs up exists in first room, offset spawn position
    if (dungeon.stairsUp) {
      if (spawnX === dungeon.stairsUp.x && spawnY === dungeon.stairsUp.y) {
        spawnX = Math.min(spawnX + 1, firstRoom.x + firstRoom.width - 1);
      }
    }

    dungeon.playerSpawn = { x: spawnX, y: spawnY };
  }

  /**
   * Create seeded random number generator
   */
  private createSeededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  /**
   * Get the current seed
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Reset with new seed
   */
  setSeed(seed: number): void {
    this.seed = seed;
    this.rng = this.createSeededRandom(seed);
  }
}