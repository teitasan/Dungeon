/**
 * Drop and spawn system for items
 * - Enemy drop on death based on weighted drop tables
 * - Floor item spawning using dungeon template item tables
 */
export class DropSystem {
    dungeonManager;
    itemSystem;
    rng;
    constructor(dungeonManager, itemSystem, rng) {
        this.dungeonManager = dungeonManager;
        this.itemSystem = itemSystem;
        this.rng = rng || Math.random;
    }
    /**
     * Handle drops for a defeated monster
     * Returns array of created ItemEntities (also placed on the ground)
     */
    dropFromMonster(monster) {
        if (monster.dropTable.length === 0)
            return [];
        const dropped = [];
        // Weighted selection: pick one entry per defeat by default
        const entry = this.pickWeighted(monster.dropTable);
        if (!entry)
            return [];
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
    spawnFloorItems(template, floor, minItems = 3, maxItems = 6) {
        const dungeon = this.dungeonManager.getCurrentDungeon();
        if (!dungeon || template.itemTable.length === 0)
            return [];
        const numItems = this.randomInt(minItems, maxItems);
        const spawned = [];
        for (let i = 0; i < numItems; i++) {
            const candidates = template.itemTable.filter(e => floor >= e.minFloor && floor <= e.maxFloor);
            if (candidates.length === 0)
                break;
            const entry = this.pickWeighted(candidates);
            if (!entry)
                continue;
            // Find random walkable position
            let attempts = 0;
            let placed = false;
            while (attempts < 50 && !placed) {
                const x = this.randomInt(0, dungeon.width - 1);
                const y = this.randomInt(0, dungeon.height - 1);
                const pos = { x, y };
                if (this.dungeonManager.isWalkable(pos)) {
                    const item = this.itemSystem.createItem(entry.itemId, pos);
                    if (item && this.dungeonManager.addEntity(item, pos)) {
                        spawned.push(item);
                        placed = true;
                    }
                }
                attempts++;
            }
        }
        return spawned;
    }
    pickWeighted(entries) {
        const total = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
        if (total <= 0)
            return null;
        let r = this.rng() * total;
        for (const e of entries) {
            r -= Math.max(0, e.weight);
            if (r <= 0)
                return e;
        }
        return entries[entries.length - 1] || null;
    }
    randomInt(min, max) {
        return Math.floor(this.rng() * (max - min + 1)) + min;
    }
}
//# sourceMappingURL=DropSystem.js.map