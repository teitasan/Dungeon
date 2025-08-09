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
export declare class DropSystem {
    private dungeonManager;
    private itemSystem;
    private rng;
    constructor(dungeonManager: DungeonManager, itemSystem: ItemSystem, rng?: () => number);
    /**
     * Handle drops for a defeated monster
     * Returns array of created ItemEntities (also placed on the ground)
     */
    dropFromMonster(monster: MonsterEntity): ItemEntity[];
    /**
     * Spawn floor items after dungeon generation using the template's item table
     * Places a small number of items in random walkable positions
     */
    spawnFloorItems(template: DungeonTemplate, floor: number, minItems?: number, maxItems?: number): ItemEntity[];
    private pickWeighted;
    private randomInt;
}
//# sourceMappingURL=DropSystem.d.ts.map