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

  private spawnHistory: Map<string, Set<number>> = new Map();

  constructor(dungeonManager: DungeonManager, itemSystem: ItemSystem, rng?: () => number) {
    this.dungeonManager = dungeonManager;
    this.itemSystem = itemSystem;
    this.rng = rng || Math.random;
  }

  /** 指定ダンジョンのスポーン履歴をリセット */
  resetSpawnHistory(dungeonId: string): void {
    this.spawnHistory.delete(dungeonId);
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

    const dungeonId = template.id || dungeon.id;
    if (dungeonId && this.hasSpawned(dungeonId, floor)) {
      console.warn(`DropSystem: Floor ${floor} in dungeon ${dungeonId} already spawned items`);
      return [];
    }

    // 個数は全ダンジョン共通の固定分布で決定
    const numItems = this.resolveSpawnCount(template, floor);
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

    if (dungeonId) {
      this.markSpawned(dungeonId, floor);
    }

    return spawned;
  }

  private determineSpawnCount(): number {
    const roll = this.rng();
    if (roll < 0.05) return 2;
    if (roll < 0.25) return 3;
    if (roll < 0.75) return 4;
    if (roll < 0.95) return 5;
    return 6;
  }

  private hasSpawned(dungeonId: string, floor: number): boolean {
    const floors = this.spawnHistory.get(dungeonId);
    return floors ? floors.has(floor) : false;
  }

  private markSpawned(dungeonId: string, floor: number): void {
    let floors = this.spawnHistory.get(dungeonId);
    if (!floors) {
      floors = new Set<number>();
      this.spawnHistory.set(dungeonId, floors);
    }
    floors.add(floor);
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

  /** 固定確率分布からスポーン個数を決定 */
  private resolveSpawnCount(_template: DungeonTemplate, _floor: number): number {
    return this.determineSpawnCount();
  }
}
