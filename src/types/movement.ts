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
  data?: any;
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
  currentPhaseIndex: number;
  entitySpeedStates: Map<string, EntitySpeedState>;
  phaseEntityStates: Map<string, {
    hasMovedThisPhase: boolean;
    hasActedThisPhase: boolean;
    trapTriggered: boolean;
  }>;
}

export type TurnPhase = 
  | 'turn-start'
  | 'player-action-1' | 'player-action-2'
  | 'enemy-action-1' | 'enemy-action-2' 
  | 'ally-action-1' | 'ally-action-2'
  | 'trap-processing-1' | 'trap-processing-2'
  | 'mid-turn-recovery' | 'end-turn-recovery'
  | 'end-turn';

// Turn action
export interface TurnAction {
  type: TurnActionType;
  entity: GameEntity;
  data?: any;
  cost: number; // Turn cost (1 = full turn, 0.5 = half turn, etc.)
}

export type TurnActionType = 'move' | 'attack' | 'use-item' | 'wait' | 'special';

// Speed system types
export type SpeedState = 'normal' | 'fast' | 'slow';

export interface ActionConfig {
  enabled: boolean;
  canMove: boolean;
  canAttack: boolean;
  canUseItem: boolean;
  adjacentRule?: boolean;  // 隣接時のスキップルール
  skipTurns?: number;      // スキップするターン数（鈍足用）
}

export interface SpeedSystemConfig {
  normal: {
    action1: ActionConfig;
    action2: ActionConfig;
    description: string;
  };
  fast: {
    action1: ActionConfig;
    action2: ActionConfig;
    description: string;
  };
  slow: {
    action1: ActionConfig;
    action2: ActionConfig;
    description: string;
  };
}

// Turn phase configuration
export interface TurnPhaseConfig {
  phase: TurnPhase;
  description: string;
  conditions: string[];
}

// Turn system configuration
export interface TurnSystemConfig {
  phases: TurnPhaseConfig[];
  speedSystem: SpeedSystemConfig;
  endTurnProcessing: EndTurnProcess[];
}

export interface EndTurnProcess {
  process: 'status-recovery' | 'slip-damage' | 'hunger-decrease';
  order: number;
  description: string;
}

// Entity speed state tracking
export interface EntitySpeedState {
  entityId: string;
  speedState: SpeedState;
  action1State: {
    canAct: boolean;
    hasActed: boolean;
    hasMoved: boolean;
    hasAttacked: boolean;
    hasUsedItem: boolean;
  };
  action2State: {
    canAct: boolean;
    hasActed: boolean;
    hasMoved: boolean;
    hasAttacked: boolean;
    hasUsedItem: boolean;
    wasAdjacentAfterAction1: boolean;
  };
  turnsUntilNextAction: number; // For slow entities
  customRules?: {
    action1?: Partial<ActionConfig>;
    action2?: Partial<ActionConfig>;
  };
}

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

export interface ActionResult {
  success: boolean;        // 行動が成功したか
  actionType: 'move' | 'attack' | 'item' | 'equip' | 'wait';
  consumedTurn: boolean;   // ターンを消費したか
  message?: string;        // 結果メッセージ
  data?: any;              // 追加データ
}