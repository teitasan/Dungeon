/**
 * Movement system for handling entity movement
 */
import { Position } from '../types/core';
import { GameEntity } from '../types/entities';
import { MovementDirection, MovementResult, MovementConstraints } from '../types/movement';
import { DungeonManager } from '../dungeon/DungeonManager';
export declare class MovementSystem {
    private dungeonManager;
    private defaultConstraints;
    constructor(dungeonManager: DungeonManager);
    /**
     * Attempt to move an entity in a direction
     */
    moveEntity(entity: GameEntity, direction: MovementDirection, constraints?: Partial<MovementConstraints>): MovementResult;
    /**
     * Move entity to specific position
     */
    moveEntityToPosition(entity: GameEntity, targetPosition: Position, constraints?: Partial<MovementConstraints>): MovementResult;
    /**
     * Get valid movement directions from current position
     */
    getValidMovements(entity: GameEntity, constraints?: Partial<MovementConstraints>): MovementDirection[];
    /**
     * Check if a position is valid for movement
     */
    private isValidMovement;
    /**
     * Check if direction is diagonal
     */
    private isDiagonalDirection;
    /**
     * Check for events triggered by movement
     */
    private checkMovementEvents;
    /**
     * Calculate movement cost based on constraints and terrain
     */
    calculateMovementCost(entity: GameEntity, direction: MovementDirection, constraints?: Partial<MovementConstraints>): number;
    /**
     * Get direction between two positions
     */
    getDirectionBetween(from: Position, to: Position): MovementDirection | null;
    /**
     * Check if two positions are adjacent
     */
    arePositionsAdjacent(pos1: Position, pos2: Position, includeDiagonals?: boolean): boolean;
}
//# sourceMappingURL=MovementSystem.d.ts.map