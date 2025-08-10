/**
 * Dungeon system types for the mystery dungeon game
 */
import { Position } from './core';
import { GameEntity } from './entities';
export type CellType = 'wall' | 'floor' | 'door' | 'stairs-up' | 'stairs-down' | 'water' | 'void';
export interface DungeonCell {
    type: CellType;
    walkable: boolean;
    transparent: boolean;
    entities: GameEntity[];
    trap?: Trap;
    special?: SpecialFeature;
}
export interface Room {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: RoomType;
    connected: boolean;
    connections: Connection[];
}
export type RoomType = 'normal' | 'monster-house' | 'shop' | 'treasure' | 'boss' | 'special';
export interface Connection {
    roomId: string;
    corridorPath: Position[];
    doorPosition?: Position;
}
export interface Dungeon {
    id: string;
    name: string;
    floor: number;
    width: number;
    height: number;
    cells: DungeonCell[][];
    rooms: Room[];
    stairsUp?: Position;
    stairsDown?: Position;
    playerSpawn: Position;
    generationSeed: number;
}
export interface Trap {
    id: string;
    type: TrapType;
    visible: boolean;
    triggered: boolean;
    damage?: number;
    effect?: string;
}
export type TrapType = 'spike' | 'poison' | 'confusion' | 'teleport' | 'monster' | 'hunger' | 'stat-drain' | 'rust';
export interface SpecialFeature {
    id: string;
    type: SpecialFeatureType;
    data?: any;
}
export type SpecialFeatureType = 'fountain' | 'altar' | 'chest' | 'switch' | 'portal';
export interface DungeonGenerationParams {
    width: number;
    height: number;
    minRooms: number;
    maxRooms: number;
    minRoomSize: number;
    maxRoomSize: number;
    corridorWidth: number;
    roomDensity: number;
    specialRoomChance: number;
    trapDensity: number;
    seed?: number;
    /**
     * 進行方向（デフォルト: 'down'）
     * 'down': 各フロアに下り階段のみ生成
     * 'up':   各フロアに上り階段のみ生成
     */
    progressionDirection?: 'down' | 'up';
}
export interface DungeonTemplate {
    id: string;
    name: string;
    description: string;
    floors: number;
    generationParams: DungeonGenerationParams;
    tileSet: string;
    monsterTable: MonsterSpawnEntry[];
    itemTable: ItemSpawnEntry[];
    specialRules: DungeonRule[];
}
export interface MonsterSpawnEntry {
    monsterId: string;
    weight: number;
    minFloor: number;
    maxFloor: number;
    spawnConditions?: SpawnCondition[];
}
export interface ItemSpawnEntry {
    itemId: string;
    weight: number;
    minFloor: number;
    maxFloor: number;
    spawnConditions?: SpawnCondition[];
}
export interface SpawnCondition {
    type: 'room-type' | 'floor-range' | 'special-event' | 'player-level';
    value: any;
}
export interface DungeonRule {
    id: string;
    type: 'hunger-rate' | 'item-identification' | 'monster-level' | 'special-mechanic';
    value: any;
    description: string;
}
export declare enum Direction {
    North = 0,
    East = 1,
    South = 2,
    West = 3
}
export declare const DirectionVectors: Record<Direction, Position>;
export declare const OppositeDirection: Record<Direction, Direction>;
//# sourceMappingURL=dungeon.d.ts.map