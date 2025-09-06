/**
 * Dungeon management system
 * Handles dungeon creation, loading, and state management
 */

import { Position } from '../types/core';
import { GameEntity } from '../types/entities';
import { 
  Dungeon, 
  DungeonCell, 
  DungeonGenerationParams, 
  DungeonTemplate,
  CellType,
  Room
} from '../types/dungeon';
import { DungeonGenerator } from './DungeonGenerator.js';
import { SyncConfigLoader, DungeonTemplateConfig } from '../core/SyncConfigLoader.js';

export class DungeonManager {
  private currentDungeon: Dungeon | null = null;
  private dungeonTemplates: Map<string, DungeonTemplate> = new Map();
  private generator: DungeonGenerator;
  private currentTemplateId: string | null = null;
  public aiSystem: any = null; // AISystemの参照
  // プレイヤー視界をターン単位で共有
  private playerVision: Set<string> = new Set();
  private lastVisionTurn: number | null = null;
  // プレイヤーの残り香（最後にいたターンを保持するグリッド）
  private scentTurns: number[][] | null = null;

  constructor() {
    this.generator = new DungeonGenerator();
    this.loadTemplatesFromSyncConfig();
  }

  /**
   * Get room that contains the given position (if any)
   */
  getRoomAt(position: Position): Room | null {
    if (!this.currentDungeon) return null;
    const cell = this.getCellAt(position);
    if (!cell) return null;
    // そのセルが部屋タイプである場合のみ、部屋矩形内判定
    if (cell.type !== 'room') return null;
    for (const room of this.currentDungeon.rooms) {
      if (
        position.x >= room.x &&
        position.x < room.x + room.width &&
        position.y >= room.y &&
        position.y < room.y + room.height
      ) {
        return room;
      }
    }
    return null;
  }

  /**
   * Check if two positions are in the same room
   */
  isSameRoom(pos1: Position, pos2: Position): boolean {
    const r1 = this.getRoomAt(pos1);
    if (!r1) return false;
    const r2 = this.getRoomAt(pos2);
    if (!r2) return false;
    return r1.id === r2.id;
  }

  /**
   * 指定した部屋内に存在するドアセルの座標一覧を返す
   */
  getRoomDoorPositions(room: Room): Position[] {
    const result: Position[] = [];
    if (!this.currentDungeon) return result;
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        const pos = { x, y };
        const cell = this.getCellAt(pos);
        if (!cell) continue;
        if (cell.type === 'door') {
          result.push(pos);
        }
      }
    }
    return result;
  }

  /**
   * 部屋の外周セルのうち、上下左右のいずれかが通路に隣接しているセルを出口として列挙
   * 斜めは判定に含めない。
   */
  getRoomExitPositions(room: Room): Position[] {
    const result: Position[] = [];
    if (!this.currentDungeon) return result;
    const isEdge = (x: number, y: number) =>
      x === room.x || x === room.x + room.width - 1 || y === room.y || y === room.y + room.height - 1;

    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (!isEdge(x, y)) continue; // 外周のみ
        const pos = { x, y };
        const cell = this.getCellAt(pos);
        if (!cell || cell.type !== 'room') continue;
        const neighbors: Position[] = [
          { x: x, y: y - 1 }, // N
          { x: x + 1, y: y }, // E
          { x: x, y: y + 1 }, // S
          { x: x - 1, y: y }  // W
        ];
        for (const np of neighbors) {
          if (!this.isValidPosition(np)) continue;
          const nc = this.getCellAt(np);
          if (nc && nc.type === 'corridor') {
            result.push(pos);
            break;
          }
        }
      }
    }
    return result;
  }

  /**
   * 現在のターンにおけるプレイヤー視界を計算・キャッシュ
   * 視界ルール: 同じ部屋 OR プレイヤー周囲1マス（斜め含む）
   */
  ensurePlayerVisionForTurn(playerPos: Position, currentTurn: number): void {
    if (this.lastVisionTurn === currentTurn) return;
    this.playerVision.clear();

    // 同じ部屋の全セルを追加
    const room = this.getRoomAt(playerPos);
    if (room) {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          const pos = { x, y };
          if (this.isValidPosition(pos)) {
            this.playerVision.add(this.posKey(pos));
          }
        }
      }
    }

    // プレイヤー周囲1マス（斜め含む）
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const pos = { x: playerPos.x + dx, y: playerPos.y + dy };
        if (this.isValidPosition(pos)) {
          this.playerVision.add(this.posKey(pos));
        }
      }
    }

    // 自身の位置も視界に含めておく（利便性）
    this.playerVision.add(this.posKey(playerPos));

    this.lastVisionTurn = currentTurn;
  }

  /** 指定位置がプレイヤー視界に含まれるか */
  isInPlayerVision(pos: Position): boolean {
    return this.playerVision.has(this.posKey(pos));
  }

  /** 位置キー化 */
  private posKey(pos: Position): string {
    return `${pos.x},${pos.y}`;
  }

  /** 残り香グリッド初期化 */
  private initScentGrid(width: number, height: number): void {
    this.scentTurns = Array.from({ length: height }, () => Array<number>(width).fill(0));
  }

  /** 残り香の記録（プレイヤーが現在いるセルにターン番号を刻む） */
  setPlayerScent(position: Position, turn: number): void {
    if (!this.currentDungeon || !this.scentTurns) return;
    if (!this.isValidPosition(position)) return;
    this.scentTurns[position.y][position.x] = turn;
  }

  /** 指定セルの残り香ターン番号を取得（0=未記録） */
  getScentTurn(position: Position): number {
    if (!this.currentDungeon || !this.scentTurns) return 0;
    if (!this.isValidPosition(position)) return 0;
    return this.scentTurns[position.y][position.x] || 0;
  }

  /** Nターン以内の残り香か */
  isScentFresh(position: Position, currentTurn: number, horizon: number): boolean {
    const t = this.getScentTurn(position);
    return t > 0 && (currentTurn - t) <= horizon;
  }

  /** 最も新しい残り香セルを返す（Nターン以内）。見つからなければnull */
  getFreshestScentPosition(currentTurn: number, horizon: number): Position | null {
    if (!this.currentDungeon || !this.scentTurns) return null;
    let bestTurn = 0;
    let bestPos: Position | null = null;
    for (let y = 0; y < this.currentDungeon.height; y++) {
      for (let x = 0; x < this.currentDungeon.width; x++) {
        const t = this.scentTurns[y][x] || 0;
        if (t > 0 && (currentTurn - t) <= horizon && t > bestTurn) {
          bestTurn = t;
          bestPos = { x, y };
        }
      }
    }
    return bestPos;
  }

  /**
   * Generate a new dungeon from template
   */
  generateDungeon(templateId: string, floor: number, seed?: number): Dungeon {
    try {
      const template = this.dungeonTemplates.get(templateId);
      if (!template) {
        console.error('[ERROR] ダンジョンテンプレートが見つかりません:', templateId);
        throw new Error(`Dungeon template not found: ${templateId}`);
      }

      this.currentTemplateId = templateId;

      if (seed !== undefined) {
        this.generator.setSeed(seed);
      }

      // Get floor-specific generation parameters
      const floorParams = this.getFloorGenerationParams(floor);
      
      const dungeon = this.generator.generateDungeon(
        `${templateId}-floor-${floor}`,
        `${template.name} Floor ${floor}`,
        floor,
        floorParams
      );

      this.currentDungeon = dungeon;
      // 残り香グリッド初期化
      this.initScentGrid(dungeon.width, dungeon.height);

      return dungeon;
    } catch (error) {
      console.error('[ERROR] generateDungeonでエラーが発生:', error);
      throw error;
    }
  }


  /**
   * Get current dungeon
   */
  getCurrentDungeon(): Dungeon | null {
    return this.currentDungeon;
  }

  /**
   * Set current dungeon
   */
  setCurrentDungeon(dungeon: Dungeon): void {
    this.currentDungeon = dungeon;
    this.initScentGrid(dungeon.width, dungeon.height);
  }

  /**
   * Get cell at position
   */
  getCellAt(position: Position): DungeonCell | null {
    if (!this.currentDungeon) return null;
    
    const { x, y } = position;
    if (x < 0 || x >= this.currentDungeon.width || y < 0 || y >= this.currentDungeon.height) {
      return null;
    }

    return this.currentDungeon.cells[y][x];
  }

  /**
   * Check if position is within dungeon bounds
   */
  isValidPosition(position: Position): boolean {
    if (!this.currentDungeon) return false;
    
    const { x, y } = position;
    return x >= 0 && x < this.currentDungeon.width && y >= 0 && y < this.currentDungeon.height;
  }

  /**
   * Check if position is walkable
   */
  isWalkable(position: Position): boolean {
    const cell = this.getCellAt(position);
    return cell ? cell.walkable : false;
  }

  /**
   * Check if position is transparent (for line of sight)
   */
  isTransparent(position: Position): boolean {
    const cell = this.getCellAt(position);
    return cell ? cell.transparent : false;
  }

  /**
   * Add entity to dungeon at position
   */
  addEntity(entity: GameEntity, position: Position): boolean {
    const cell = this.getCellAt(position);
    if (!cell || !cell.walkable) return false;

    cell.entities.push(entity);
    entity.position = position;
    return true;
  }

  /**
   * Remove entity from dungeon
   */
  removeEntity(entity: GameEntity): boolean {
    if (!this.currentDungeon) {
      console.log(`[DungeonManager] 警告: currentDungeonがnullです`);
      return false;
    }

    console.log(`[DungeonManager] エンティティ${entity.id}の削除開始: 位置(${entity.position.x}, ${entity.position.y})`);

    const cell = this.getCellAt(entity.position);
    if (!cell) {
      console.log(`[DungeonManager] 警告: 位置(${entity.position.x}, ${entity.position.y})のセルが見つかりません`);
      return false;
    }

    // エンティティの参照で削除を試行
    let index = cell.entities.indexOf(entity);
    if (index !== -1) {
      console.log(`[DungeonManager] エンティティ参照で削除: ${entity.id}`);
      cell.entities.splice(index, 1);
      console.log(`[DungeonManager] エンティティ${entity.id}の削除完了`);
      return true;
    }

    // エンティティのIDで削除を試行（位置が変更されている場合の対策）
    index = cell.entities.findIndex(e => e.id === entity.id);
    if (index !== -1) {
      console.log(`[DungeonManager] エンティティIDで削除: ${entity.id}`);
      cell.entities.splice(index, 1);
      console.log(`[DungeonManager] エンティティ${entity.id}の削除完了`);
      return true;
    }

    // 全ダンジョン内でエンティティを検索して削除
    console.log(`[DungeonManager] 全ダンジョン内でエンティティ${entity.id}を検索中...`);
    for (let y = 0; y < this.currentDungeon.height; y++) {
      for (let x = 0; x < this.currentDungeon.width; x++) {
        const searchCell = this.currentDungeon.cells[y][x];
        const searchIndex = searchCell.entities.findIndex(e => e.id === entity.id);
        if (searchIndex !== -1) {
          console.log(`[DungeonManager] エンティティ${entity.id}を位置(${x}, ${y})で発見、削除実行`);
          searchCell.entities.splice(searchIndex, 1);
          console.log(`[DungeonManager] エンティティ${entity.id}の削除完了`);
          return true;
        }
      }
    }

    console.log(`[DungeonManager] 警告: エンティティ${entity.id}が見つかりませんでした`);
    return false;
  }

  /**
   * Move entity to new position
   */
  moveEntity(entity: GameEntity, newPosition: Position): boolean {
    if (!this.isWalkable(newPosition)) return false;

    // Remove from old position
    this.removeEntity(entity);

    // Add to new position
    return this.addEntity(entity, newPosition);
  }

  /**
   * Get entities at position
   */
  getEntitiesAt(position: Position): GameEntity[] {
    const cell = this.getCellAt(position);
    return cell ? [...cell.entities] : [];
  }

  /**
   * Remove entity from specific position
   */
  removeEntityFromPosition(entity: GameEntity, position: Position): boolean {
    const cell = this.getCellAt(position);
    if (!cell) return false;

    const index = cell.entities.findIndex(e => e.id === entity.id);
    if (index === -1) return false;

    cell.entities.splice(index, 1);
    return true;
  }

  /**
   * Get all entities in dungeon
   */
  getAllEntities(): GameEntity[] {
    if (!this.currentDungeon) return [];

    const entities: GameEntity[] = [];
    for (let y = 0; y < this.currentDungeon.height; y++) {
      for (let x = 0; x < this.currentDungeon.width; x++) {
        entities.push(...this.currentDungeon.cells[y][x].entities);
      }
    }

    return entities;
  }

  /**
   * Find entities by type
   */
  findEntitiesByType<T extends GameEntity>(predicate: (entity: GameEntity) => entity is T): T[] {
    return this.getAllEntities().filter(predicate);
  }

  /**
   * Get adjacent positions
   */
  getAdjacentPositions(position: Position, includeDiagonals: boolean = false): Position[] {
    const positions: Position[] = [];
    const { x, y } = position;

    // Cardinal directions
    const directions = [
      { x: 0, y: -1 }, // North
      { x: 1, y: 0 },  // East
      { x: 0, y: 1 },  // South
      { x: -1, y: 0 }  // West
    ];

    if (includeDiagonals) {
      directions.push(
        { x: -1, y: -1 }, // Northwest
        { x: 1, y: -1 },  // Northeast
        { x: 1, y: 1 },   // Southeast
        { x: -1, y: 1 }   // Southwest
      );
    }

    for (const dir of directions) {
      const newPos = { x: x + dir.x, y: y + dir.y };
      if (this.getCellAt(newPos)) {
        positions.push(newPos);
      }
    }

    return positions;
  }

  /**
   * Calculate distance between two positions
   */
  getDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  /**
   * Find path between two positions (simple A* implementation)
   */
  findPath(start: Position, end: Position): Position[] {
    if (!this.currentDungeon) return [];

    // Simple breadth-first search for now
    const queue: { pos: Position; path: Position[] }[] = [{ pos: start, path: [] }];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const { pos, path } = queue.shift()!;
      const key = `${pos.x},${pos.y}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      if (pos.x === end.x && pos.y === end.y) {
        return path;
      }
      
      for (const adjacent of this.getAdjacentPositions(pos, true)) {
        // 斜め移動の角抜けを防ぐ: 斜めの場合、いずれか片側でも非歩行ならスキップ
        const diag = (adjacent.x !== pos.x) && (adjacent.y !== pos.y);
        if (diag) {
          const side1 = { x: pos.x, y: adjacent.y };
          const side2 = { x: adjacent.x, y: pos.y };
          if (!this.isWalkable(side1) || !this.isWalkable(side2)) {
            continue;
          }
        }
        if (!visited.has(`${adjacent.x},${adjacent.y}`) && this.isWalkable(adjacent)) {
          queue.push({
            pos: adjacent,
            path: [...path, adjacent]
          });
        }
      }
    }
    
    return []; // No path found
  }

  /**
   * Register dungeon template
   */
  registerTemplate(template: DungeonTemplate): void {
    this.dungeonTemplates.set(template.id, template);
  }

  /**
   * Get dungeon template
   */
  getTemplate(templateId: string): DungeonTemplate | undefined {
    return this.dungeonTemplates.get(templateId);
  }

  /**
   * Get all template IDs
   */
  getTemplateIds(): string[] {
    return Array.from(this.dungeonTemplates.keys());
  }

  /** Get the template id used for the current dungeon (if any) */
  getCurrentTemplateId(): string | null {
    return this.currentTemplateId;
  }

  /** Get progression direction for current dungeon ('down' default) */
  getCurrentProgressionDirection(): 'down' | 'up' {
    if (!this.currentTemplateId) return 'down';
    const tpl = this.dungeonTemplates.get(this.currentTemplateId);
    return tpl?.generationParams?.progressionDirection || 'down';
  }

  /**
   * Load dungeon templates from synchronous configuration loader
   */
  private loadTemplatesFromSyncConfig(): void {
    try {
      const configLoader = SyncConfigLoader.getInstance();
      const templates = configLoader.getDungeonTemplates();
      
      // Convert DungeonTemplateConfig to DungeonTemplate and register
      for (const [templateId, templateConfig] of Object.entries(templates)) {
        const template: DungeonTemplate = {
          id: templateConfig.id,
          name: templateConfig.name,
          description: templateConfig.description,
          floors: templateConfig.floors,
          generationParams: {
            width: templateConfig.generationParams.width,
            height: templateConfig.generationParams.height,
            minRooms: templateConfig.generationParams.minRooms,
            maxRooms: templateConfig.generationParams.maxRooms,
            minRoomSize: templateConfig.generationParams.minRoomSize,
            maxRoomSize: templateConfig.generationParams.maxRoomSize,
            corridorWidth: templateConfig.generationParams.corridorWidth,
            roomDensity: templateConfig.generationParams.roomDensity,
            specialRoomChance: templateConfig.generationParams.specialRoomChance,
            trapDensity: templateConfig.generationParams.trapDensity,
            gridDivision: templateConfig.generationParams.gridDivision
          },
          floorSpecificParams: templateConfig.floorSpecificParams?.map(fp => ({
            floor: fp.floor,
            width: fp.width,
            height: fp.height,
            minRooms: fp.minRooms,
            maxRooms: fp.maxRooms,
            minRoomSize: fp.minRoomSize,
            maxRoomSize: fp.maxRoomSize,
            corridorWidth: fp.corridorWidth,
            roomDensity: fp.roomDensity,
            specialRoomChance: fp.specialRoomChance,
            trapDensity: fp.trapDensity,
            gridDivision: fp.gridDivision
          })),
          floorRangeParams: templateConfig.floorRangeParams?.map(rp => ({
            floorRange: rp.floorRange,
            width: rp.width,
            height: rp.height,
            minRooms: rp.minRooms,
            maxRooms: rp.maxRooms,
            minRoomSize: rp.minRoomSize,
            maxRoomSize: rp.maxRoomSize,
            corridorWidth: rp.corridorWidth,
            roomDensity: rp.roomDensity,
            specialRoomChance: rp.specialRoomChance,
            trapDensity: rp.trapDensity,
            gridDivision: rp.gridDivision
          })),
          tileSet: templateConfig.tileSet,
          monsterTable: templateConfig.monsterTable,
          itemTable: templateConfig.itemTable,
          specialRules: templateConfig.specialRules,
          itemSpawnDefault: templateConfig.itemSpawnDefault,
          itemSpawnRanges: templateConfig.itemSpawnRanges,
          // 新規: 階層別モンスター出現設定とデフォルト
          floorMonsterSpawns: templateConfig.floorMonsterSpawns,
          monsterSpawnDefault: templateConfig.monsterSpawnDefault
        };
        
        this.registerTemplate(template);
      }
    } catch (error) {
      console.error('[ERROR] 同期的な設定読み込みに失敗:', error);
      this.initializeDefaultTemplates();
    }
  }

  /**
   * Parse floor range string (e.g., "1-3", "4-5")
   */
  private parseFloorRange(rangeStr: string): { min: number; max: number } | null {
    const match = rangeStr.match(/^(\d+)-(\d+)$/);
    if (!match) return null;
    
    const min = parseInt(match[1], 10);
    const max = parseInt(match[2], 10);
    
    if (min > max) return null;
    return { min, max };
  }

  /**
   * Check if a floor is within a range
   */
  private isFloorInRange(floor: number, rangeStr: string): boolean {
    const range = this.parseFloorRange(rangeStr);
    if (!range) return false;
    
    return floor >= range.min && floor <= range.max;
  }

  /**
   * Get generation parameters for specific floor
   */
  getFloorGenerationParams(floor: number): DungeonGenerationParams {
    if (!this.currentTemplateId) {
      // Default parameters if no template
      return {
        width: 45,
        height: 45,
        minRooms: 4,
        maxRooms: 8,
        minRoomSize: 4,
        maxRoomSize: 10,
        corridorWidth: 1,
        roomDensity: 0.3,
        specialRoomChance: 0.1,
        trapDensity: 0.05,
        gridDivision: 12
      };
    }

    const tpl = this.dungeonTemplates.get(this.currentTemplateId);
    if (!tpl) {
      throw new Error(`Template not found: ${this.currentTemplateId}`);
    }

    // Check for floor range parameters first (new system)
    if (tpl.floorRangeParams) {
      const rangeParams = tpl.floorRangeParams.find(rp => {
        const isInRange = this.isFloorInRange(floor, rp.floorRange);
        return isInRange;
      });
      if (rangeParams) {
        return rangeParams;
      }
    }

    // Check for floor-specific parameters (legacy system)
    if (tpl.floorSpecificParams) {
      const floorParams = tpl.floorSpecificParams.find(fp => fp.floor === floor);
      if (floorParams) {
        return floorParams;
      }
    }

    // Fall back to default parameters
    return tpl.generationParams;
  }

  /**
   * Initialize default dungeon templates (fallback)
   */
  private initializeDefaultTemplates(): void {
    
    // Fallback to basic template if sync config fails
    const basicDungeon: DungeonTemplate = {
      id: 'basic-dungeon',
      name: 'Basic Dungeon (Fallback)',
      description: 'Fallback template for basic dungeon',
      floors: 10,
      generationParams: {
        width: 60,
        height: 45,
        minRooms: 4,
        maxRooms: 8,
        minRoomSize: 4,
        maxRoomSize: 10,
        corridorWidth: 1,
        roomDensity: 0.3,
        specialRoomChance: 0.1,
        trapDensity: 0.05,
        gridDivision: 12
      },
      floorSpecificParams: [],
      tileSet: 'basic',
      monsterTable: [],
      itemTable: [],
      specialRules: []
    };

    this.registerTemplate(basicDungeon);
    console.log('[DEBUG] デフォルトテンプレート初期化完了');
  }

  /**
   * Get dungeon statistics
   */
  getDungeonStats(): { rooms: number; corridorCells: number; totalCells: number } | null {
    if (!this.currentDungeon) return null;

    let corridorCells = 0;
    let totalCells = 0;

    for (let y = 0; y < this.currentDungeon.height; y++) {
      for (let x = 0; x < this.currentDungeon.width; x++) {
        totalCells++;
        // セルの存在チェックを追加
        if (this.currentDungeon.cells[y] && this.currentDungeon.cells[y][x] && (this.currentDungeon.cells[y][x].type === 'floor' || this.currentDungeon.cells[y][x].type === 'room' || this.currentDungeon.cells[y][x].type === 'corridor')) {
          // Check if this floor cell is part of a room
          let inRoom = false;
          for (const room of this.currentDungeon.rooms) {
            if (x >= room.x && x < room.x + room.width && 
                y >= room.y && y < room.y + room.height) {
              inRoom = true;
              break;
            }
          }
          if (!inRoom) {
            corridorCells++;
          }
        }
      }
    }

    return {
      rooms: this.currentDungeon.rooms.length,
      corridorCells,
      totalCells
    };
  }
}
