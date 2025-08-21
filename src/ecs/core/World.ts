/**
 * ECS World - manages entities, components, and systems
 * Implements ECS principle: Central management of all ECS elements
 */

import { Entity, EntityId, EntityFactory } from './Entity.js';
import { Component, ComponentType } from './Component.js';
import { ComponentManager } from './ComponentManager.js';
import { System, SystemGroup, SystemContext } from './System.js';

/**
 * ECS World configuration
 */
export interface WorldConfig {
  maxEntities?: number;
  enableProfiling?: boolean;
  enableDebugging?: boolean;
}

/**
 * ECS World statistics
 */
export interface WorldStats {
  entityCount: number;
  componentTypeCount: number;
  systemCount: number;
  memoryUsage: number;
}

/**
 * Main ECS World class
 */
export class World {
  private entities: Set<EntityId> = new Set();
  private componentManager: ComponentManager;
  private systemGroup: SystemGroup;
  private config: WorldConfig;
  private frameCount: number = 0;
  private startTime: number = Date.now();

  constructor(config: WorldConfig = {}) {
    this.config = {
      maxEntities: 10000,
      enableProfiling: false,
      enableDebugging: false,
      ...config
    };

    this.componentManager = new ComponentManager();
    this.systemGroup = new SystemGroup();
  }

  /**
   * Create a new entity
   */
  createEntity(): Entity {
    if (this.entities.size >= (this.config.maxEntities || 10000)) {
      throw new Error('Maximum entity count reached');
    }

    const entity = EntityFactory.create();
    this.entities.add(entity.id);
    return entity;
  }

  /**
   * Create an entity with specific components
   */
  createEntityWithComponents(...components: Component[]): Entity {
    const entity = this.createEntity();
    
    for (const component of components) {
      this.addComponent(entity.id, component);
    }

    return entity;
  }

  /**
   * Destroy an entity and remove all its components
   */
  destroyEntity(entityId: EntityId): boolean {
    if (!this.entities.has(entityId)) {
      return false;
    }

    // Remove all components from the entity
    this.componentManager.removeAllComponents(entityId);
    
    // Remove the entity
    this.entities.delete(entityId);
    
    return true;
  }

  /**
   * Check if an entity exists
   */
  hasEntity(entityId: EntityId): boolean {
    return this.entities.has(entityId);
  }

  /**
   * Get all entity IDs
   */
  getEntityIds(): EntityId[] {
    return Array.from(this.entities);
  }

  /**
   * Add a component to an entity
   */
  addComponent<T extends Component>(entityId: EntityId, component: T): void {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} does not exist`);
    }

    this.componentManager.addComponent(entityId, component);
  }

  /**
   * Remove a component from an entity
   */
  removeComponent(entityId: EntityId, componentType: ComponentType): boolean {
    return this.componentManager.removeComponent(entityId, componentType);
  }

  /**
   * Get a component from an entity
   */
  getComponent<T extends Component>(entityId: EntityId, componentType: ComponentType): T | undefined {
    return this.componentManager.getComponent<T>(entityId, componentType);
  }

  /**
   * Check if an entity has a component
   */
  hasComponent(entityId: EntityId, componentType: ComponentType): boolean {
    return this.componentManager.hasComponent(entityId, componentType);
  }

  /**
   * Get all components of a specific type
   */
  getComponentsOfType<T extends Component>(componentType: ComponentType): T[] {
    return this.componentManager.getComponentsOfType<T>(componentType);
  }

  /**
   * Add a system to the world
   */
  addSystem(system: System): void {
    this.systemGroup.add(system);
  }

  /**
   * Remove a system from the world
   */
  removeSystem(system: System): boolean {
    return this.systemGroup.remove(system);
  }

  /**
   * Get all systems
   */
  getSystems(): System[] {
    return this.systemGroup.getAll();
  }

  /**
   * Initialize all systems
   */
  initialize(): void {
    this.systemGroup.initialize();
  }

  /**
   * Update the world
   */
  update(deltaTime: number): void {
    const context: SystemContext = {
      deltaTime,
      currentTime: Date.now() - this.startTime,
      frameCount: this.frameCount++
    };

    this.systemGroup.update(context);
  }

  /**
   * Get world statistics
   */
  getStats(): WorldStats {
    return {
      entityCount: this.entities.size,
      componentTypeCount: this.componentManager.getRegisteredComponentTypes().length,
      systemCount: this.systemGroup.getAll().length,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Clear the world (remove all entities, components, and systems)
   */
  clear(): void {
    // Clear all entities
    this.entities.clear();
    
    // Clear all components
    this.componentManager.clear();
    
    // Clear all systems
    this.systemGroup.clear();
    
    // Reset counters
    this.frameCount = 0;
    this.startTime = Date.now();
  }

  /**
   * Get the component manager
   */
  getComponentManager(): ComponentManager {
    return this.componentManager;
  }

  /**
   * Get the system group
   */
  getSystemGroup(): SystemGroup {
    return this.systemGroup;
  }

  /**
   * Estimate memory usage (rough calculation)
   */
  private estimateMemoryUsage(): number {
    let memory = 0;
    
    // Entity IDs (strings)
    memory += this.entities.size * 50; // Rough estimate for string storage
    
    // Component storage
    const componentTypes = this.componentManager.getRegisteredComponentTypes();
    for (const type of componentTypes) {
      const entitiesWithComponent = this.componentManager.getEntitiesWithComponent(type);
      memory += entitiesWithComponent.length * 100; // Rough estimate per component
    }
    
    return memory;
  }

  /**
   * Enable/disable profiling
   */
  setProfilingEnabled(enabled: boolean): void {
    this.config.enableProfiling = enabled;
  }

  /**
   * Enable/disable debugging
   */
  setDebuggingEnabled(enabled: boolean): void {
    this.config.enableDebugging = enabled;
  }
}
