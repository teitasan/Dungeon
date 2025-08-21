/**
 * Component Manager - manages entity-component relationships
 * Implements ECS principle: Components are managed separately from entities
 */

import { Entity, EntityId } from './Entity.js';
import { Component, ComponentType } from './Component.js';

/**
 * Component storage for a specific component type
 */
export interface ComponentStorage<T extends Component> {
  readonly type: ComponentType;
  readonly data: Map<EntityId, T>;
  
  add(entityId: EntityId, component: T): void;
  remove(entityId: EntityId): boolean;
  get(entityId: EntityId): T | undefined;
  has(entityId: EntityId): boolean;
  getAll(): T[];
  getEntityIds(): EntityId[];
}

/**
 * Implementation of component storage
 */
export class ComponentStorageImpl<T extends Component> implements ComponentStorage<T> {
  public readonly type: ComponentType;
  private readonly _data: Map<EntityId, T> = new Map();

  constructor(type: ComponentType) {
    this.type = type;
  }

  get data(): Map<EntityId, T> {
    return this._data;
  }

  add(entityId: EntityId, component: T): void {
    this._data.set(entityId, component);
  }

  remove(entityId: EntityId): boolean {
    return this._data.delete(entityId);
  }

  get(entityId: EntityId): T | undefined {
    return this._data.get(entityId);
  }

  has(entityId: EntityId): boolean {
    return this._data.has(entityId);
  }

  getAll(): T[] {
    return Array.from(this._data.values());
  }

  getEntityIds(): EntityId[] {
    return Array.from(this._data.keys());
  }
}

/**
 * Main component manager for the ECS world
 */
export class ComponentManager {
  private storages: Map<ComponentType, ComponentStorage<any>> = new Map();
  private entityComponents: Map<EntityId, Set<ComponentType>> = new Map();

  /**
   * Register a component storage for a component type
   */
  registerComponentType<T extends Component>(type: ComponentType): ComponentStorage<T> {
    if (this.storages.has(type)) {
      return this.storages.get(type)! as ComponentStorage<T>;
    }

    const storage = new ComponentStorageImpl<T>(type);
    this.storages.set(type, storage);
    return storage;
  }

  /**
   * Add a component to an entity
   */
  addComponent<T extends Component>(entityId: EntityId, component: T): void {
    const type = component.type;
    
    // Get or create storage for this component type
    let storage = this.storages.get(type) as ComponentStorage<T>;
    if (!storage) {
      storage = this.registerComponentType<T>(type);
    }

    // Add component to storage
    storage.add(entityId, component);

    // Update entity-component mapping
    if (!this.entityComponents.has(entityId)) {
      this.entityComponents.set(entityId, new Set());
    }
    this.entityComponents.get(entityId)!.add(type);
  }

  /**
   * Remove a component from an entity
   */
  removeComponent(entityId: EntityId, type: ComponentType): boolean {
    const storage = this.storages.get(type);
    if (!storage) {
      return false;
    }

    const removed = storage.remove(entityId);
    if (removed) {
      // Update entity-component mapping
      const entityTypes = this.entityComponents.get(entityId);
      if (entityTypes) {
        entityTypes.delete(type);
        if (entityTypes.size === 0) {
          this.entityComponents.delete(entityId);
        }
      }
    }

    return removed;
  }

  /**
   * Get a component from an entity
   */
  getComponent<T extends Component>(entityId: EntityId, type: ComponentType): T | undefined {
    const storage = this.storages.get(type);
    if (!storage) {
      return undefined;
    }
    return storage.get(entityId) as T;
  }

  /**
   * Check if an entity has a specific component
   */
  hasComponent(entityId: EntityId, type: ComponentType): boolean {
    const entityTypes = this.entityComponents.get(entityId);
    return entityTypes ? entityTypes.has(type) : false;
  }

  /**
   * Get all components of a specific type
   */
  getComponentsOfType<T extends Component>(type: ComponentType): T[] {
    const storage = this.storages.get(type);
    if (!storage) {
      return [];
    }
    return storage.getAll() as T[];
  }

  /**
   * Get all component types for an entity
   */
  getEntityComponentTypes(entityId: EntityId): ComponentType[] {
    const entityTypes = this.entityComponents.get(entityId);
    return entityTypes ? Array.from(entityTypes) : [];
  }

  /**
   * Get all entities that have a specific component
   */
  getEntitiesWithComponent(type: ComponentType): EntityId[] {
    const storage = this.storages.get(type);
    if (!storage) {
      return [];
    }
    return storage.getEntityIds();
  }

  /**
   * Remove all components from an entity
   */
  removeAllComponents(entityId: EntityId): void {
    const entityTypes = this.entityComponents.get(entityId);
    if (!entityTypes) {
      return;
    }

    for (const type of entityTypes) {
      this.removeComponent(entityId, type);
    }
  }

  /**
   * Get all registered component types
   */
  getRegisteredComponentTypes(): ComponentType[] {
    return Array.from(this.storages.keys());
  }

  /**
   * Clear all components (useful for testing)
   */
  clear(): void {
    this.storages.clear();
    this.entityComponents.clear();
  }
}
