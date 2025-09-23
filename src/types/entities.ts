/**
 * Entity models for the mystery dungeon game
 * Implements basic game entities with stats, level, and experience systems
 */

import { GameEntity, Position, Component, EntityFlags } from './core';
import { MovementPattern, MovementPatternConfig } from './ai';
import { CharacterInfo, CharacterStats } from './character-info';

export type { CharacterInfo, CharacterStats } from './character-info';

// Re-export core GameEntity for modules that import from types/entities
export { GameEntity } from './core';

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
  characterInfo: CharacterInfo;
  characterStats: CharacterStats;
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
  characterInfo: CharacterInfo;
  monsterType: string;
  characterStats: CharacterStats;
  attributes: CharacterAttributes;
  movementPattern?: MovementPattern;
  movementConfig?: MovementPatternConfig;
  dropTable: DropTableEntry[];
  spawnWeight: number;
  spawnConditions: SpawnCondition[];
  statusEffects: StatusEffect[];
  spriteId?: string;
}

// Monster template interface
export interface MonsterTemplate {
  id: string;
  name: string;
  monsterType: string;
  spriteId?: string;
  spritesheet?: string;
  stats?: {
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    evasionRate: number;
  };
  movementPattern?: MovementPattern;
  movementConfig?: MovementPatternConfig;
  experienceValue?: number;
  dropRate?: number;
  dropTableId?: string;
  level?: number;
  description?: string;
  characterStats?: CharacterStats;
}

// Companion model
export interface Companion extends GameEntity {
  characterInfo: CharacterInfo;
  companionType: string;
  characterStats: CharacterStats;
  attributes: CharacterAttributes;
  movementPattern?: MovementPattern;
  movementConfig?: MovementPatternConfig;
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
  spriteId?: string;
  /**
   * アイテム固有のフラグ（全アイテムに付与）
   * onThrow: 投擲時の基本挙動
   */
  itemFlags: ItemFlags;
}

// Supporting types
export type ItemType = 'weapon-melee' | 'weapon-ranged' | 'armor' | 'accessory' | 'consumable' | 'misc';

/**
 * アイテム共通フラグ
 */
export interface ItemFlags {
  /**
   * 投擲時の基本挙動
   * - 'effect-then-disappear': 効果適用後に消滅（デフォルト: 効果あり）
   * - 'damage-then-disappear': ダメージ付与後に消滅（デフォルト: 効果なし）
   * - 'special': 特殊アイテム（後続の特別処理; 現状は空）
   */
  onThrow: 'effect-then-disappear' | 'damage-then-disappear' | 'special';
  /** 任意: 特殊識別子（将来拡張用） */
  specialId?: string;
}

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
