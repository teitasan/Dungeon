/**
 * Dungeon system types for the mystery dungeon game
 */

import { Position } from './core';
import { GameEntity } from './entities';

// Dungeon cell types
export type CellType = 'wall' | 'floor' | 'room' | 'corridor' | 'door' | 'stairs-up' | 'stairs-down' | 'water' | 'void';

// Dungeon cell structure
export interface DungeonCell {
  type: CellType;
  walkable: boolean;
  transparent: boolean;
  entities: GameEntity[];
  trap?: Trap;
  special?: SpecialFeature;
}

// Room structure
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

// Connection between rooms
export interface Connection {
  roomId: string;
  corridorPath: Position[];
  doorPosition?: Position;
}

// Dungeon structure
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

// Trap types
export interface Trap {
  id: string;
  type: TrapType;
  visible: boolean;
  triggered: boolean;
  damage?: number;
  effect?: string;
}

export type TrapType = 'spike' | 'poison' | 'confusion' | 'teleport' | 'monster' | 'hunger' | 'stat-drain' | 'rust';

// Special features
export interface SpecialFeature {
  id: string;
  type: SpecialFeatureType;
  data?: any;
}

export type SpecialFeatureType = 'fountain' | 'altar' | 'chest' | 'switch' | 'portal';

// Dungeon generation parameters
export interface DungeonGenerationParams {
  width: number;
  height: number;
  minRooms: number;
  maxRooms: number;
  minRoomSize: number;
  maxRoomSize: number;
  corridorWidth: number;
  roomDensity: number; // 0.0 - 1.0
  specialRoomChance: number; // 0.0 - 1.0
  trapDensity: number; // 0.0 - 1.0
  seed?: number;
  /**
   * 進行方向（デフォルト: 'down'）
   * 'down': 各フロアに下り階段のみ生成
   * 'up':   各フロアに上り階段のみ生成
   */
  progressionDirection?: 'down' | 'up';
}

// Dungeon template for different dungeon types
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

// Monster spawn entry
export interface MonsterSpawnEntry {
  monsterId: string;
  weight: number;
  minFloor: number;
  maxFloor: number;
  spawnConditions?: SpawnCondition[];
}

// Item spawn entry
export interface ItemSpawnEntry {
  itemId: string;
  weight: number;
  minFloor: number;
  maxFloor: number;
  spawnConditions?: SpawnCondition[];
}

// Spawn condition
export interface SpawnCondition {
  type: 'room-type' | 'floor-range' | 'special-event' | 'player-level';
  value: any;
}

// Dungeon rules
export interface DungeonRule {
  id: string;
  type: 'hunger-rate' | 'item-identification' | 'monster-level' | 'special-mechanic';
  value: any;
  description: string;
}

// Direction enum for dungeon generation
export enum Direction {
  North = 0,
  East = 1,
  South = 2,
  West = 3
}

// Utility functions for direction
export const DirectionVectors: Record<Direction, Position> = {
  [Direction.North]: { x: 0, y: -1 },
  [Direction.East]: { x: 1, y: 0 },
  [Direction.South]: { x: 0, y: 1 },
  [Direction.West]: { x: -1, y: 0 }
};

export const OppositeDirection: Record<Direction, Direction> = {
  [Direction.North]: Direction.South,
  [Direction.East]: Direction.West,
  [Direction.South]: Direction.North,
  [Direction.West]: Direction.East
};