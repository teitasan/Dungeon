/**
 * Base GameEntity class and factory functions
 * Provides common functionality for all game entities
 */

import { GameEntity, Position, Component, EntityStats, EntityFlags } from '../types/core';
import { Player, Monster, Companion, Item, CharacterStats, CharacterAttributes, StatusEffect } from '../types/entities';

/**
 * Base GameEntity implementation
 */
export class BaseGameEntity implements GameEntity {
  public id: string;
  public position: Position;
  public components: Component[];
  public stats: EntityStats;
  public flags: EntityFlags;

  constructor(
    id: string,
    position: Position,
    stats: EntityStats,
    components: Component[] = [],
    flags: EntityFlags = {}
  ) {
    this.id = id;
    this.position = position;
    this.stats = stats;
    this.components = components;
    this.flags = flags;
  }

  /**
   * Update entity position
   */
  setPosition(position: Position): void {
    this.position = position;
  }

  /**
   * Add a component to this entity
   */
  addComponent(component: Component): void {
    this.components.push(component);
  }

  /**
   * Remove a component by ID
   */
  removeComponent(componentId: string): void {
    this.components = this.components.filter(c => c.id !== componentId);
  }

  /**
   * Get a component by ID
   */
  getComponent(componentId: string): Component | undefined {
    return this.components.find(c => c.id === componentId);
  }

  /**
   * Update entity stats
   */
  updateStats(newStats: Partial<EntityStats>): void {
    this.stats = { ...this.stats, ...newStats };
  }

  /**
   * Set a flag value
   */
  setFlag(key: string, value: any): void {
    this.flags[key] = value;
  }

  /**
   * Get a flag value
   */
  getFlag(key: string): any {
    return this.flags[key];
  }
}

/**
 * Create default character stats
 */
export function createDefaultCharacterStats(
  level: number = 1,
  baseHp: number = 20,
  baseAttack: number = 5,
  baseDefense: number = 3
): CharacterStats {
  return {
    level,
    experience: 0,
    experienceValue: level * 10, // Default experience value when defeated
    hp: baseHp,
    maxHp: baseHp,
    attack: baseAttack,
    defense: baseDefense,
    evasionRate: 0.05 // 5% base evasion rate
  };
}

/**
 * Create default character attributes
 */
export function createDefaultCharacterAttributes(primaryAttribute: string = 'neutral'): CharacterAttributes {
  return {
    primary: primaryAttribute,
    resistances: [],
    weaknesses: []
  };
}

/**
 * Calculate level-up stats based on growth rates
 */
export function calculateLevelUpStats(
  currentStats: CharacterStats,
  growthRates: { hp: number; attack: number; defense: number }
): CharacterStats {
  const newLevel = currentStats.level + 1;
  const newMaxHp = Math.floor(currentStats.maxHp * growthRates.hp);
  const hpIncrease = newMaxHp - currentStats.maxHp;
  
  return {
    ...currentStats,
    level: newLevel,
    experienceValue: newLevel * 10, // Update experience value
    hp: currentStats.hp + hpIncrease, // Increase current HP by the same amount
    maxHp: newMaxHp,
    attack: Math.floor(currentStats.attack * growthRates.attack),
    defense: Math.floor(currentStats.defense * growthRates.defense)
  };
}

/**
 * Check if character has enough experience to level up
 */
export function canLevelUp(stats: CharacterStats, experienceTable: number[]): boolean {
  if (stats.level >= experienceTable.length) {
    return false; // Max level reached
  }
  
  const requiredExp = experienceTable[stats.level - 1]; // Array is 0-indexed, level is 1-indexed
  return stats.experience >= requiredExp;
}

/**
 * Add experience to character and handle level up
 */
export function addExperience(
  stats: CharacterStats,
  amount: number,
  experienceTable: number[],
  growthRates: { hp: number; attack: number; defense: number }
): { newStats: CharacterStats; leveledUp: boolean } {
  let newStats = { ...stats, experience: stats.experience + amount };
  let leveledUp = false;

  // Check for level up
  while (canLevelUp(newStats, experienceTable)) {
    const requiredExp = experienceTable[newStats.level - 1];
    const remainingExp = newStats.experience - requiredExp;
    
    newStats = calculateLevelUpStats(newStats, growthRates);
    newStats.experience = remainingExp; // Set remaining experience after level up
    leveledUp = true;
  }

  return { newStats, leveledUp };
}