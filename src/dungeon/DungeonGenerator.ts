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

    // Add corridors from empty grid cells to nearby rooms
    this.addCorridorsFromEmptyGrids(dungeon, params);
  }

  /**
   * Add corridors from empty grid cells to nearby rooms
   */
  private addCorridorsFromEmptyGrids(dungeon: Dungeon, params: DungeonGenerationParams): void {
    // Create 3x3 grid for reference
    const gridSize = 3;
    const cellWidth = Math.floor(dungeon.width / gridSize);
    const cellHeight = Math.floor(dungeon.height / gridSize);
    
    // Find empty grid cells
    const emptyGridCells: { row: number; col: number; x: number; y: number }[] = [];
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const gridX = col * cellWidth;
        const gridY = row * cellHeight;
        
        // Check if this grid cell is truly empty (no rooms AND no existing corridors)
        let isEmpty = true;
        
        // Check for rooms
        for (const room of dungeon.rooms) {
          if (room.x >= gridX && room.x < gridX + cellWidth &&
              room.y >= gridY && room.y < gridY + cellHeight) {
            isEmpty = false;
            break;
          }
        }
        
        // Check for existing corridors
        if (isEmpty) {
          for (let y = gridY; y < gridY + cellHeight && isEmpty; y++) {
            for (let x = gridX; x < gridX + cellWidth; x++) {
              // セルの存在チェックを追加
              if (dungeon.cells[y] && dungeon.cells[y][x] && dungeon.cells[y][x].type === 'floor') {
                // Found existing corridor, mark as not empty
                isEmpty = false;
                break;
              }
            }
          }
        }
        
        if (isEmpty) {
          emptyGridCells.push({ row, col, x: gridX, y: gridY });
        }
      }
    }
    
    // Group adjacent empty grid cells
    const gridGroups = this.groupAdjacentEmptyGrids(emptyGridCells, gridSize);
    
    // Create corridors for each group
    for (const group of gridGroups) {
      // Calculate center position for the entire group
      const groupCenter = this.calculateGroupCenter(group, cellWidth, cellHeight);
      
      // Add 1-tile corridor at group center as base
      this.carveCorridor(dungeon, groupCenter, params.corridorWidth);
      
      // Find 2 closest rooms to this group center
      const roomDistances = dungeon.rooms.map(room => {
        const roomCenter = {
          x: room.x + Math.floor(room.width / 2),
          y: room.y + Math.floor(room.height / 2)
        };
        const distance = Math.abs(groupCenter.x - roomCenter.x) + Math.abs(groupCenter.y - roomCenter.y);
        return { room, distance };
      });
      
      // Sort by distance and take 2 closest
      roomDistances.sort((a, b) => a.distance - b.distance);
      const closestRooms = roomDistances.slice(0, 2);
      
      // Connect group center to each of the 2 closest rooms
      for (const { room } of closestRooms) {
        const roomCenter = {
          x: room.x + Math.floor(room.width / 2),
          y: room.y + Math.floor(room.height / 2)
        };
        
        // Create corridor from group center to room center
        this.createCorridorPath(dungeon, groupCenter, roomCenter, params);
      }
    }
  }

  /**
   * Group adjacent empty grid cells
   */
  private groupAdjacentEmptyGrids(emptyCells: { row: number; col: number; x: number; y: number }[], gridSize: number): { row: number; col: number; x: number; y: number }[][] {
    const groups: { row: number; col: number; x: number; y: number }[][] = [];
    const visited = new Set<string>();
    
    for (const cell of emptyCells) {
      if (visited.has(`${cell.row},${cell.col}`)) continue;
      
      const group: { row: number; col: number; x: number; y: number }[] = [];
      this.dfsGroupAdjacent(cell, emptyCells, visited, group, gridSize);
      groups.push(group);
    }
    
    return groups;
  }

  /**
   * DFS to find adjacent empty grid cells
   */
  private dfsGroupAdjacent(cell: { row: number; col: number; x: number; y: number }, 
                          allCells: { row: number; col: number; x: number; y: number }[], 
                          visited: Set<string>, 
                          group: { row: number; col: number; x: number; y: number }[], 
                          gridSize: number): void {
    const key = `${cell.row},${cell.col}`;
    if (visited.has(key)) return;
    
    visited.add(key);
    group.push(cell);
    
    // Check 4 adjacent directions
    const directions = [
      { row: cell.row - 1, col: cell.col }, // up
      { row: cell.row + 1, col: cell.col }, // down
      { row: cell.row, col: cell.col - 1 }, // left
      { row: cell.row, col: cell.col + 1 }  // right
    ];
    
    for (const dir of directions) {
      if (dir.row >= 0 && dir.row < gridSize && dir.col >= 0 && dir.col < gridSize) {
        const adjacentCell = allCells.find(c => c.row === dir.row && c.col === dir.col);
        if (adjacentCell) {
          this.dfsGroupAdjacent(adjacentCell, allCells, visited, group, gridSize);
        }
      }
    }
  }

  /**
   * Calculate center position for a group of empty grid cells
   */
  private calculateGroupCenter(group: { row: number; col: number; x: number; y: number }[], cellWidth: number, cellHeight: number): Position {
    // Calculate the center of the group's bounding box
    const minRow = Math.min(...group.map(c => c.row));
    const maxRow = Math.max(...group.map(c => c.row));
    const minCol = Math.min(...group.map(c => c.col));
    const maxCol = Math.max(...group.map(c => c.col));
    
    const centerRow = minRow + (maxRow - minRow) / 2;
    const centerCol = minCol + (maxCol - minCol) / 2;
    
    return {
      x: centerCol * cellWidth + Math.floor(cellWidth / 2),
      y: centerRow * cellHeight + Math.floor(cellHeight / 2)
    };
  }

  /**
   * Create a simple corridor path between two positions
   */
  private createCorridorPath(dungeon: Dungeon, start: Position, end: Position, params: DungeonGenerationParams): void {
    let current = { ...start };
    
    // Simple L-shaped path
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Move horizontally first, then vertically
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal first
      while (current.x !== end.x) {
        current.x += current.x < end.x ? 1 : -1;
        this.carveCorridor(dungeon, current, params.corridorWidth);
      }
      // Then vertical
      while (current.y !== end.y) {
        current.y += current.y < end.y ? 1 : -1;
        this.carveCorridor(dungeon, current, params.corridorWidth);
      }
    } else {
      // Vertical first
      while (current.y !== end.y) {
        current.y += current.y < end.y ? 1 : -1;
        this.carveCorridor(dungeon, current, params.corridorWidth);
      }
      // Then horizontal
      while (current.x !== end.x) {
        current.x += current.x < end.x ? 1 : -1;
        this.carveCorridor(dungeon, current, params.corridorWidth);
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
   * Create a corridor between two rooms with varied path patterns
   */
  private createCorridor(dungeon: Dungeon, from: Room, to: Room, params: DungeonGenerationParams): Position[] {
    // Find optimal connection points on room edges
    const fromExit = this.findRoomExitPoint(from, to);
    const toEntrance = this.findRoomEntrancePoint(to, from);

    // Use specified corridor generation rule
    return this.createRuleBasedCorridor(dungeon, fromExit, toEntrance, params);
  }

  /**
   * Create corridor following the specified rule
   */
  private createRuleBasedCorridor(dungeon: Dungeon, start: Position, end: Position, params: DungeonGenerationParams): Position[] {
    const path: Position[] = [];
    
    // 1. Calculate midpoint between rooms based on Manhattan distance
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const manhattanDistance = Math.abs(dx) + Math.abs(dy);
    
    // Set midpoint based on Manhattan distance, not fixed x,y
    const midpoint = {
      x: start.x + Math.floor(dx / 2),
      y: start.y + Math.floor(dy / 2)
    };

    // 2. Extend corridor from start room toward midpoint
    let currentStart = { ...start };
    const startPath: Position[] = [];
    
    // Choose which direction to extend first based on distance
    const extendXFirst = Math.abs(dx) > Math.abs(dy);
    
    if (extendXFirst) {
      // Extend horizontally first from start room
      while (currentStart.x !== midpoint.x) {
        currentStart.x += currentStart.x < midpoint.x ? 1 : -1;
        startPath.push({ ...currentStart });
        this.carveCorridor(dungeon, currentStart, params.corridorWidth);
      }
      
      // Then extend vertically to reach midpoint
      while (currentStart.y !== midpoint.y) {
        currentStart.y += currentStart.y < midpoint.y ? 1 : -1;
        startPath.push({ ...currentStart });
        this.carveCorridor(dungeon, currentStart, params.corridorWidth);
      }
    } else {
      // Extend vertically first from start room
      while (currentStart.y !== midpoint.y) {
        currentStart.y += currentStart.y < midpoint.y ? 1 : -1;
        startPath.push({ ...currentStart });
        this.carveCorridor(dungeon, currentStart, params.corridorWidth);
      }
      
      // Then extend horizontally to reach midpoint
      while (currentStart.x !== midpoint.x) {
        currentStart.x += currentStart.x < midpoint.x ? 1 : -1;
        startPath.push({ ...currentStart });
        this.carveCorridor(dungeon, currentStart, params.corridorWidth);
      }
    }

    // 3. Extend corridor from end room toward midpoint
    let currentEnd = { ...end };
    const endPath: Position[] = [];
    
    if (extendXFirst) {
      // Extend horizontally first from end room
      while (currentEnd.x !== midpoint.x) {
        currentEnd.x += currentEnd.x < midpoint.x ? 1 : -1;
        endPath.push({ ...currentEnd });
        this.carveCorridor(dungeon, currentEnd, params.corridorWidth);
      }
      
      // Then extend vertically to reach midpoint
      while (currentEnd.y !== midpoint.y) {
        currentEnd.y += currentEnd.y < midpoint.y ? 1 : -1;
        endPath.push({ ...currentEnd });
        this.carveCorridor(dungeon, currentEnd, params.corridorWidth);
      }
    } else {
      // Extend vertically first from end room
      while (currentEnd.y !== midpoint.y) {
        currentEnd.y += currentEnd.y < midpoint.y ? 1 : -1;
        endPath.push({ ...currentEnd });
        this.carveCorridor(dungeon, currentEnd, params.corridorWidth);
      }
      
      // Then extend horizontally to reach midpoint
      while (currentEnd.x !== midpoint.x) {
        currentEnd.x += currentEnd.x < midpoint.x ? 1 : -1;
        endPath.push({ ...currentEnd });
        this.carveCorridor(dungeon, currentEnd, params.corridorWidth);
      }
    }

    // Combine both paths
    path.push(...startPath, ...endPath);
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
          // セルの存在チェックを追加
          if (dungeon.cells[y] && dungeon.cells[y][x] && dungeon.cells[y][x].type === 'wall') {
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
      // セルの存在チェックを追加
      if (dungeon.cells[stairsDown.y] && dungeon.cells[stairsDown.y][stairsDown.x]) {
        dungeon.cells[stairsDown.y][stairsDown.x].type = 'stairs-down';
      }
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
      // セルの存在チェックを追加
      if (dungeon.cells[stairsUp.y] && dungeon.cells[stairsUp.y][stairsUp.x]) {
        dungeon.cells[stairsUp.y][stairsUp.x].type = 'stairs-up';
      }
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