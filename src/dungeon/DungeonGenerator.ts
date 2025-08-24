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
      this.generateGridBasedRooms(dungeon, params);
      console.log('[DEBUG] 部屋生成完了');

      // Connect rooms with corridors
      console.log('[DEBUG] 部屋接続開始...');
      this.connectRooms(dungeon, params);
      console.log('[DEBUG] 部屋接続完了');

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
   * Generate rooms using 9-division grid system
   */
  private generateGridBasedRooms(dungeon: Dungeon, params: DungeonGenerationParams): void {
    try {
      console.log('[DEBUG] generateGridBasedRooms: 開始, サイズ:', dungeon.width, 'x', dungeon.height);
      
      // Create 9-division grid (3x3)
      const grid = this.create9DivisionGrid(dungeon.width, dungeon.height);
      console.log('[DEBUG] 9分割グリッド作成完了, グリッド数:', grid.length);

      // Randomly decide how many rooms to create (4-9)
      const roomCount = this.randomInt(4, 9);
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
        connections: []
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
  }

  /**
   * Connect all rooms with corridors
   */
  private connectRooms(dungeon: Dungeon, params: DungeonGenerationParams): void {
    try {
      console.log('[DEBUG] connectRooms: 開始, 部屋数:', dungeon.rooms.length);
      
      if (dungeon.rooms.length === 0) {
        console.log('[DEBUG] 部屋がないためスキップ');
        return;
      }

      // Start with the first room
      dungeon.rooms[0].connected = true;
      const connectedRooms = [dungeon.rooms[0]];
      const unconnectedRooms = dungeon.rooms.slice(1);
      console.log('[DEBUG] 接続済み部屋:', connectedRooms.length, '未接続部屋:', unconnectedRooms.length);

      // Connect each unconnected room to the nearest connected room
      let connectionCount = 0;
      while (unconnectedRooms.length > 0) {
        console.log(`[DEBUG] 接続処理${connectionCount + 1}回目, 未接続部屋数:`, unconnectedRooms.length);
        
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
          console.log(`[DEBUG] 最適な接続を発見: ${bestConnection.from.id} → ${bestConnection.to.id}, 距離: ${bestConnection.distance}`);
          
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
          
          connectionCount++;
          console.log(`[DEBUG] 接続完了: ${bestConnection.to.id}, 接続済み部屋数:`, connectedRooms.length);
        } else {
          console.error('[ERROR] 最適な接続が見つかりません');
          break;
        }
      }

      console.log('[DEBUG] 部屋接続完了, 総接続数:', connectionCount);

      // Add corridors from empty grid cells to nearby rooms
      console.log('[DEBUG] 空グリッドからの通路追加開始...');
      this.addCorridorsFromEmptyGrids(dungeon, params);
      console.log('[DEBUG] 空グリッドからの通路追加完了');
      
      console.log('[DEBUG] connectRooms: 完了');
    } catch (error) {
      console.error('[ERROR] connectRoomsでエラーが発生:', error);
      throw error;
    }
  }

  /**
   * Add corridors from empty grid cells to nearby rooms
   */
  private addCorridorsFromEmptyGrids(dungeon: Dungeon, params: DungeonGenerationParams): void {
    try {
      console.log('[DEBUG] addCorridorsFromEmptyGrids: 開始');
      
      // Create 3x3 grid for reference
      const gridSize = 3;
      const cellWidth = Math.floor(dungeon.width / gridSize);
      const cellHeight = Math.floor(dungeon.height / gridSize);
      console.log('[DEBUG] グリッドサイズ:', cellWidth, 'x', cellHeight);
      
      // Find empty grid cells
      const emptyGridCells: { row: number; col: number; x: number; y: number }[] = [];
      
      console.log('[DEBUG] 空グリッドセル検索中...');
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
                if (dungeon.cells[y] && dungeon.cells[y][x] && (dungeon.cells[y][x].type === 'floor' || dungeon.cells[y][x].type === 'room' || dungeon.cells[y][x].type === 'corridor')) {
                  // Found existing corridor, mark as not empty
                  isEmpty = false;
                  break;
                }
              }
            }
          }
          
          if (isEmpty) {
            emptyGridCells.push({ row, col, x: gridX, y: gridY });
            console.log(`[DEBUG] 空グリッドセル発見: (${row},${col}) at (${gridX},${gridY})`);
          }
        }
      }
      
      console.log('[DEBUG] 空グリッドセル数:', emptyGridCells.length);
      
      // 空グリッドからランダムに1-3個を選択
      let selectedGridCells: { row: number; col: number; x: number; y: number }[] = [];
      if (emptyGridCells.length > 0) {
        const maxSelection = Math.min(3, emptyGridCells.length);
        const selectionCount = this.randomInt(1, maxSelection);
        console.log(`[DEBUG] 空グリッドから${selectionCount}個をランダム選択`);
        
        // 配列をシャッフルしてから先頭から選択
        const shuffled = this.shuffleArray([...emptyGridCells]);
        selectedGridCells = shuffled.slice(0, selectionCount);
        
        console.log('[DEBUG] 選択された空グリッド:', selectedGridCells.map(c => `(${c.row},${c.col})`));
      }
      
      // 選択された空グリッドから通路を作成
      console.log('[DEBUG] 選択された空グリッドからの通路作成開始...');
      for (let i = 0; i < selectedGridCells.length; i++) {
        const gridCell = selectedGridCells[i];
        console.log(`[DEBUG] 空グリッド${i}処理中: (${gridCell.row},${gridCell.col})`);
        
        // グリッドセルの中心位置を計算
        const gridCenter = {
          x: gridCell.x + Math.floor(cellWidth / 2),
          y: gridCell.y + Math.floor(cellHeight / 2)
        };
        
        // このグリッドセルに最も近い2つの部屋を見つける
        const roomDistances = dungeon.rooms.map(room => {
          const roomCenter = {
            x: room.x + Math.floor(room.width / 2),
            y: room.y + Math.floor(room.height / 2)
          };
          const distance = Math.abs(gridCenter.x - roomCenter.x) + Math.abs(gridCenter.y - roomCenter.y);
          return { room, distance };
        });
        
        // 距離でソートして最も近い部屋を選択（異なる部屋であることを保証）
        roomDistances.sort((a, b) => a.distance - b.distance);
        
        // 異なる部屋を選択する（最大2つ）
        const selectedRooms: typeof roomDistances = [];
        const usedRoomIds = new Set<string>();
        
        for (const roomDistance of roomDistances) {
          if (selectedRooms.length >= 2) break; // 最大2つまで
          
          const roomId = roomDistance.room.id;
          if (!usedRoomIds.has(roomId)) {
            selectedRooms.push(roomDistance);
            usedRoomIds.add(roomId);
            console.log(`[DEBUG] 空グリッド${i}: 部屋${roomId}を選択 (距離: ${roomDistance.distance})`);
          }
        }
        
        console.log(`[DEBUG] 空グリッド${i}: 選択された部屋: ${selectedRooms.map(r => r.room.id).join(', ')}`);
        
        // 選択された部屋に通路を作成
        if (selectedRooms.length === 0) {
          console.log(`[DEBUG] 空グリッド${i}: 接続可能な部屋が見つかりません`);
        } else if (selectedRooms.length === 1) {
          console.log(`[DEBUG] 空グリッド${i}: 部屋が1つしかないため、1方向の通路のみ作成`);
        } else {
          console.log(`[DEBUG] 空グリッド${i}: 2方向の通路を作成`);
        }
        
        for (let j = 0; j < selectedRooms.length; j++) {
          const { room } = selectedRooms[j];
          const roomCenter = {
            x: room.x + Math.floor(room.width / 2),
            y: room.y + Math.floor(room.height / 2)
          };
          
          console.log(`[DEBUG] 空グリッド${i}から部屋${room.id}への通路${j + 1}を作成: (${gridCenter.x},${gridCenter.y}) → (${roomCenter.x},${roomCenter.y})`);
          
          // グリッド中心から部屋中心への通路を作成
          this.createCorridorPath(dungeon, gridCenter, roomCenter, params);
        }
        
        // 空グリッド基準点は各通路生成時に自動的に通路として設定される
        
        console.log(`[DEBUG] 空グリッド${i}処理完了`);
      }
      
      console.log('[DEBUG] addCorridorsFromEmptyGrids: 完了');
    } catch (error) {
      console.error('[ERROR] addCorridorsFromEmptyGridsでエラーが発生:', error);
      // エラーが発生しても処理を続行
      console.log('[DEBUG] 空グリッド処理をスキップして続行');
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
   * Create a corridor path using the new boundary-reaching algorithm
   * 連結しようとした部屋の双方からグリッドの境界へむけて通路を伸ばして、
   * yないしx軸が揃ったら間をむすんで通路とする
   */
  private createCorridorPath(dungeon: Dungeon, start: Position, end: Position, params: DungeonGenerationParams): void {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // 決定: どちらの軸を先に揃えるか
    // より距離が短い軸を先に揃えることで、効率的な通路を作成
    const extendXFirst = Math.abs(dx) > Math.abs(dy);
    
    if (extendXFirst) {
      // X軸を先に揃える場合
      this.createCorridorPathXFirst(dungeon, start, end, params);
    } else {
      // Y軸を先に揃える場合
      this.createCorridorPathYFirst(dungeon, start, end, params);
    }
  }

  /**
   * Create corridor path with X-axis alignment first
   */
  private createCorridorPathXFirst(dungeon: Dungeon, start: Position, end: Position, params: DungeonGenerationParams): void {
    // 開始点自体を通路として確実に設定
    this.carveCorridor(dungeon, start, params.corridorWidth);
    
    // 1. 開始点からX軸方向に境界まで伸ばす
    let currentStart = { ...start };
    const startXPath: Position[] = [];
    
    // X軸方向に伸ばす（目標のX座標まで）
    while (currentStart.x !== end.x) {
      currentStart.x += currentStart.x < end.x ? 1 : -1;
      startXPath.push({ ...currentStart });
      this.carveCorridor(dungeon, currentStart, params.corridorWidth);
    }
    
    // 2. 終了点からY軸方向に境界まで伸ばす
    let currentEnd = { ...end };
    const endYPath: Position[] = [];
    
    // Y軸方向に伸ばす（開始点のY座標まで）
    while (currentEnd.y !== start.y) {
      currentEnd.y += currentEnd.y < start.y ? 1 : -1;
      endYPath.push({ ...currentEnd });
      this.carveCorridor(dungeon, currentEnd, params.corridorWidth);
    }
    
    // 3. 2つの通路の間を接続（X軸が揃った状態でY軸方向に接続）
    const connectionStart = { x: currentStart.x, y: Math.min(currentStart.y, currentEnd.y) };
    const connectionEnd = { x: currentStart.x, y: Math.max(currentStart.y, currentEnd.y) };
    
    let currentConnection = { ...connectionStart };
    while (currentConnection.y !== connectionEnd.y) {
      currentConnection.y += 1;
      this.carveCorridor(dungeon, currentConnection, params.corridorWidth);
    }
  }

  /**
   * Create corridor path with Y-axis alignment first
   */
  private createCorridorPathYFirst(dungeon: Dungeon, start: Position, end: Position, params: DungeonGenerationParams): void {
    // 開始点自体を通路として確実に設定
    this.carveCorridor(dungeon, start, params.corridorWidth);
    
    // 1. 開始点からY軸方向に境界まで伸ばす
    let currentStart = { ...start };
    const startYPath: Position[] = [];
    
    // Y軸方向に伸ばす（目標のY座標まで）
    while (currentStart.y !== end.y) {
      currentStart.y += currentStart.y < end.y ? 1 : -1;
      startYPath.push({ ...currentStart });
      this.carveCorridor(dungeon, currentStart, params.corridorWidth);
    }
    
    // 2. 終了点からX軸方向に境界まで伸ばす
    let currentEnd = { ...end };
    const endXPath: Position[] = [];
    
    // X軸方向に伸ばす（開始点のX座標まで）
    while (currentEnd.x !== start.x) {
      currentEnd.x += currentEnd.x < start.x ? 1 : -1;
      endXPath.push({ ...currentEnd });
      this.carveCorridor(dungeon, currentEnd, params.corridorWidth);
    }
    
    // 3. 2つの通路の間を接続（Y軸が揃った状態でX軸方向に接続）
    const connectionStart = { x: Math.min(currentStart.x, currentEnd.x), y: currentStart.y };
    const connectionEnd = { x: Math.max(currentStart.x, currentEnd.x), y: currentStart.y };
    
    let currentConnection = { ...connectionStart };
    while (currentConnection.x !== connectionEnd.x) {
      currentConnection.x += 1;
      this.carveCorridor(dungeon, currentConnection, params.corridorWidth);
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