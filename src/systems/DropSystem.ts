/**
 * Drop and spawn system for items
 * - Enemy drop on death based on weighted drop tables
 * - Floor item spawning using dungeon template item tables
 */

import { DungeonManager } from '../dungeon/DungeonManager';
import { ItemSystem } from './ItemSystem';
import { ItemEntity } from '../entities/Item';
import { MonsterEntity } from '../entities/Monster';
import { DungeonTemplate } from '../types/dungeon';

export class DropSystem {
  private dungeonManager: DungeonManager;
  private itemSystem: ItemSystem;
  private rng: () => number;

  constructor(dungeonManager: DungeonManager, itemSystem: ItemSystem, rng?: () => number) {
    this.dungeonManager = dungeonManager;
    this.itemSystem = itemSystem;
    this.rng = rng || Math.random;
  }

  /**
   * Handle drops for a defeated monster
   * Returns array of created ItemEntities (also placed on the ground)
   */
  dropFromMonster(monster: MonsterEntity): ItemEntity[] {
    if (monster.dropTable.length === 0) return [];

    const dropped: ItemEntity[] = [];

    // Weighted selection: pick one entry per defeat by default
    const entry = this.pickWeighted(monster.dropTable);
    if (!entry) return [];

    const quantity = this.randomInt(entry.quantity.min, entry.quantity.max);
    for (let i = 0; i < quantity; i++) {
      const item = this.itemSystem.createItem(entry.itemId, { ...monster.position });
      if (item) {
        const placed = this.dungeonManager.addEntity(item, monster.position);
        if (placed) {
          dropped.push(item);
        }
      }
    }

    return dropped;
  }

  /**
   * Spawn floor items after dungeon generation using the template's item table
   * Places a small number of items in random walkable positions
   */
  spawnFloorItems(template: DungeonTemplate, floor: number): ItemEntity[] {
    const dungeon = this.dungeonManager.getCurrentDungeon();
    if (!dungeon || template.itemTable.length === 0) return [];

    // 個数はテンプレートの itemSpawnRanges / itemSpawnDefault から決定（なければ 3-5）
    const [minItems, maxItems] = this.resolveSpawnCount(template, floor);
    const numItems = this.randomInt(minItems, maxItems);
    const spawned: ItemEntity[] = [];

    for (let i = 0; i < numItems; i++) {
      const candidates = template.itemTable.filter(e => floor >= e.minFloor && floor <= e.maxFloor);
      if (candidates.length === 0) break;

      const entry = this.pickWeighted(candidates);
      if (!entry) continue;

      // 部屋タイル内に限定してランダム配置（タイルで判定）
      let attempts = 0;
      let placed = false;
      while (attempts < 50 && !placed) {
        // ランダムな部屋を選び、その中のランダムタイルを選ぶ
        if (dungeon.rooms.length === 0) break;
        const room = dungeon.rooms[this.randomInt(0, dungeon.rooms.length - 1)];
        const rx = this.randomInt(room.x, room.x + room.width - 1);
        const ry = this.randomInt(room.y, room.y + room.height - 1);
        const pos = { x: rx, y: ry };
        const cell = dungeon.cells[ry]?.[rx];
        if (cell && cell.walkable && cell.type === 'room' && cell.entities.length === 0) {
          const item = this.itemSystem.createItem(entry.itemId, pos);
          if (item && this.dungeonManager.addEntity(item, pos)) {
            console.log(`DropSystem: Spawned item ${entry.itemId} at (${pos.x}, ${pos.y})`);
            spawned.push(item);
            placed = true;
          } else {
            console.warn(`DropSystem: Failed to create/spawn item ${entry.itemId}`);
          }
        }
        attempts++;
      }
    }

    return spawned;
  }

  private pickWeighted<T extends { weight: number }>(entries: T[]): T | null {
    const total = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
    if (total <= 0) return null;
    let r = this.rng() * total;
    for (const e of entries) {
      r -= Math.max(0, e.weight);
      if (r <= 0) return e;
    }
    return entries[entries.length - 1] || null;
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  /** テンプレートの設定からスポーン個数(min,max)を解決 */
  private resolveSpawnCount(template: DungeonTemplate, floor: number): [number, number] {
    // 範囲設定があれば優先
    if (template.itemSpawnRanges && template.itemSpawnRanges.length > 0) {
      const found = template.itemSpawnRanges.find(r => this.isInRange(floor, r.floorRange));
      if (found) return [Math.max(0, found.min), Math.max(found.min, found.max)];
    }
    // デフォルト
    if (template.itemSpawnDefault) {
      const d = template.itemSpawnDefault;
      return [Math.max(0, d.min), Math.max(d.min, d.max)];
    }
    // フォールバック
    return [3, 5];
  }

  private isInRange(floor: number, range: string): boolean {
    const m = range.match(/^(\d+)-(\d+)$/);
    if (!m) return false;
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    return floor >= min && floor <= max;
  }
}
