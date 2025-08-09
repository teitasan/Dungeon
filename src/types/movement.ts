/**
 * Movement and turn system types
 */

import { Position } from './core';
import { GameEntity } from './entities';

// Movement direction
export type MovementDirection = 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest';

// Movement result
export interface MovementResult {
  success: boolean;
  newPosition?: Position;
  blocked?: boolean;
  reason?: string;
  triggeredEvents?: MovementEvent[];
}

// Movement event (traps, interactions, etc.)
export interface MovementEvent {
  type: MovementEventType;
  entity: GameEntity;
  position: Position;
  data?: any;
}

export type MovementEventType = 'trap-triggered' | 'item-pickup' | 'stairs-used' | 'collision' | 'special-tile';

// Turn system types
export interface TurnManager {
  currentTurn: number;
  turnOrder: GameEntity[];
  currentEntityIndex: number;
  turnPhase: TurnPhase;
}

export type TurnPhase = 'player-action' | 'recovery' | 'ally-movement' | 'enemy-movement' | 'traps' | 'attacks' | 'end-turn';

// Turn action
export interface TurnAction {
  type: TurnActionType;
  entity: GameEntity;
  data?: any;
  cost: number; // Turn cost (1 = full turn, 0.5 = half turn, etc.)
}

export type TurnActionType = 'move' | 'attack' | 'use-item' | 'wait' | 'special';

// Input handling
export interface InputHandler {
  handleKeyPress(key: string): TurnAction | null;
  handleMouseClick(position: Position): TurnAction | null;
}

// Movement constraints
export interface MovementConstraints {
  canMoveDiagonally: boolean;
  canMoveIntoOccupiedSpace: boolean;
  canMoveIntoWalls: boolean;
  movementSpeed: number; // Multiplier for movement cost
}

// Direction vectors for movement
export const DirectionVectors: Record<MovementDirection, Position> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
  northeast: { x: 1, y: -1 },
  northwest: { x: -1, y: -1 },
  southeast: { x: 1, y: 1 },
  southwest: { x: -1, y: 1 }
};

// Key mappings for movement
export const KeyToDirection: Record<string, MovementDirection> = {
  'ArrowUp': 'north',
  'ArrowDown': 'south',
  'ArrowLeft': 'west',
  'ArrowRight': 'east',
  'w': 'north',
  's': 'south',
  'a': 'west',
  'd': 'east',
  'q': 'northwest',
  'e': 'northeast',
  'z': 'southwest',
  'c': 'southeast'
};