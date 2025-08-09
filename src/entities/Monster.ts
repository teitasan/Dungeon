/**
 * Monster entity implementation
 */

import { Position, Component, EntityFlags } from '../types/core';
import { Monster, CharacterStats, CharacterAttributes, StatusEffect, DropTableEntry, SpawnCondition } from '../types/entities';
import { BaseGameEntity, createDefaultCharacterStats, createDefaultCharacterAttributes } from './GameEntity';

export class MonsterEntity extends BaseGameEntity implements Monster {
  public name: string;
  public monsterType: string;
  public stats: CharacterStats;
  public attributes: CharacterAttributes;
  public aiType: string;
  public dropTable: DropTableEntry[];
  public spawnWeight: number;
  public spawnConditions: SpawnCondition[];
  public statusEffects: StatusEffect[];

  constructor(
    id: string,
    name: string,
    monsterType: string,
    position: Position,
    stats?: CharacterStats,
    attributes?: CharacterAttributes,
    aiType: string = 'basic-hostile',
    components: Component[] = [],
    flags: EntityFlags = {}
  ) {
    const monsterStats = stats || createDefaultCharacterStats(1, 15, 6, 2); // Monsters have varied stats
    super(id, position, monsterStats, components, flags);
    
    this.name = name;
    this.monsterType = monsterType;
    this.stats = monsterStats;
    this.attributes = attributes || createDefaultCharacterAttributes('neutral');
    this.aiType = aiType;
    this.dropTable = [];
    this.spawnWeight = 1.0; // Default spawn weight
    this.spawnConditions = [];
    this.statusEffects = [];
  }

  /**
   * Add drop table entry
   */
  addDropTableEntry(entry: DropTableEntry): void {
    this.dropTable.push(entry);
  }

  /**
   * Remove drop table entry
   */
  removeDropTableEntry(itemId: string): void {
    this.dropTable = this.dropTable.filter(entry => entry.itemId !== itemId);
  }

  /**
   * Get total drop weight for probability calculations
   */
  getTotalDropWeight(): number {
    return this.dropTable.reduce((total, entry) => total + entry.weight, 0);
  }

  /**
   * Add spawn condition
   */
  addSpawnCondition(condition: SpawnCondition): void {
    this.spawnConditions.push(condition);
  }

  /**
   * Check if monster can spawn based on conditions
   */
  canSpawn(context: any): boolean {
    // TODO: Implement spawn condition checking in future tasks
    return this.spawnConditions.every(condition => {
      // Placeholder - actual implementation depends on condition types
      return true;
    });
  }

  /**
   * Add status effect
   */
  addStatusEffect(effect: StatusEffect): void {
    this.statusEffects.push(effect);
  }

  /**
   * Remove status effect
   */
  removeStatusEffect(type: StatusEffect['type']): void {
    this.statusEffects = this.statusEffects.filter(effect => effect.type !== type);
  }

  /**
   * Check if monster has a specific status effect
   */
  hasStatusEffect(type: StatusEffect['type']): boolean {
    return this.statusEffects.some(effect => effect.type === type);
  }

  /**
   * Update AI type
   */
  setAIType(aiType: string): void {
    this.aiType = aiType;
  }

  /**
   * Check if monster is hostile
   */
  isHostile(): boolean {
    return this.aiType.includes('hostile');
  }

  /**
   * Get experience value based on level
   */
  getExperienceValue(): number {
    return this.stats.experienceValue;
  }
}