/**
 * Position Component - represents 2D position
 * Pure data structure, no logic
 */

import { Component, ComponentType } from '../../core/Component.js';

/**
 * Position component data
 */
export interface PositionComponent extends Component {
  readonly type: 'position';
  readonly x: number;
  readonly y: number;
}

/**
 * Position component factory
 */
export class PositionComponentFactory {
  /**
   * Create a position component
   */
  static create(x: number, y: number): PositionComponent {
    return {
      id: `position_${Date.now()}_${Math.random()}`,
      type: 'position',
      x,
      y
    };
  }

  /**
   * Create a position component at origin
   */
  static createAtOrigin(): PositionComponent {
    return this.create(0, 0);
  }

  /**
   * Create a position component with random coordinates
   */
  static createRandom(maxX: number, maxY: number): PositionComponent {
    return this.create(
      Math.floor(Math.random() * maxX),
      Math.floor(Math.random() * maxY)
    );
  }
}

/**
 * Position utilities
 */
export class PositionUtils {
  /**
   * Calculate distance between two positions
   */
  static distance(a: PositionComponent, b: PositionComponent): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate squared distance (faster than distance)
   */
  static distanceSquared(a: PositionComponent, b: PositionComponent): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  /**
   * Check if two positions are equal
   */
  static equals(a: PositionComponent, b: PositionComponent): boolean {
    return a.x === b.x && a.y === b.y;
  }

  /**
   * Add two positions
   */
  static add(a: PositionComponent, b: PositionComponent): { x: number; y: number } {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  /**
   * Subtract two positions
   */
  static subtract(a: PositionComponent, b: PositionComponent): { x: number; y: number } {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  /**
   * Multiply position by scalar
   */
  static multiply(position: PositionComponent, scalar: number): { x: number; y: number } {
    return { x: position.x * scalar, y: position.y * scalar };
  }

  /**
   * Check if position is within bounds
   */
  static isWithinBounds(
    position: PositionComponent,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): boolean {
    return position.x >= minX && position.x <= maxX && 
           position.y >= minY && position.y <= maxY;
  }
}
