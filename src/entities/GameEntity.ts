/**
 * Base GameEntity class and factory functions
 * Provides common functionality for all game entities
 */

import { GameEntity, Position, Component, EntityFlags } from '../types/core';
import { Player, Monster, Companion, Item, CharacterAttributes, StatusEffect } from '../types/entities';

/**
 * Base GameEntity implementation
 */
export class BaseGameEntity implements GameEntity {
  public id: string;
  public position: Position;
  public components: Component[];
  public flags: EntityFlags;

  constructor(
    id: string,
    position: Position,
    components: Component[] = [],
    flags: EntityFlags = {}
  ) {
    this.id = id;
    this.position = position;
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
  const newMaxHp = Math.floor(currentStats.hp.max * growthRates.hp);
  const hpIncrease = newMaxHp - currentStats.hp.max;
  
  return {
    ...currentStats,
    level: newLevel,
    hp: {
      current: currentStats.hp.current + hpIncrease, // Increase current HP by the same amount
      max: newMaxHp
    },
    mp: {
      current: currentStats.mp.current,
      max: Math.floor(currentStats.mp.max * growthRates.hp) // MP also grows with HP rate
    },
    combat: {
      ...currentStats.combat,
      damageBonus: {
        melee: Math.floor(currentStats.combat.damageBonus.melee * growthRates.attack),
        range: Math.floor(currentStats.combat.damageBonus.range * growthRates.attack),
        magic: Math.floor(currentStats.combat.damageBonus.magic * growthRates.attack)
      },
      resistance: {
        physical: Math.floor(currentStats.combat.resistance.physical * growthRates.defense),
        magic: Math.floor(currentStats.combat.resistance.magic * growthRates.defense)
      }
    }
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
  return stats.experience.current >= requiredExp;
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
  // 新しい形式のCharacterStatsに対応
  let newStats = { 
    ...stats, 
    experience: {
      total: stats.experience.total + amount,
      required: stats.experience.required,
      current: stats.experience.current + amount
    }
  };
  let leveledUp = false;

  // Check for level up
  while (canLevelUp(newStats, experienceTable)) {
    const requiredExp = experienceTable[newStats.level - 1];
    const remainingExp = newStats.experience.current - requiredExp;
    
    newStats = calculateLevelUpStats(newStats, growthRates);
    newStats.experience.current = remainingExp; // Set remaining experience after level up
    newStats.experience.required = experienceTable[newStats.level - 1] || 0; // Update required exp for next level
    leveledUp = true;
  }

  return { newStats, leveledUp };
}