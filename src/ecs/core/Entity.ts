/**
 * Pure Entity - only contains an ID
 * Implements ECS principle: Entity is just an identifier
 */

export type EntityId = string;

/**
 * Entity interface - pure identifier only
 * No data, no logic, just an ID
 */
export interface Entity {
  readonly id: EntityId;
}

/**
 * Entity factory for creating new entities
 */
export class EntityFactory {
  private static nextId = 1;

  /**
   * Create a new entity with a unique ID
   */
  static create(): Entity {
    const id = `entity_${this.nextId++}`;
    return { id };
  }

  /**
   * Create an entity with a specific ID
   */
  static createWithId(id: EntityId): Entity {
    return { id };
  }

  /**
   * Create multiple entities at once
   */
  static createBatch(count: number): Entity[] {
    const entities: Entity[] = [];
    for (let i = 0; i < count; i++) {
      entities.push(this.create());
    }
    return entities;
  }
}

/**
 * Entity utilities
 */
export class EntityUtils {
  /**
   * Check if two entities are the same
   */
  static equals(a: Entity, b: Entity): boolean {
    return a.id === b.id;
  }

  /**
   * Get entity ID as string
   */
  static getId(entity: Entity): EntityId {
    return entity.id;
  }

  /**
   * Create entity from ID
   */
  static fromId(id: EntityId): Entity {
    return { id };
  }
}
