/**
 * Movement System - processes movement of entities
 * Implements ECS principle: System contains logic, not data
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
 * Movement system that updates entity positions based on velocity
 */
export class MovementSystem extends System {
  constructor(componentManager: ComponentManager) {
    super(componentManager, ['position', 'velocity']);
  }

  protected process(context: SystemContext, entities: string[]): void {
    for (const entityId of entities) {
      const position = this.getComponent<PositionComponent>(entityId, 'position');
      const velocity = this.getComponent<VelocityComponent>(entityId, 'velocity');

      if (position && velocity) {
        // Calculate new position
        const newX = position.x + velocity.vx * context.deltaTime;
        const newY = position.y + velocity.vy * context.deltaTime;

        // Create new position component
        const newPosition = PositionComponentFactory.create(newX, newY);

        // Update the entity's position
        this.componentManager.removeComponent(entityId, 'position');
        this.componentManager.addComponent(entityId, newPosition);
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
