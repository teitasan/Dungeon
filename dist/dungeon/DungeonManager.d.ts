/**
 * Dungeon management system
 * Handles dungeon creation, loading, and state management
 */
import { Position } from '../types/core';
import { GameEntity } from '../types/entities';
import { Dungeon, DungeonCell, DungeonTemplate } from '../types/dungeon';
export declare class DungeonManager {
    private currentDungeon;
    private dungeonTemplates;
    private generator;
    private currentTemplateId;
    constructor();
    /**
     * Generate a new dungeon from template
     */
    generateDungeon(templateId: string, floor: number, seed?: number): Dungeon;
    /**
     * Get current dungeon
     */
    getCurrentDungeon(): Dungeon | null;
    /**
     * Set current dungeon
     */
    setCurrentDungeon(dungeon: Dungeon): void;
    /**
     * Get cell at position
     */
    getCellAt(position: Position): DungeonCell | null;
    /**
     * Check if position is walkable
     */
    isWalkable(position: Position): boolean;
    /**
     * Check if position is transparent (for line of sight)
     */
    isTransparent(position: Position): boolean;
    /**
     * Add entity to dungeon at position
     */
    addEntity(entity: GameEntity, position: Position): boolean;
    /**
     * Remove entity from dungeon
     */
    removeEntity(entity: GameEntity): boolean;
    /**
     * Move entity to new position
     */
    moveEntity(entity: GameEntity, newPosition: Position): boolean;
    /**
     * Get entities at position
     */
    getEntitiesAt(position: Position): GameEntity[];
    /**
     * Get all entities in dungeon
     */
    getAllEntities(): GameEntity[];
    /**
     * Find entities by type
     */
    findEntitiesByType<T extends GameEntity>(predicate: (entity: GameEntity) => entity is T): T[];
    /**
     * Get adjacent positions
     */
    getAdjacentPositions(position: Position, includeDiagonals?: boolean): Position[];
    /**
     * Calculate distance between two positions
     */
    getDistance(pos1: Position, pos2: Position): number;
    /**
     * Find path between two positions (simple A* implementation)
     */
    findPath(start: Position, end: Position): Position[];
    /**
     * Register dungeon template
     */
    registerTemplate(template: DungeonTemplate): void;
    /**
     * Get dungeon template
     */
    getTemplate(templateId: string): DungeonTemplate | undefined;
    /**
     * Get all template IDs
     */
    getTemplateIds(): string[];
    /** Get the template id used for the current dungeon (if any) */
    getCurrentTemplateId(): string | null;
    /** Get progression direction for current dungeon ('down' default) */
    getCurrentProgressionDirection(): 'down' | 'up';
    /**
     * Initialize default dungeon templates
     */
    private initializeDefaultTemplates;
    /**
     * Get dungeon statistics
     */
    getDungeonStats(): {
        rooms: number;
        corridorCells: number;
        totalCells: number;
    } | null;
}
//# sourceMappingURL=DungeonManager.d.ts.map