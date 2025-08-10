/**
 * Dungeon management system
 * Handles dungeon creation, loading, and state management
 */
import { DungeonGenerator } from './DungeonGenerator.js';
export class DungeonManager {
    currentDungeon = null;
    dungeonTemplates = new Map();
    generator;
    currentTemplateId = null;
    constructor() {
        this.generator = new DungeonGenerator();
        this.initializeDefaultTemplates();
    }
    /**
     * Generate a new dungeon from template
     */
    generateDungeon(templateId, floor, seed) {
        const template = this.dungeonTemplates.get(templateId);
        if (!template) {
            throw new Error(`Dungeon template not found: ${templateId}`);
        }
        this.currentTemplateId = templateId;
        if (seed !== undefined) {
            this.generator.setSeed(seed);
        }
        const dungeon = this.generator.generateDungeon(`${templateId}-floor-${floor}`, `${template.name} Floor ${floor}`, floor, template.generationParams);
        this.currentDungeon = dungeon;
        return dungeon;
    }
    /**
     * Get current dungeon
     */
    getCurrentDungeon() {
        return this.currentDungeon;
    }
    /**
     * Set current dungeon
     */
    setCurrentDungeon(dungeon) {
        this.currentDungeon = dungeon;
    }
    /**
     * Get cell at position
     */
    getCellAt(position) {
        if (!this.currentDungeon)
            return null;
        const { x, y } = position;
        if (x < 0 || x >= this.currentDungeon.width || y < 0 || y >= this.currentDungeon.height) {
            return null;
        }
        return this.currentDungeon.cells[y][x];
    }
    /**
     * Check if position is walkable
     */
    isWalkable(position) {
        const cell = this.getCellAt(position);
        return cell ? cell.walkable : false;
    }
    /**
     * Check if position is transparent (for line of sight)
     */
    isTransparent(position) {
        const cell = this.getCellAt(position);
        return cell ? cell.transparent : false;
    }
    /**
     * Add entity to dungeon at position
     */
    addEntity(entity, position) {
        const cell = this.getCellAt(position);
        if (!cell || !cell.walkable)
            return false;
        cell.entities.push(entity);
        entity.position = position;
        return true;
    }
    /**
     * Remove entity from dungeon
     */
    removeEntity(entity) {
        if (!this.currentDungeon)
            return false;
        const cell = this.getCellAt(entity.position);
        if (!cell)
            return false;
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
    moveEntity(entity, newPosition) {
        if (!this.isWalkable(newPosition))
            return false;
        // Remove from old position
        this.removeEntity(entity);
        // Add to new position
        return this.addEntity(entity, newPosition);
    }
    /**
     * Get entities at position
     */
    getEntitiesAt(position) {
        const cell = this.getCellAt(position);
        return cell ? [...cell.entities] : [];
    }
    /**
     * Get all entities in dungeon
     */
    getAllEntities() {
        if (!this.currentDungeon)
            return [];
        const entities = [];
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
    findEntitiesByType(predicate) {
        return this.getAllEntities().filter(predicate);
    }
    /**
     * Get adjacent positions
     */
    getAdjacentPositions(position, includeDiagonals = false) {
        const positions = [];
        const { x, y } = position;
        // Cardinal directions
        const directions = [
            { x: 0, y: -1 }, // North
            { x: 1, y: 0 }, // East
            { x: 0, y: 1 }, // South
            { x: -1, y: 0 } // West
        ];
        if (includeDiagonals) {
            directions.push({ x: -1, y: -1 }, // Northwest
            { x: 1, y: -1 }, // Northeast
            { x: 1, y: 1 }, // Southeast
            { x: -1, y: 1 } // Southwest
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
    getDistance(pos1, pos2) {
        return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
    }
    /**
     * Find path between two positions (simple A* implementation)
     */
    findPath(start, end) {
        if (!this.currentDungeon)
            return [];
        // Simple breadth-first search for now
        const queue = [{ pos: start, path: [] }];
        const visited = new Set();
        while (queue.length > 0) {
            const { pos, path } = queue.shift();
            const key = `${pos.x},${pos.y}`;
            if (visited.has(key))
                continue;
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
    registerTemplate(template) {
        this.dungeonTemplates.set(template.id, template);
    }
    /**
     * Get dungeon template
     */
    getTemplate(templateId) {
        return this.dungeonTemplates.get(templateId);
    }
    /**
     * Get all template IDs
     */
    getTemplateIds() {
        return Array.from(this.dungeonTemplates.keys());
    }
    /** Get the template id used for the current dungeon (if any) */
    getCurrentTemplateId() {
        return this.currentTemplateId;
    }
    /** Get progression direction for current dungeon ('down' default) */
    getCurrentProgressionDirection() {
        if (!this.currentTemplateId)
            return 'down';
        const tpl = this.dungeonTemplates.get(this.currentTemplateId);
        return tpl?.generationParams?.progressionDirection || 'down';
    }
    /**
     * Initialize default dungeon templates
     */
    initializeDefaultTemplates() {
        // Basic dungeon template
        const basicDungeon = {
            id: 'basic-dungeon',
            name: 'Basic Dungeon',
            description: 'A simple dungeon with rooms and corridors',
            floors: 10,
            generationParams: {
                width: 40,
                height: 30,
                minRooms: 4,
                maxRooms: 8,
                minRoomSize: 4,
                maxRoomSize: 10,
                corridorWidth: 1,
                roomDensity: 0.3,
                specialRoomChance: 0.1,
                trapDensity: 0.05
            },
            tileSet: 'basic',
            monsterTable: [],
            itemTable: [],
            specialRules: []
        };
        // Large dungeon template
        const largeDungeon = {
            id: 'large-dungeon',
            name: 'Large Dungeon',
            description: 'A larger dungeon with more rooms',
            floors: 20,
            generationParams: {
                width: 60,
                height: 45,
                minRooms: 8,
                maxRooms: 15,
                minRoomSize: 5,
                maxRoomSize: 12,
                corridorWidth: 1,
                roomDensity: 0.4,
                specialRoomChance: 0.15,
                trapDensity: 0.08
            },
            tileSet: 'stone',
            monsterTable: [],
            itemTable: [],
            specialRules: []
        };
        this.registerTemplate(basicDungeon);
        this.registerTemplate(largeDungeon);
    }
    /**
     * Get dungeon statistics
     */
    getDungeonStats() {
        if (!this.currentDungeon)
            return null;
        let corridorCells = 0;
        let totalCells = 0;
        for (let y = 0; y < this.currentDungeon.height; y++) {
            for (let x = 0; x < this.currentDungeon.width; x++) {
                totalCells++;
                if (this.currentDungeon.cells[y][x].type === 'floor') {
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
//# sourceMappingURL=DungeonManager.js.map