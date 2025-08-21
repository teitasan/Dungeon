/**
 * Query System - efficient entity querying
 * Implements ECS principle: Systems query entities by components
 */

import { Entity, EntityId } from './Entity.js';
import { Component, ComponentType } from './Component.js';
import { ComponentManager } from './ComponentManager.js';

/**
 * Query result containing entities and their components
 */
export interface QueryResult<T extends Component[]> {
  readonly entities: EntityId[];
  readonly components: T[];
  readonly count: number;
}

/**
 * Query builder for complex queries
 */
export class QueryBuilder {
  private requiredComponents: ComponentType[] = [];
  private excludedComponents: ComponentType[] = [];
  private componentManager: ComponentManager;

  constructor(componentManager: ComponentManager) {
    this.componentManager = componentManager;
  }

  /**
   * Require entities to have all specified components
   */
  withAll(...components: ComponentType[]): this {
    this.requiredComponents.push(...components);
    return this;
  }

  /**
   * Exclude entities that have any of the specified components
   */
  withoutAny(...components: ComponentType[]): this {
    this.excludedComponents.push(...components);
    return this;
  }

  /**
   * Execute the query
   */
  execute(): QueryResult<any[]> {
    if (this.requiredComponents.length === 0) {
      return { entities: [], components: [], count: 0 };
    }

    // Start with entities that have the first required component
    let candidateEntities = this.componentManager.getEntitiesWithComponent(this.requiredComponents[0]);

    // Filter by other required components
    for (let i = 1; i < this.requiredComponents.length; i++) {
      const componentType = this.requiredComponents[i];
      candidateEntities = candidateEntities.filter(entityId =>
        this.componentManager.hasComponent(entityId, componentType)
      );
    }

    // Filter out entities with excluded components
    for (const excludedType of this.excludedComponents) {
      candidateEntities = candidateEntities.filter(entityId =>
        !this.componentManager.hasComponent(entityId, excludedType)
      );
    }

    // Get components for each entity
    const components: any[][] = [];
    for (const entityId of candidateEntities) {
      const entityComponents: any[] = [];
      for (const requiredType of this.requiredComponents) {
        const component = this.componentManager.getComponent(entityId, requiredType);
        if (component) {
          entityComponents.push(component);
        }
      }
      components.push(entityComponents);
    }

    return {
      entities: candidateEntities,
      components,
      count: candidateEntities.length
    };
  }
}

/**
 * Main query system for the ECS world
 */
export class QuerySystem {
  private componentManager: ComponentManager;

  constructor(componentManager: ComponentManager) {
    this.componentManager = componentManager;
  }

  /**
   * Create a new query builder
   */
  query(): QueryBuilder {
    return new QueryBuilder(this.componentManager);
  }

  /**
   * Query entities with a single component type
   */
  querySingle<T extends Component>(componentType: ComponentType): QueryResult<[T]> {
    const entities = this.componentManager.getEntitiesWithComponent(componentType);
    const components = entities.map(entityId => 
      this.componentManager.getComponent(entityId, componentType)!
    );

    return {
      entities,
      components: components.map(comp => [comp]) as [T][],
      count: entities.length
    };
  }

  /**
   * Query entities with multiple component types
   */
  queryMultiple<T extends Component>(...componentTypes: ComponentType[]): QueryResult<T[]> {
    if (componentTypes.length === 0) {
      return { entities: [], components: [], count: 0 };
    }

    // Start with entities that have the first component type
    let candidateEntities = this.componentManager.getEntitiesWithComponent(componentTypes[0]);

    // Filter by other required components
    for (let i = 1; i < componentTypes.length; i++) {
      const componentType = componentTypes[i];
      candidateEntities = candidateEntities.filter(entityId =>
        this.componentManager.hasComponent(entityId, componentType)
      );
    }

    // Get components for each entity
    const components: T[][] = [];
    for (const entityId of candidateEntities) {
      const entityComponents: any[] = [];
      for (const componentType of componentTypes) {
        const component = this.componentManager.getComponent(entityId, componentType);
        if (component) {
          entityComponents.push(component);
        }
      }
      components.push(entityComponents as T[]);
    }

    return {
      entities: candidateEntities,
      components,
      count: candidateEntities.length
    };
  }

  /**
   * Check if an entity matches a query
   */
  entityMatches(entityId: EntityId, requiredComponents: ComponentType[], excludedComponents: ComponentType[] = []): boolean {
    // Check required components
    for (const componentType of requiredComponents) {
      if (!this.componentManager.hasComponent(entityId, componentType)) {
        return false;
      }
    }

    // Check excluded components
    for (const componentType of excludedComponents) {
      if (this.componentManager.hasComponent(entityId, componentType)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all entities that match a specific component combination
   */
  getEntitiesMatching(requiredComponents: ComponentType[], excludedComponents: ComponentType[] = []): EntityId[] {
    if (requiredComponents.length === 0) {
      return [];
    }

    // Start with entities that have the first required component
    let candidateEntities = this.componentManager.getEntitiesWithComponent(requiredComponents[0]);

    // Filter by other required components
    for (let i = 1; i < requiredComponents.length; i++) {
      const componentType = requiredComponents[i];
      candidateEntities = candidateEntities.filter(entityId =>
        this.componentManager.hasComponent(entityId, componentType)
      );
    }

    // Filter out entities with excluded components
    for (const excludedType of excludedComponents) {
      candidateEntities = candidateEntities.filter(entityId =>
        !this.componentManager.hasComponent(entityId, excludedType)
      );
    }

    return candidateEntities;
  }
}
