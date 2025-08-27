/**
 * Dungeon generation system
 * Implements grid-based dungeon generation with 12-division layout (4x3)
 */

import { Position } from '../types/core';
import {
  Dungeon,
  DungeonCell,
  Room,
  DungeonGenerationParams
} from '../types/dungeon';

interface GridCell {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  occupied: boolean;
}

export class DungeonGenerator {
  private rng: () => number;
  private seed: number;
  // 追加通路の判定を高速化するためのグリッド占有キャッシュ
  private gridCols: number = 0;
  private gridRows: number = 0;
  // 部屋の占有キャッシュは現状未使用のため保持しない
  private corridorInCell?: boolean[][];

  constructor(seed?: number) {
    this.seed = seed || Math.floor(Math.random() * 1000000);
    this.rng = this.createSeededRandom(this.seed);
  }

  /**
   * Generate a complete dungeon using 12-division grid system (4x3)
   */
  generateDungeon(
    dungeonId: string,
    dungeonName: string,
    floor: number,
    params: DungeonGenerationParams
  ): Dungeon {
    try {
      console.log('[DEBUG] generateDungeon: 開始, ID:', dungeonId, 'フロア:', floor);
      
      // Initialize empty dungeon
      console.log('[DEBUG] ダンジョン初期化中...');
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
      console.log('[DEBUG] ダンジョン初期化完了, サイズ:', dungeon.width, 'x', dungeon.height);

      // Generate rooms using new grid-based algorithm
      console.log('[DEBUG] 部屋生成開始...');
      // グリッド仕様と占有キャッシュを初期化
      const { cols, rows } = this.getGridColsRows(params.gridDivision || 12);
      this.gridCols = cols;
      this.gridRows = rows;
      this.corridorInCell = Array.from({ length: this.gridRows }, () => Array(this.gridCols).fill(false));
      this.generateGridBasedRooms(dungeon, params);
      console.log('[DEBUG] 部屋生成完了');

      // Connect rooms with corridors
      console.log('[DEBUG] 部屋接続開始...');
      this.connectRooms(dungeon, params);
      console.log('[DEBUG] 部屋接続完了');

      // Connect up to 0–2 cardinal-adjacent unconnected room pairs
      console.log('[DEBUG] 隣接部屋追加接続開始...');
      this.addAdjacentRoomCorridors(dungeon, params);
      console.log('[DEBUG] 隣接部屋追加接続完了');

      // Connect skip-neighbor rooms (same row/col with one empty grid between)
      console.log('[DEBUG] スキップ隣接部屋追加接続開始...');
      this.addSkipNeighborCorridors(dungeon, params);
      console.log('[DEBUG] スキップ隣接部屋追加接続完了');

      // Place stairs
      console.log('[DEBUG] 階段配置開始...');
      this.placeStairs(dungeon, params);
      console.log('[DEBUG] 階段配置完了');

      // Set player spawn point
      console.log('[DEBUG] プレイヤースポーン設定開始...');
      this.setPlayerSpawn(dungeon);
      console.log('[DEBUG] プレイヤースポーン設定完了');

      console.log('[DEBUG] generateDungeon: 完了');
      return dungeon;
    } catch (error) {
      console.error('[ERROR] generateDungeonでエラーが発生:', error);
      throw error;
    }
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
   * Generate rooms using 12-division grid system (4x3)
   */
  private generateGridBasedRooms(dungeon: Dungeon, params: DungeonGenerationParams): void {
    try {
      console.log('[DEBUG] generateGridBasedRooms: 開始, サイズ:', dungeon.width, 'x', dungeon.height);
      
      // Create configurable division grid
      const gridDivision = params.gridDivision || 12; // デフォルト値12
      const grid = this.createDivisionGrid(dungeon.width, dungeon.height, gridDivision);
      console.log(`[DEBUG] ${gridDivision}分割グリッド作成完了, グリッド数:`, grid.length);

      // Use floor-specific room count parameters
      const roomCount = this.randomInt(params.minRooms, params.maxRooms);
      console.log('[DEBUG] 作成する部屋数:', roomCount);

      // Shuffle grid cells for random selection
      console.log('[DEBUG] グリッドシャッフル開始...');
      const shuffledGrid = this.shuffleArray([...grid]);
      console.log('[DEBUG] グリッドシャッフル完了');

      // Generate rooms in selected grid cells
      console.log('[DEBUG] 部屋生成開始...');
      for (let i = 0; i < roomCount && i < shuffledGrid.length; i++) {
        const gridCell = shuffledGrid[i];
        console.log(`[DEBUG] 部屋${i}生成中, グリッドセル:`, gridCell);
        const room = this.createRoomInGridCell(gridCell, i, params);

        if (room) {
          console.log(`[DEBUG] 部屋${i}生成完了:`, room);
          this.carveRoom(dungeon, room);
          dungeon.rooms.push(room);
          gridCell.occupied = true;
        } else {
          console.log(`[DEBUG] 部屋${i}生成失敗`);
        }
      }
      console.log('[DEBUG] 部屋生成完了, 総部屋数:', dungeon.rooms.length);
    } catch (error) {
      console.error('[ERROR] generateGridBasedRoomsでエラーが発生:', error);
      throw error;
    }
  }



  /**
   * Create configurable division grid
   * 設定可能な分割数のグリッドを作成
   */
  private createDivisionGrid(dungeonWidth: number, dungeonHeight: number, gridDivision: number): GridCell[] {
    const grid: GridCell[] = [];

    // グリッド分割数を適切な行数・列数に変換
    let cols: number, rows: number;
    
    if (gridDivision === 9) {
      // 3x3 grid
      cols = 3;
      rows = 3;
    } else if (gridDivision === 12) {
      // 4x3 grid
      cols = 4;
      rows = 3;
    } else if (gridDivision === 16) {
      // 4x4 grid
      cols = 4;
      rows = 4;
    } else if (gridDivision === 15) {
      // 5x3 grid
      cols = 5;
      rows = 3;
    } else if (gridDivision === 20) {
      // 5x4 grid
      cols = 5;
      rows = 4;
    } else {
      // デフォルト: 4x3 grid (12分割)
      cols = 4;
      rows = 3;
      console.log(`[DEBUG] 未対応のグリッド分割数: ${gridDivision}, デフォルト4x3を使用`);
    }

    const cellWidth = Math.floor(dungeonWidth / cols);
    const cellHeight = Math.floor(dungeonHeight / rows);

    console.log(`[DEBUG] グリッド作成: ${cols}x${rows} (${gridDivision}分割)`);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        grid.push({
          row,
          col,
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
    try {
      console.log(`[DEBUG] createRoomInGridCell: 開始, 部屋${roomIndex}, グリッドセル:`, gridCell);
      
      // Minimum room size (ensure rooms are not too small)
      const minSize = Math.max(params.minRoomSize, 5);
      const maxSize = params.maxRoomSize;
      console.log('[DEBUG] 部屋サイズ制約:', minSize, 'to', maxSize);

      // Calculate available space in grid cell (with padding)
      const padding = 2;
      const availableWidth = gridCell.width - padding * 2;
      const availableHeight = gridCell.height - padding * 2;
      console.log('[DEBUG] 利用可能サイズ:', availableWidth, 'x', availableHeight);

      // Check if we can fit minimum room size
      if (availableWidth < minSize || availableHeight < minSize) {
        console.log('[DEBUG] 最小サイズに収まりません');
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
      console.log('[DEBUG] 部屋サイズ決定:', roomWidth, 'x', roomHeight);

      // Position room randomly within grid cell
      const maxX = gridCell.x + gridCell.width - roomWidth - padding;
      const maxY = gridCell.y + gridCell.height - roomHeight - padding;
      const roomX = this.randomInt(gridCell.x + padding, maxX);
      const roomY = this.randomInt(gridCell.y + padding, maxY);
      console.log('[DEBUG] 部屋位置決定:', roomX, roomY);

      const room = {
        id: `room-${roomIndex}`,
        x: roomX,
        y: roomY,
        width: roomWidth,
        height: roomHeight,
        type: 'normal' as const,
        connected: false,
        connections: [],
        gridRow: gridCell.row,
        gridCol: gridCell.col
      };
      
      console.log(`[DEBUG] 部屋${roomIndex}生成完了:`, room);
      return room;
    } catch (error) {
      console.error(`[ERROR] createRoomInGridCellでエラーが発生:`, error);
      return null;
    }
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    try {
      console.log('[DEBUG] shuffleArray: 開始, 配列長:', array.length);
      
      if (array.length === 0) {
        console.log('[DEBUG] shuffleArray: 空配列のためスキップ');
        return array;
      }
      
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      
      console.log('[DEBUG] shuffleArray: 完了');
      return array;
    } catch (error) {
      console.error('[ERROR] shuffleArrayでエラーが発生:', error);
      throw error;
    }
  }

  /**
   * Carve out a room in the dungeon
   */
  private carveRoom(dungeon: Dungeon, room: Room): void {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        dungeon.cells[y][x] = {
          type: 'room',  // ⭐ 部屋用に変更
          walkable: true,
          transparent: true,
          entities: []
        };
      }
    }
    // 部屋占有のキャッシュ更新は現状不要のため省略
  }

  /**
   * Connect all rooms with corridors using hierarchical MST approach
   */
  private connectRooms(dungeon: Dungeon, params: DungeonGenerationParams): void {
    try {
      console.log('[DEBUG] connectRooms: 開始, 部屋数:', dungeon.rooms.length);
      
      if (dungeon.rooms.length === 0) {
        console.log('[DEBUG] 部屋がないためスキップ');
        return;
      }

      // Initialize: each room is its own group
      const roomGroups: Room[][] = dungeon.rooms.map(room => [room]);
      let connectionCount = 0;
      
      console.log('[DEBUG] 初期状態: 各部屋が独立したグループ, グループ数:', roomGroups.length);

      // Continue until all rooms are connected (only one group remains)
      while (roomGroups.length > 1) {
        console.log(`[DEBUG] 接続処理${connectionCount + 1}回目, グループ数:`, roomGroups.length);
        
        let bestConnection: { 
          fromGroup: Room[]; 
          toGroup: Room[]; 
          fromRoom: Room; 
          toRoom: Room; 
          distance: number 
        } | null = null;

        // Find the closest pair of different groups
        for (let i = 0; i < roomGroups.length; i++) {
          for (let j = i + 1; j < roomGroups.length; j++) {
            const group1 = roomGroups[i];
            const group2 = roomGroups[j];
            
            // Find the closest pair of rooms between these groups
            for (const room1 of group1) {
              for (const room2 of group2) {
                const distance = this.getRoomDistance(room1, room2);
                
                if (!bestConnection || distance < bestConnection.distance) {
                  bestConnection = {
                    fromGroup: group1,
                    toGroup: group2,
                    fromRoom: room1,
                    toRoom: room2,
                    distance
                  };
                }
              }
            }
          }
        }

        if (bestConnection) {
          console.log(`[DEBUG] 最適な接続を発見: グループ${roomGroups.indexOf(bestConnection.fromGroup)} → グループ${roomGroups.indexOf(bestConnection.toGroup)}, 部屋${bestConnection.fromRoom.id} → 部屋${bestConnection.toRoom.id}, 距離: ${bestConnection.distance}`);
          
          // Create corridor between rooms
          const corridor = this.createCorridor(dungeon, bestConnection.fromRoom, bestConnection.toRoom, params);

          // Add connection to both rooms
          bestConnection.fromRoom.connections.push({
            roomId: bestConnection.toRoom.id,
            corridorPath: corridor
          });

          bestConnection.toRoom.connections.push({
            roomId: bestConnection.fromRoom.id,
            corridorPath: corridor
          });

          // Mark both rooms as connected
          bestConnection.fromRoom.connected = true;
          bestConnection.toRoom.connected = true;

          // Merge the two groups
          const mergedGroup = [...bestConnection.fromGroup, ...bestConnection.toGroup];
          roomGroups.splice(roomGroups.indexOf(bestConnection.fromGroup), 1);
          roomGroups.splice(roomGroups.indexOf(bestConnection.toGroup), 1);
          roomGroups.push(mergedGroup);
          
          connectionCount++;
          console.log(`[DEBUG] グループ統合完了: 新しいグループサイズ: ${mergedGroup.length}, 残りグループ数: ${roomGroups.length}`);
        } else {
          console.error('[ERROR] 最適な接続が見つかりません');
          break;
        }
      }

      console.log('[DEBUG] 部屋接続完了, 総接続数:', connectionCount, '最終グループ数:', roomGroups.length);
      
      console.log('[DEBUG] connectRooms: 完了');
    } catch (error) {
      console.error('[ERROR] connectRoomsでエラーが発生:', error);
      throw error;
    }
  }



  /**
   * Group adjacent empty grid cells
   */
  private groupAdjacentEmptyGrids(emptyCells: { row: number; col: number; x: number; y: number }[], gridSize: number): { row: number; col: number; x: number; y: number }[][] {
    try {
      console.log('[DEBUG] groupAdjacentEmptyGrids: 開始, 空セル数:', emptyCells.length);
      
      const groups: { row: number; col: number; x: number; y: number }[][] = [];
      const visited = new Set<string>();
      
      for (let i = 0; i < emptyCells.length; i++) {
        const cell = emptyCells[i];
        console.log(`[DEBUG] セル${i}処理中: (${cell.row},${cell.col})`);
        
        if (visited.has(`${cell.row},${cell.col}`)) {
          console.log(`[DEBUG] セル${i}は既に訪問済み, スキップ`);
          continue;
        }
        
        const group: { row: number; col: number; x: number; y: number }[] = [];
        console.log(`[DEBUG] セル${i}からグループ作成開始`);
        this.dfsGroupAdjacent(cell, emptyCells, visited, group, gridSize);
        groups.push(group);
        console.log(`[DEBUG] セル${i}のグループ作成完了, グループサイズ:`, group.length);
      }
      
      console.log('[DEBUG] groupAdjacentEmptyGrids: 完了, グループ数:', groups.length);
      return groups;
    } catch (error) {
      console.error('[ERROR] groupAdjacentEmptyGridsでエラーが発生:', error);
      return [];
    }
  }

  /**
   * DFS to find adjacent empty grid cells
   */
  private dfsGroupAdjacent(cell: { row: number; col: number; x: number; y: number }, 
                          allCells: { row: number; col: number; x: number; y: number }[], 
                          visited: Set<string>, 
                          group: { row: number; col: number; x: number; y: number }[], 
                          gridSize: number): void {
    try {
      const key = `${cell.row},${cell.col}`;
      if (visited.has(key)) {
        console.log(`[DEBUG] dfsGroupAdjacent: 既に訪問済み (${cell.row},${cell.col}), スキップ`);
        return;
      }
      
      visited.add(key);
      group.push(cell);
      console.log(`[DEBUG] dfsGroupAdjacent: セル追加 (${cell.row},${cell.col}), グループサイズ:`, group.length);
      
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
            console.log(`[DEBUG] dfsGroupAdjacent: 隣接セル発見 (${dir.row},${dir.col}), 再帰呼び出し`);
            this.dfsGroupAdjacent(adjacentCell, allCells, visited, group, gridSize);
          }
        }
      }
    } catch (error) {
      console.error('[ERROR] dfsGroupAdjacentでエラーが発生:', error);
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
   * 上下左右で隣接していて未接続の部屋ペアから、ランダムで0〜2ペアを選び、
   * 既存の通路生成アルゴリズム（createCorridor）で接続する。
   */
  private addAdjacentRoomCorridors(dungeon: Dungeon, params: DungeonGenerationParams): void {
    const rooms = dungeon.rooms;
    if (rooms.length < 2) return;

    const connected = new Set<string>();
    for (const r of rooms) {
      for (const c of r.connections) {
        connected.add(this.makePairKey(r.id, c.roomId));
      }
    }

    const pairs: { a: Room; b: Room }[] = [];
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i], b = rooms[j];
        if (connected.has(this.makePairKey(a.id, b.id))) continue;
        if (this.areCardinalAdjacentByGrid(a, b)) {
          pairs.push({ a, b });
        }
      }
    }
    if (pairs.length === 0) return;

    // 最大本数（既定2）と確率（隣接は60%）
    const maxPairs = params.extraAdjacentMaxPairs ?? 2;
    const probability = 0.6;
    let added = 0;
    for (const { a, b } of this.shuffleArray(pairs)) {
      if (added >= maxPairs) break;
      if (this.rng() >= probability) continue;
      const corridor = this.createCorridor(dungeon, a, b, params);
      a.connections.push({ roomId: b.id, corridorPath: corridor });
      b.connections.push({ roomId: a.id, corridorPath: corridor });
      added++;
    }
  }

  private makePairKey(aId: string, bId: string): string {
    return aId < bId ? `${aId}::${bId}` : `${bId}::${aId}`;
  }

  // グリッド上でマンハッタン距離1（上下左右の隣）
  private areCardinalAdjacentByGrid(a: Room, b: Room): boolean {
    if (a.gridRow == null || a.gridCol == null || b.gridRow == null || b.gridCol == null) return false;
    const dr = Math.abs(a.gridRow - b.gridRow);
    const dc = Math.abs(a.gridCol - b.gridCol);
    return dr + dc === 1;
  }

  // overlap1D は使用しないため削除

  // 指定グリッドセル内に既存の通路が含まれるか判定
  private gridCellHasCorridor(
    dungeon: Dungeon,
    row: number,
    col: number,
    cols: number,
    rows: number
  ): boolean {
    // 占有キャッシュがある場合は高速判定
    if (this.corridorInCell) {
      if (row >= 0 && row < this.gridRows && col >= 0 && col < this.gridCols) {
        return !!this.corridorInCell[row][col];
      }
      return false;
    }
    const { x0, x1, y0, y1 } = this.getGridCellBounds(dungeon, cols, rows, row, col);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const cell = dungeon.cells[y]?.[x];
        if (cell && cell.type === 'corridor') return true;
      }
    }
    return false;
  }

  // グリッドセルのタイル範囲を取得
  private getGridCellBounds(
    dungeon: Dungeon,
    cols: number,
    rows: number,
    row: number,
    col: number
  ): { x0: number; x1: number; y0: number; y1: number } {
    const x0 = Math.floor((col / cols) * dungeon.width);
    const x1 = Math.floor(((col + 1) / cols) * dungeon.width);
    const y0 = Math.floor((row / rows) * dungeon.height);
    const y1 = Math.floor(((row + 1) / rows) * dungeon.height);
    return { x0, x1, y0, y1 };
  }

  // gridDivision を(cols, rows)に変換するユーティリティ
  private getGridColsRows(gridDivision: number): { cols: number; rows: number } {
    if (gridDivision === 9) return { cols: 3, rows: 3 };
    if (gridDivision === 12) return { cols: 4, rows: 3 };
    if (gridDivision === 16) return { cols: 4, rows: 4 };
    if (gridDivision === 15) return { cols: 5, rows: 3 };
    if (gridDivision === 20) return { cols: 5, rows: 4 };
    return { cols: 4, rows: 3 };
  }

  /**
   * 隣の隣（同じ行または列で1セル空き）の部屋同士を、
   * 中間グリッドに部屋がない場合のみ追加接続する（最大2ペア、テスト用に100%）。
   */
  private addSkipNeighborCorridors(dungeon: Dungeon, params: DungeonGenerationParams): void {
    const rooms = dungeon.rooms;
    if (rooms.length < 2) return;

    const { cols, rows } = this.getGridColsRows(params.gridDivision || 12);
    const gridRooms: (Room | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
    for (const r of rooms) {
      if (r.gridRow == null || r.gridCol == null) continue;
      if (!gridRooms[r.gridRow][r.gridCol]) gridRooms[r.gridRow][r.gridCol] = r;
    }

    const connected = new Set<string>();
    for (const r of rooms) {
      for (const c of r.connections) connected.add(this.makePairKey(r.id, c.roomId));
    }

    type Pair = { a: Room; b: Room; midRow: number; midCol: number };
    const pairs: Pair[] = [];
    // 水平方向候補
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c + 2 < cols; c++) {
        const a = gridRooms[r][c];
        const mid = gridRooms[r][c + 1];
        const b = gridRooms[r][c + 2];
        if (a && b && !mid && !connected.has(this.makePairKey(a.id, b.id))) {
          pairs.push({ a, b, midRow: r, midCol: c + 1 });
        }
      }
    }
    // 垂直方向候補
    for (let r = 0; r + 2 < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = gridRooms[r][c];
        const mid = gridRooms[r + 1][c];
        const b = gridRooms[r + 2][c];
        if (a && b && !mid && !connected.has(this.makePairKey(a.id, b.id))) {
          pairs.push({ a, b, midRow: r + 1, midCol: c });
        }
      }
    }

    if (pairs.length === 0) return;
    const usedMid = new Set<string>();
    const shuffledPairs = this.shuffleArray(pairs);
    const maxPairs = params.extraSkipNeighborMaxPairs ?? 2;
    const probability = 0.8; // スキップ隣接は80%
    let added = 0;
    for (const p of shuffledPairs) {
      if (added >= maxPairs) break; // 最大数
      const midKey = `${p.midRow}:${p.midCol}`;
      if (usedMid.has(midKey)) continue; // 同じ中間グリッドは一度だけ

      // 現在の状態で中間グリッドに通路がないか再確認
      if (this.gridCellHasCorridor(dungeon, p.midRow, p.midCol, cols, rows)) continue;
      // 確率チェック
      if (this.rng() >= probability) continue;

      const corridor = this.createCorridor(dungeon, p.a, p.b, params);
      p.a.connections.push({ roomId: p.b.id, corridorPath: corridor });
      p.b.connections.push({ roomId: p.a.id, corridorPath: corridor });
      usedMid.add(midKey);
      added++;
    }
  }

  /**
   * Find the best exit point on the edge of a room facing another room
   * 通路の接続先を偶数または奇数マスに限定して、通路同士がくっつくことを防ぐ
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
        const exitX = room.x + room.width - 1;
        const exitY = this.adjustToEvenOddGrid(roomCenter.y, room.y, room.y + room.height - 1);
        return { x: exitX, y: exitY };
      } else {
        // Target is to the left, use left edge
        const exitX = room.x;
        const exitY = this.adjustToEvenOddGrid(roomCenter.y, room.y, room.y + room.height - 1);
        return { x: exitX, y: exitY };
      }
    } else {
      // Vertical connection - use top or bottom edge
      if (dy > 0) {
        // Target is below, use bottom edge
        const exitY = room.y + room.height - 1;
        const exitX = this.adjustToEvenOddGrid(roomCenter.x, room.x, room.x + room.width - 1);
        return { x: exitX, y: exitY };
      } else {
        // Target is above, use top edge
        const exitY = room.y;
        const exitX = this.adjustToEvenOddGrid(roomCenter.x, room.x, room.x + room.width - 1);
        return { x: exitX, y: exitY };
      }
    }
  }

  /**
   * Find the best entrance point on the edge of a room from another room
   * 通路の接続先を偶数または奇数マスに限定して、通路同士がくっつくことを防ぐ
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
        const entranceX = room.x;
        const entranceY = this.adjustToEvenOddGrid(roomCenter.y, room.y, room.y + room.height - 1);
        return { x: entranceX, y: entranceY };
      } else {
        // Source is to the right, use right edge
        const entranceX = room.x + room.width - 1;
        const entranceY = this.adjustToEvenOddGrid(roomCenter.y, room.y, room.y + room.height - 1);
        return { x: entranceX, y: entranceY };
      }
    } else {
      // Vertical connection - use top or bottom edge
      if (dy > 0) {
        // Source is above, use top edge
        const entranceY = room.y;
        const entranceX = this.adjustToEvenOddGrid(roomCenter.x, room.x, room.x + room.width - 1);
        return { x: entranceX, y: entranceY };
      } else {
        // Source is below, use bottom edge
        const entranceY = room.y + room.height - 1;
        const entranceX = this.adjustToEvenOddGrid(roomCenter.x, room.x, room.x + room.width - 1);
        return { x: entranceX, y: entranceY };
      }
    }
  }

  /**
   * Adjust position to even or odd grid to prevent corridors from touching
   * 通路同士がくっつくことを防ぐため、偶数または奇数マスに位置を調整する
   */
  private adjustToEvenOddGrid(centerPos: number, minPos: number, maxPos: number): number {
    // 中心位置を基準に、偶数または奇数マスに調整
    // 偶数マスに調整する場合（0, 2, 4, 6...）
    const adjustedPos = centerPos;
    
    // 範囲内で最も近い偶数マスを探す
    let evenPos = Math.floor(adjustedPos / 2) * 2;
    let oddPos = evenPos + 1;
    
    // 範囲外の場合は調整
    if (evenPos < minPos) evenPos = minPos;
    if (oddPos < minPos) oddPos = minPos;
    if (evenPos > maxPos) evenPos = maxPos;
    if (oddPos > maxPos) oddPos = maxPos;
    
    // 中心位置により近い方を選択
    const evenDistance = Math.abs(adjustedPos - evenPos);
    const oddDistance = Math.abs(adjustedPos - oddPos);
    
    return evenDistance <= oddDistance ? evenPos : oddPos;
  }

  /**
   * Adjust position to even or odd grid with collision avoidance
   * 通路同士が重ならないように、既に使用されているマスを避けて偶数または奇数マスに調整
   */
  // adjustToEvenOddGridWithCollisionAvoidance は未使用のため削除

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
          // セルの存在チェックを追加（壁以外は変更しない）
          if (dungeon.cells[y] && dungeon.cells[y][x] && dungeon.cells[y][x].type === 'wall') {
            dungeon.cells[y][x] = {
              type: 'corridor',  // ⭐ 通路用に変更
              walkable: true,
              transparent: true,
              entities: []
            };
            // 占有キャッシュ更新（通路が通ったグリッドをマーク）
            if (this.corridorInCell && this.gridCols > 0 && this.gridRows > 0) {
              const col = Math.max(0, Math.min(this.gridCols - 1, Math.floor((x * this.gridCols) / dungeon.width)));
              const row = Math.max(0, Math.min(this.gridRows - 1, Math.floor((y * this.gridRows) / dungeon.height)));
              this.corridorInCell[row][col] = true;
            }
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
    const firstRoom = dungeon.rooms[0];
    const lastRoom = dungeon.rooms[dungeon.rooms.length - 1];

    if (direction === 'down') {
      // 下り階段: 任意の部屋の床タイルならどこでも可（プレイヤー直下でも可）
      const target = dungeon.rooms[this.randomInt(0, dungeon.rooms.length - 1)];
      const stairsDown = this.pickRandomPointInRoom(target, 0);
      dungeon.stairsDown = stairsDown;
      if (dungeon.cells[stairsDown.y] && dungeon.cells[stairsDown.y][stairsDown.x]) {
        dungeon.cells[stairsDown.y][stairsDown.x].type = 'stairs-down';
      }
      dungeon.stairsUp = undefined;
    } else {
      // 上り階段: 任意の部屋の床タイル
      const target = dungeon.rooms[this.randomInt(0, dungeon.rooms.length - 1)];
      const stairsUp = this.pickRandomPointInRoom(target, 0);
      dungeon.stairsUp = stairsUp;
      if (dungeon.cells[stairsUp.y] && dungeon.cells[stairsUp.y][stairsUp.x]) {
        dungeon.cells[stairsUp.y][stairsUp.x].type = 'stairs-up';
      }
      dungeon.stairsDown = undefined;
    }
  }

  // 以前の距離ベース配置は不要になったため削除（シンプルランダムに統一）

  // 部屋内のランダムなタイルを返す（margin=0なら端含む）
  private pickRandomPointInRoom(room: Room, margin = 0): Position {
    const mX = Math.min(margin, Math.max(0, room.width - 1));
    const mY = Math.min(margin, Math.max(0, room.height - 1));
    const minX = room.x + mX;
    const maxX = room.x + room.width - 1 - mX;
    const minY = room.y + mY;
    const maxY = room.y + room.height - 1 - mY;
    const x = this.randomInt(minX, maxX);
    const y = this.randomInt(minY, maxY);
    return { x, y };
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
    try {
      if (max < min) {
        console.error('[ERROR] randomInt: max < min, min:', min, 'max:', max);
        // 安全な値に調整
        const temp = min;
        min = max;
        max = temp;
      }
      
      const result = Math.floor(this.rng() * (max - min + 1)) + min;
      console.log('[DEBUG] randomInt:', min, 'to', max, '=', result);
      return result;
    } catch (error) {
      console.error('[ERROR] randomIntでエラーが発生:', error);
      throw error;
    }
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
