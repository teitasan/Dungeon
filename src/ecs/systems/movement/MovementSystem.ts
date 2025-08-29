/**
 * Movement System - processes movement of entities
 * Implements ECS principle: System contains logic, not data
 * Extended to replace non-ECS movement system
 */

import { System, SystemContext } from '../../core/System.js';
import { ComponentManager } from '../../core/ComponentManager.js';
import { PositionComponent, PositionComponentFactory } from '../../components/common/Position.js';

/**
 * Velocity component for movement
 */
export interface VelocityComponent {
  readonly id: string;
  readonly type: 'velocity';
  readonly vx: number;
  readonly vy: number;
}

/**
 * Velocity component factory
 */
export class VelocityComponentFactory {
  static create(vx: number, vy: number): VelocityComponent {
    return {
      id: `velocity_${Date.now()}_${Math.random()}`,
      type: 'velocity',
      vx,
      vy
    };
  }

  static createStationary(): VelocityComponent {
    return this.create(0, 0);
  }
}

/**
 * Movement result for player movement attempts
 */
export interface MovementResult {
  success: boolean;
  message: string;
  newPosition?: { x: number; y: number };
  collision?: { type: 'wall' | 'entity' | 'item'; position: { x: number; y: number } };
}

/**
 * Movement system that updates entity positions based on velocity
 * Extended to handle player movement, collision detection, and wall checking
 */
export class MovementSystem extends System {
  private dungeonManager: any = null;
  private wallTiles: Set<string> = new Set();

  constructor(componentManager: ComponentManager) {
    super(componentManager, ['position']);
  }

  /**
   * Set dungeon manager for wall collision detection
   */
  setDungeonManager(dungeonManager: any): void {
    this.dungeonManager = dungeonManager;
    this.updateWallTiles();
  }

  /**
   * Update wall tiles cache
   */
  private updateWallTiles(): void {
    if (!this.dungeonManager) return;
    
    this.wallTiles.clear();
    // TODO: Implement wall tile detection from dungeon manager
  }

  /**
   * Attempt to move player in specified direction
   */
  attemptPlayerMovement(
    playerId: string, 
    direction: 'north' | 'south' | 'east' | 'west' | 'northeast' | 'southeast' | 'southwest' | 'northwest'
  ): MovementResult {
    const position = this.getComponent<PositionComponent>(playerId, 'position');
    if (!position) {
      return {
        success: false,
        message: 'Player has no position component'
      };
    }

    // Calculate new position based on direction
    const directionMap: Record<string, { x: number; y: number }> = {
      north: { x: 0, y: -1 },
      south: { x: 0, y: 1 },
      east: { x: 1, y: 0 },
      west: { x: -1, y: 0 },
      northeast: { x: 1, y: -1 },
      southeast: { x: 1, y: 1 },
      southwest: { x: -1, y: 1 },
      northwest: { x: -1, y: -1 }
    };

    const delta = directionMap[direction];
    if (!delta) {
      return {
        success: false,
        message: 'Invalid direction'
      };
    }

    const newX = position.x + delta.x;
    const newY = position.y + delta.y;

    // Check if new position is walkable
    if (!this.isWalkable(newX, newY)) {
      return {
        success: false,
        message: 'Cannot move there',
        collision: { type: 'wall', position: { x: newX, y: newY } }
      };
    }

    // Check for entity collision
    const entityAtPosition = this.getEntityAtPosition(newX, newY);
    if (entityAtPosition) {
      return {
        success: false,
        message: 'Something blocks the way',
        collision: { type: 'entity', position: { x: newX, y: newY } }
      };
    }

    // Move successful - update position
    const newPosition = PositionComponentFactory.create(newX, newY);
    this.componentManager.removeComponent(playerId, 'position');
    this.componentManager.addComponent(playerId, newPosition);

    return {
      success: true,
      message: 'Moved successfully',
      newPosition: { x: newX, y: newY }
    };
  }

  /**
   * Check if position is walkable
   */
  private isWalkable(x: number, y: number): boolean {
    if (!this.dungeonManager) return true; // Default to walkable if no dungeon manager
    
    try {
      return this.dungeonManager.isWalkable({ x, y });
    } catch (e) {
      console.warn('Error checking walkability:', e);
      return true; // Default to walkable on error
    }
  }

  /**
   * Get entity at position
   */
  private getEntityAtPosition(x: number, y: number): string | null {
    // TODO: Implement entity collision detection
    return null;
  }

  protected process(context: SystemContext, entities: string[]): void {
    // Process entities with velocity components for automatic movement
    for (const entityId of entities) {
      const position = this.getComponent<PositionComponent>(entityId, 'position');
      const velocity = this.getComponent<VelocityComponent>(entityId, 'velocity');

      if (position && velocity) {
        // Calculate new position
        const newX = position.x + velocity.vx * context.deltaTime;
        const newY = position.y + velocity.vy * context.deltaTime;

        // Check if new position is walkable
        if (this.isWalkable(newX, newY)) {
          // Create new position component
          const newPosition = PositionComponentFactory.create(newX, newY);

          // Update the entity's position
          this.componentManager.removeComponent(entityId, 'position');
          this.componentManager.addComponent(entityId, newPosition);
        }
      }
    }
  }

  protected onInitialize(): void {
    console.log('MovementSystem initialized');
  }

  protected onBegin(context: SystemContext): void {
    // Optional: Add movement-specific logic at the beginning of each update
  }

  protected onEnd(context: SystemContext): void {
    // Optional: Add movement-specific logic at the end of each update
  }
}
