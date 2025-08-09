/**
 * Entity exports
 */

// Base entity
export { BaseGameEntity, createDefaultCharacterStats, createDefaultCharacterAttributes, calculateLevelUpStats, canLevelUp, addExperience } from './GameEntity';

// Specific entities
export { PlayerEntity } from './Player';
export { MonsterEntity } from './Monster';
export { CompanionEntity } from './Companion';
export { ItemEntity } from './Item';

// Re-export types for convenience
export * from '../types/entities';