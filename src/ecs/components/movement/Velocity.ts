/**
 * Velocity Component - manages entity movement velocity
 */

export interface VelocityComponent {
  readonly id: string;
  readonly type: 'velocity';
  readonly vx: number;
  readonly vy: number;
}

/**
 * Velocity Component Factory
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
