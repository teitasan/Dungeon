/**
 * Movement system for handling entity movement
 */

import { Position } from '../types/core';
import { GameEntity } from '../types/entities';
import { 
  MovementDirection, 
  MovementResult, 
  MovementEvent, 
  MovementConstraints,
  DirectionVectors,
  ActionResult
} from '../types/movement';
import { DungeonManager } from '../dungeon/DungeonManager';

export class MovementSystem {
  private dungeonManager: DungeonManager;
  private defaultConstraints: MovementConstraints;

  constructor(dungeonManager: DungeonManager) {
    this.dungeonManager = dungeonManager;
    this.defaultConstraints = {
      canMoveDiagonally: true,
      canMoveIntoOccupiedSpace: false,
      canMoveIntoWalls: false,
      movementSpeed: 1.0
    };
  }

  /**
   * Attempt to move an entity in a direction
   */
  moveEntity(
    entity: GameEntity, 
    direction: MovementDirection, 
    constraints?: Partial<MovementConstraints>
  ): MovementResult {
    const finalConstraints = { ...this.defaultConstraints, ...constraints };
    const directionVector = DirectionVectors[direction];
    
    if (!directionVector) {
      return {
        success: false,
        reason: 'Invalid direction'
      };
    }

    // Check diagonal movement constraint
    if (!finalConstraints.canMoveDiagonally && this.isDiagonalDirection(direction)) {
      return {
        success: false,
        reason: 'Diagonal movement not allowed'
      };
    }

    const currentPosition = entity.position;
    const newPosition: Position = {
      x: currentPosition.x + directionVector.x,
      y: currentPosition.y + directionVector.y
    };

    // Check bounds
    if (!this.dungeonManager.getCellAt(newPosition)) {
      return {
        success: false,
        blocked: true,
        reason: 'Out of bounds'
      };
    }

    // Check if target cell is walkable
    if (!finalConstraints.canMoveIntoWalls && !this.dungeonManager.isWalkable(newPosition)) {
      return {
        success: false,
        blocked: true,
        reason: 'Target cell is not walkable'
      };
    }

    // Check for other entities
    const entitiesAtTarget = this.dungeonManager.getEntitiesAt(newPosition);
    if (!finalConstraints.canMoveIntoOccupiedSpace && entitiesAtTarget.length > 0) {
      return {
        success: false,
        blocked: true,
        reason: 'Target cell is occupied',
        triggeredEvents: [{
          type: 'collision',
          entity,
          position: newPosition,
          data: { collidedWith: entitiesAtTarget }
        }]
      };
    }

    // Perform the movement
    const moveSuccess = this.dungeonManager.moveEntity(entity, newPosition);
    if (!moveSuccess) {
      return {
        success: false,
        reason: 'Failed to move entity in dungeon'
      };
    }

    // Check for movement events
    const events = this.checkMovementEvents(entity, newPosition);

    return {
      success: true,
      newPosition,
      triggeredEvents: events
    };
  }

  /**
   * 移動を試行し、ActionResultを返す（ターン消費判定用）
   */
  attemptMoveWithActionResult(
    entity: GameEntity, 
    direction: MovementDirection, 
    constraints?: Partial<MovementConstraints>
  ): ActionResult {
    const moveResult = this.moveEntity(entity, direction, constraints);
    
    if (moveResult.success) {
      return {
        success: true,
        actionType: 'move',
        consumedTurn: true,  // 移動成功時はターン消費
        message: '移動した',
        data: moveResult
      };
    } else {
      // 移動失敗時はターン消費しない
      let message = '移動できない';
      if (moveResult.reason === 'Target cell is not walkable') {
        message = '壁にぶつかった';
      } else if (moveResult.reason === 'Target cell is occupied') {
        message = '他のキャラクターがいる';
      } else if (moveResult.reason === 'Out of bounds') {
        message = '境界外だ';
      }
      
      return {
        success: false,
        actionType: 'move',
        consumedTurn: false,  // 移動失敗時はターン消費しない
        message,
        data: moveResult
      };
    }
  }

  /**
   * Move entity to specific position
   */
  moveEntityToPosition(
    entity: GameEntity, 
    targetPosition: Position, 
    constraints?: Partial<MovementConstraints>
  ): MovementResult {
    const finalConstraints = { ...this.defaultConstraints, ...constraints };

    // Check bounds
    if (!this.dungeonManager.getCellAt(targetPosition)) {
      return {
        success: false,
        blocked: true,
        reason: 'Out of bounds'
      };
    }

    // Check if target cell is walkable
    if (!finalConstraints.canMoveIntoWalls && !this.dungeonManager.isWalkable(targetPosition)) {
      return {
        success: false,
        blocked: true,
        reason: 'Target cell is not walkable'
      };
    }

    // Check for other entities
    const entitiesAtTarget = this.dungeonManager.getEntitiesAt(targetPosition);
    if (!finalConstraints.canMoveIntoOccupiedSpace && entitiesAtTarget.length > 0) {
      return {
        success: false,
        blocked: true,
        reason: 'Target cell is occupied',
        triggeredEvents: [{
          type: 'collision',
          entity,
          position: targetPosition,
          data: { collidedWith: entitiesAtTarget }
        }]
      };
    }

    // Perform the movement
    const moveSuccess = this.dungeonManager.moveEntity(entity, targetPosition);
    if (!moveSuccess) {
      return {
        success: false,
        reason: 'Failed to move entity in dungeon'
      };
    }

    // Check for movement events
    const events = this.checkMovementEvents(entity, targetPosition);

    return {
      success: true,
      newPosition: targetPosition,
      triggeredEvents: events
    };
  }

  /**
   * Get valid movement directions from current position
   */
  getValidMovements(
    entity: GameEntity, 
    constraints?: Partial<MovementConstraints>
  ): MovementDirection[] {
    const finalConstraints = { ...this.defaultConstraints, ...constraints };
    const validDirections: MovementDirection[] = [];

    for (const [direction, vector] of Object.entries(DirectionVectors)) {
      const movementDirection = direction as MovementDirection;
      
      // Skip diagonal if not allowed
      if (!finalConstraints.canMoveDiagonally && this.isDiagonalDirection(movementDirection)) {
        continue;
      }

      const newPosition: Position = {
        x: entity.position.x + vector.x,
        y: entity.position.y + vector.y
      };

      // Check if movement is valid
      if (this.isValidMovement(newPosition, finalConstraints)) {
        validDirections.push(movementDirection);
      }
    }

    return validDirections;
  }

  /**
   * Check if a position is valid for movement
   */
  private isValidMovement(position: Position, constraints: MovementConstraints): boolean {
    // Check bounds
    const cell = this.dungeonManager.getCellAt(position);
    if (!cell) return false;

    // Check walkability
    if (!constraints.canMoveIntoWalls && !cell.walkable) return false;

    // Check for entities
    if (!constraints.canMoveIntoOccupiedSpace && cell.entities.length > 0) return false;

    return true;
  }

  /**
   * Check if direction is diagonal
   */
  private isDiagonalDirection(direction: MovementDirection): boolean {
    return ['northeast', 'northwest', 'southeast', 'southwest'].includes(direction);
  }

  /**
   * Check for events triggered by movement
   */
  private checkMovementEvents(entity: GameEntity, position: Position): MovementEvent[] {
    const events: MovementEvent[] = [];
    const cell = this.dungeonManager.getCellAt(position);
    
    if (!cell) return events;

    // Check for traps
    if (cell.trap && !cell.trap.triggered) {
      events.push({
        type: 'trap-triggered',
        entity,
        position,
        data: { trap: cell.trap }
      });
    }

    // Check for stairs
    if (cell.type === 'stairs-up' || cell.type === 'stairs-down') {
      events.push({
        type: 'stairs-used',
        entity,
        position,
        data: { stairType: cell.type }
      });
    }

    // Check for special tiles
    if (cell.special) {
      events.push({
        type: 'special-tile',
        entity,
        position,
        data: { special: cell.special }
      });
    }

    return events;
  }

  /**
   * Calculate movement cost based on constraints and terrain
   */
  calculateMovementCost(
    entity: GameEntity, 
    direction: MovementDirection, 
    constraints?: Partial<MovementConstraints>
  ): number {
    const finalConstraints = { ...this.defaultConstraints, ...constraints };
    let baseCost = 1.0;

    // Diagonal movement costs more
    if (this.isDiagonalDirection(direction)) {
      baseCost = 1.4; // Approximately sqrt(2)
    }

    // Apply speed multiplier
    baseCost *= finalConstraints.movementSpeed;

    // TODO: Add terrain-based cost modifiers in future tasks

    return baseCost;
  }

  /**
   * Get direction between two positions
   */
  getDirectionBetween(from: Position, to: Position): MovementDirection | null {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // Normalize to -1, 0, or 1
    const normalizedDx = Math.sign(dx);
    const normalizedDy = Math.sign(dy);

    // Find matching direction
    for (const [direction, vector] of Object.entries(DirectionVectors)) {
      if (vector.x === normalizedDx && vector.y === normalizedDy) {
        return direction as MovementDirection;
      }
    }

    return null;
  }

  /**
   * Check if two positions are adjacent
   */
  arePositionsAdjacent(pos1: Position, pos2: Position, includeDiagonals: boolean = true): boolean {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);

    if (includeDiagonals) {
      return dx <= 1 && dy <= 1 && (dx + dy > 0);
    } else {
      return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    }
  }
}