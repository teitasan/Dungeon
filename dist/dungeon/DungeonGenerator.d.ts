/**
 * Dungeon generation system
 * Implements basic random dungeon generation with rooms and corridors
 */
import { Dungeon, DungeonGenerationParams } from '../types/dungeon';
export declare class DungeonGenerator {
    private rng;
    private seed;
    constructor(seed?: number);
    /**
     * Generate a complete dungeon
     */
    generateDungeon(dungeonId: string, dungeonName: string, floor: number, params: DungeonGenerationParams): Dungeon;
    /**
     * Initialize dungeon cells with walls
     */
    private initializeCells;
    /**
     * Generate rooms in the dungeon
     */
    private generateRooms;
    /**
     * Check if a room position is valid (doesn't overlap)
     */
    private isRoomValid;
    /**
     * Carve out a room in the dungeon
     */
    private carveRoom;
    /**
     * Connect all rooms with corridors
     */
    private connectRooms;
    /**
     * Calculate distance between two rooms (center to center)
     */
    private getRoomDistance;
    /**
     * Create a corridor between two rooms
     */
    private createCorridor;
    /**
     * Carve corridor at position
     */
    private carveCorridor;
    /**
     * Place stairs in the dungeon
     */
    private placeStairs;
    /**
     * Set player spawn point
     */
    private setPlayerSpawn;
    /**
     * Create seeded random number generator
     */
    private createSeededRandom;
    /**
     * Generate random integer between min and max (inclusive)
     */
    private randomInt;
    /**
     * Get the current seed
     */
    getSeed(): number;
    /**
     * Reset with new seed
     */
    setSeed(seed: number): void;
}
//# sourceMappingURL=DungeonGenerator.d.ts.map