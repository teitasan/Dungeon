/**
 * ECS Core System exports
 * Pure ECS architecture implementation
 */

// Entity system
export { Entity, EntityId, EntityFactory, EntityUtils } from './Entity.js';

// Component system
export { Component, ComponentType, ComponentMetadata, ComponentFactory, ComponentUtils } from './Component.js';

// Component management
export { ComponentManager, ComponentStorage, ComponentStorageImpl } from './ComponentManager.js';

// Query system
export { QuerySystem, QueryBuilder, QueryResult } from './Query.js';

// System framework
export { System, SystemGroup, SystemContext } from './System.js';

// World management
export { World, WorldConfig, WorldStats } from './World.js';
