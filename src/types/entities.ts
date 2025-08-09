/**
 * Entity models for the mystery dungeon game
 * Implements basic game entities with stats, level, and experience systems
 */

import { GameEntity, Position, Component, EntityStats, EntityFlags } from './core';

// Re-export core GameEntity for modules that import from types/entities
export { GameEntity } from './core';

// Base stats interface for all characters (Player, Monster, Companion)
export interface CharacterStats extends EntityStats {
  level: number;
  experience: number;
  experienceValue: number; // Experience given when defeated
}

// Status effects that can be applied to characters
export interface StatusEffect {
  type: 'poison' | 'confusion' | 'paralysis' | 'bind';
  turnsElapsed: number;
  intensity?: number;
  source?: string;
}

// Attribute system for characters
export interface CharacterAttributes {
  primary: string;
  secondary?: string;
  resistances: AttributeResistance[];
  weaknesses: AttributeWeakness[];
}

export interface AttributeResistance {
  attribute: string;
  resistance: number; // 0.0-1.0, where 0.5 = half damage, 0.0 = immune
  description: string;
}

export interface AttributeWeakness {
  attribute: string;
  weakness: number; // Damage multiplier, e.g., 1.5 = 1.5x damage
  description: string;
}

// Equipment stats for items
export interface EquipmentStats {
  attackBonus?: number;
  defenseBonus?: number;
  [key: string]: number | undefined;
}

// Item effects
export interface ItemEffect {
  type: string;
  value: number;
  description: string;
}

// Player model
export interface Player extends GameEntity {
  name: string;
  stats: CharacterStats;
  attributes: CharacterAttributes;
  hunger: number;
  maxHunger: number;
  inventory: Item[];
  equipment: {
    weapon?: Item;
    armor?: Item;
    accessory?: Item;
  };
  statusEffects: StatusEffect[];
}

// Monster model
export interface Monster extends GameEntity {
  name: string;
  monsterType: string;
  stats: CharacterStats;
  attributes: CharacterAttributes;
  aiType: string;
  dropTable: DropTableEntry[];
  spawnWeight: number;
  spawnConditions: SpawnCondition[];
  statusEffects: StatusEffect[];
}

// Companion model
export interface Companion extends GameEntity {
  name: string;
  companionType: string;
  stats: CharacterStats;
  attributes: CharacterAttributes;
  aiType: string;
  behaviorMode: 'follow' | 'attack' | 'defend' | 'explore' | 'wait';
  equipment: {
    weapon?: Item;
    armor?: Item;
    accessory?: Item;
  };
  statusEffects: StatusEffect[];
}

// Item model
export interface Item extends GameEntity {
  name: string;
  itemType: ItemType;
  identified: boolean;
  cursed: boolean;
  durability?: number;
  effects: ItemEffect[];
  attributes?: {
    attackAttribute?: string;
    defenseAttributes?: string[];
  };
  equipmentStats?: EquipmentStats;
}

// Supporting types
export type ItemType = 'weapon-melee' | 'weapon-ranged' | 'armor' | 'accessory' | 'consumable' | 'misc';

export interface DropTableEntry {
  itemId: string;
  weight: number;
  quantity: { min: number; max: number };
  conditions?: DropCondition[];
}

export interface DropCondition {
  type: string;
  value: any;
}

export interface SpawnCondition {
  type: string;
  value: any;
}