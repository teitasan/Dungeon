/**
 * System Base Class - processes entities with specific components
 * Implements ECS principle: Systems contain logic, not data
 */

import { Entity, EntityId } from './Entity.js';
import { Component, ComponentType } from './Component.js';
import { ComponentManager } from './ComponentManager.js';
import { QuerySystem } from './Query.js';

/**
 * System execution context
 */
export interface SystemContext {
  readonly deltaTime: number;
  readonly currentTime: number;
  readonly frameCount: number;
}

/**
 * Base system class for all ECS systems
 */
export abstract class System {
  protected readonly componentManager: ComponentManager;
  protected readonly querySystem: QuerySystem;
  protected readonly requiredComponents: ComponentType[];
  protected readonly excludedComponents: ComponentType[];
  
  public enabled: boolean = true;
  public updateOrder: number = 0;
  public readonly systemName: string;

  constructor(
    componentManager: ComponentManager,
    requiredComponents: ComponentType[] = [],
    excludedComponents: ComponentType[] = []
  ) {
    this.componentManager = componentManager;
    this.querySystem = new QuerySystem(componentManager);
    this.requiredComponents = requiredComponents;
    this.excludedComponents = excludedComponents;
    this.systemName = this.constructor.name;
  }

  /**
   * Initialize the system
   */
  initialize(): void {
    this.onInitialize();
  }

  /**
   * Update the system
   */
  update(context: SystemContext): void {
    if (!this.enabled) {
      return;
    }

    this.onBegin(context);

    // Query entities that match this system's requirements
    const matchingEntities = this.querySystem.getEntitiesMatching(
      this.requiredComponents,
      this.excludedComponents
    );

    if (matchingEntities.length > 0) {
      this.process(context, matchingEntities);
    }

    this.onEnd(context);
  }

  /**
   * Process entities that match this system's requirements
   */
  protected abstract process(context: SystemContext, entities: EntityId[]): void;

  /**
   * Called when the system is initialized
   */
  protected onInitialize(): void {
    // Override in subclasses
  }

  /**
   * Called at the beginning of each update
   */
  protected onBegin(context: SystemContext): void {
    // Override in subclasses
  }

  /**
   * Called at the end of each update
   */
  protected onEnd(context: SystemContext): void {
    // Override in subclasses
  }

  /**
   * Check if an entity matches this system's requirements
   */
  protected entityMatches(entityId: EntityId): boolean {
    return this.querySystem.entityMatches(
      entityId,
      this.requiredComponents,
      this.excludedComponents
    );
  }

  /**
   * Get a component from an entity
   */
  protected getComponent<T extends Component>(entityId: EntityId, type: ComponentType): T | undefined {
    return this.componentManager.getComponent<T>(entityId, type);
  }

  /**
   * Check if an entity has a component
   */
  protected hasComponent(entityId: EntityId, type: ComponentType): boolean {
    return this.componentManager.hasComponent(entityId, type);
  }

  /**
   * Get all entities with a specific component
   */
  protected getEntitiesWithComponent(type: ComponentType): EntityId[] {
    return this.componentManager.getEntitiesWithComponent(type);
  }

  /**
   * Query entities with specific requirements
   */
  protected query(): import('./Query.js').QueryBuilder {
    return this.querySystem.query();
  }
}

/**
 * System group for managing multiple systems
 */
export class SystemGroup {
  private systems: System[] = [];
  private sorted: boolean = false;

  /**
   * Add a system to the group
   */
  add(system: System): void {
    this.systems.push(system);
    this.sorted = false;
  }

  /**
   * Remove a system from the group
   */
  remove(system: System): boolean {
    const index = this.systems.indexOf(system);
    if (index !== -1) {
      this.systems.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all systems in the group
   */
  getAll(): System[] {
    if (!this.sorted) {
      this.sortSystems();
    }
    return [...this.systems];
  }

  /**
   * Initialize all systems
   */
  initialize(): void {
    for (const system of this.systems) {
      system.initialize();
    }
  }

  /**
   * Update all systems
   */
  update(context: SystemContext): void {
    if (!this.sorted) {
      this.sortSystems();
    }

    for (const system of this.systems) {
      system.update(context);
    }
  }

  /**
   * Sort systems by update order
   */
  private sortSystems(): void {
    this.systems.sort((a, b) => a.updateOrder - b.updateOrder);
    this.sorted = true;
  }

  /**
   * Clear all systems
   */
  clear(): void {
    this.systems.length = 0;
    this.sorted = false;
  }
}
