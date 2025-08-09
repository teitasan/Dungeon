/**
 * Movement and turn system types
 */
import { Position } from './core';
import { GameEntity } from './entities';
export type MovementDirection = 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest';
export interface MovementResult {
    success: boolean;
    newPosition?: Position;
    blocked?: boolean;
    reason?: string;
    triggeredEvents?: MovementEvent[];
}
export interface MovementEvent {
    type: MovementEventType;
    entity: GameEntity;
    position: Position;
    data?: any;
}
export type MovementEventType = 'trap-triggered' | 'item-pickup' | 'stairs-used' | 'collision' | 'special-tile';
export interface TurnManager {
    currentTurn: number;
    turnOrder: GameEntity[];
    currentEntityIndex: number;
    turnPhase: TurnPhase;
}
export type TurnPhase = 'player-action' | 'recovery' | 'ally-movement' | 'enemy-movement' | 'traps' | 'attacks' | 'end-turn';
export interface TurnAction {
    type: TurnActionType;
    entity: GameEntity;
    data?: any;
    cost: number;
}
export type TurnActionType = 'move' | 'attack' | 'use-item' | 'wait' | 'special';
export interface InputHandler {
    handleKeyPress(key: string): TurnAction | null;
    handleMouseClick(position: Position): TurnAction | null;
}
export interface MovementConstraints {
    canMoveDiagonally: boolean;
    canMoveIntoOccupiedSpace: boolean;
    canMoveIntoWalls: boolean;
    movementSpeed: number;
}
export declare const DirectionVectors: Record<MovementDirection, Position>;
export declare const KeyToDirection: Record<string, MovementDirection>;
//# sourceMappingURL=movement.d.ts.map