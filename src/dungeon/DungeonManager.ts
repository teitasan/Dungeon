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
  CellType 
} from '../types/dungeon';
import { DungeonGenerator } from './DungeonGenerator.js';
import { SyncConfigLoader, DungeonTemplateConfig } from '../core/SyncConfigLoader.js';

export class DungeonManager {
  private currentDungeon: Dungeon | null = null;
  private dungeonTemplates: Map<string, DungeonTemplate> = new Map();
  private generator: DungeonGenerator;
  private currentTemplateId: string | null = null;

  constructor() {
    this.generator = new DungeonGenerator();
    this.loadTemplatesFromSyncConfig();
  }

  /**
   * Generate a new dungeon from template
   */
  generateDungeon(templateId: string, floor: number, seed?: number): Dungeon {
    try {
      console.log('[DEBUG] generateDungeon: 開始, templateId:', templateId, 'floor:', floor);
      
      const template = this.dungeonTemplates.get(templateId);
      if (!template) {
        console.error('[ERROR] ダンジョンテンプレートが見つかりません:', templateId);
        throw new Error(`Dungeon template not found: ${templateId}`);
      }
      console.log('[DEBUG] テンプレート取得完了:', template.name);

      this.currentTemplateId = templateId;

      if (seed !== undefined) {
        this.generator.setSeed(seed);
        console.log('[DEBUG] シード設定:', seed);
      }

      console.log('[DEBUG] ダンジョン生成中...');
      // Get floor-specific generation parameters
      const floorParams = this.getFloorGenerationParams(floor);
      console.log('[DEBUG] 使用する生成パラメータ:', floorParams);
      
      const dungeon = this.generator.generateDungeon(
        `${templateId}-floor-${floor}`,
        `${template.name} Floor ${floor}`,
        floor,
        floorParams
      );
      console.log('[DEBUG] ダンジョン生成完了, サイズ:', dungeon.width, 'x', dungeon.height);

      this.currentDungeon = dungeon;
      console.log('[DEBUG] currentDungeon設定完了');

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
    if (!this.currentDungeon) return false;

    const cell = this.getCellAt(entity.position);
    if (!cell) return false;

    const index = cell.entities.indexOf(entity);
    if (index !== -1) {
      cell.entities.splice(index, 1);
      return true;
    }

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
      
      for (const adjacent of this.getAdjacentPositions(pos)) {
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
      console.log('[DEBUG] 同期的な設定ローダーからダンジョンテンプレートを読み込み中...');
      
      const configLoader = SyncConfigLoader.getInstance();
      const templates = configLoader.getDungeonTemplates();
      
      console.log('[DEBUG] 設定からテンプレートを読み込み:', Object.keys(templates));
      
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
          itemSpawnRanges: templateConfig.itemSpawnRanges
        };
        
        this.registerTemplate(template);
        console.log(`[DEBUG] テンプレート登録完了: ${template.name}`);
      }
      
      console.log('[DEBUG] 同期的な設定読み込み完了');
    } catch (error) {
      console.error('[ERROR] 同期的な設定読み込みに失敗:', error);
      console.log('[DEBUG] デフォルトテンプレートを使用');
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

    console.log(`[DEBUG] テンプレート ${this.currentTemplateId} のパラメータを確認:`, {
      hasFloorRangeParams: !!tpl.floorRangeParams,
      floorRangeParamsLength: tpl.floorRangeParams?.length || 0,
      hasFloorSpecificParams: !!tpl.floorSpecificParams,
      floorSpecificParamsLength: tpl.floorSpecificParams?.length || 0,
      generationParams: tpl.generationParams
    });

    // Check for floor range parameters first (new system)
    if (tpl.floorRangeParams) {
      console.log(`[DEBUG] floorRangeParams をチェック:`, tpl.floorRangeParams);
      const rangeParams = tpl.floorRangeParams.find(rp => {
        const isInRange = this.isFloorInRange(floor, rp.floorRange);
        console.log(`[DEBUG] 範囲チェック: ${rp.floorRange} for floor ${floor} = ${isInRange}`);
        return isInRange;
      });
      if (rangeParams) {
        console.log(`[DEBUG] 階層${floor}用の範囲設定を使用: ${rangeParams.floorRange}`, rangeParams);
        return rangeParams;
      }
    } else {
      console.log(`[DEBUG] floorRangeParams が存在しません`);
    }

    // Check for floor-specific parameters (legacy system)
    if (tpl.floorSpecificParams) {
      const floorParams = tpl.floorSpecificParams.find(fp => fp.floor === floor);
      if (floorParams) {
        console.log(`[DEBUG] 階層${floor}用の設定を使用:`, floorParams);
        return floorParams;
      }
    }

    // Fall back to default parameters
    console.log(`[DEBUG] 階層${floor}用の設定が見つからないため、デフォルト設定を使用:`, tpl.generationParams);
    return tpl.generationParams;
  }

  /**
   * Initialize default dungeon templates (fallback)
   */
  private initializeDefaultTemplates(): void {
    console.log('[DEBUG] デフォルトテンプレートを初期化中...');
    
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
