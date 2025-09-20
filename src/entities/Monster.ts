/**
 * Monster entity implementation
 */

import { Position, Component, EntityFlags } from '../types/core';
import { Monster, CharacterAttributes, StatusEffect, DropTableEntry, SpawnCondition } from '../types/entities';
import { CharacterInfo, CharacterStats } from '../types/character-info';
import { CharacterCalculator } from '../core/character-calculator';
import { BaseGameEntity, createDefaultCharacterAttributes } from './GameEntity.js';
import { MovementPattern, MovementPatternConfig } from '../types/ai';

export class MonsterEntity extends BaseGameEntity implements Monster {
  public characterInfo: CharacterInfo;
  public monsterType: string;
  public characterStats: CharacterStats;
  public attributes: CharacterAttributes;
  public movementPattern?: MovementPattern;
  public movementConfig?: MovementPatternConfig;
  public dropTable: DropTableEntry[];
  public spawnWeight: number;
  public spawnConditions: SpawnCondition[];
  public statusEffects: StatusEffect[];
  public spriteId?: string;
  public spritesheet?: string; // スプライトシートの種類（basic, elite, boss）
  public currentDirection: string = 'front'; // 現在の向き
  public speedState: 'normal' | 'fast' | 'slow' = 'normal'; // 速度状態

  constructor(
    id: string,
    characterInfo: CharacterInfo,
    monsterType: string,
    position: Position,
    attributes?: CharacterAttributes,
    movementPattern?: MovementPattern,
    movementConfig?: MovementPatternConfig,
    spriteId?: string,
    experienceValue?: number,
    dropRate?: number,
    dropTableId?: string,
    level?: number,
    description?: string,
    spritesheet?: string,
    components: Component[] = [],
    flags: EntityFlags = {}
  ) {
    // 新しいシステムではCharacterStatsを使用
    const characterStats = CharacterCalculator.calculateAllStats(characterInfo, level || 1);
    
    super(id, position, components, flags);
    
    this.characterInfo = characterInfo;
    this.monsterType = monsterType;
    this.characterStats = characterStats;
    this.attributes = attributes || createDefaultCharacterAttributes('neutral');
    this.movementPattern = movementPattern;
    this.movementConfig = movementConfig;
    this.spriteId = spriteId;
    this.spritesheet = spritesheet;
    this.dropTable = []; // 初期化時は空、後でdropTableIdから設定
    this.spawnWeight = 1.0; // Default spawn weight
    this.spawnConditions = [];
    this.statusEffects = [];
    
    // 新しいパラメータを設定
    if (experienceValue !== undefined) {
      this.setFlag('experienceValue', experienceValue);
    }
    if (level !== undefined) {
      this.characterStats.level = level;
    }
    
    // ドロップ率とドロップテーブルIDを設定
    this.setFlag('dropRate', dropRate || 0.0);
    this.setFlag('dropTableId', dropTableId || '');
    this.setFlag('description', description || '');
  }

  public get name(): string {
    return this.characterInfo.name;
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

  // aiType は廃止

  /**
   * Get experience value based on level
   */
  getExperienceValue(): number {
    const experienceValue = (this.flags as any)?.experienceValue;
    return typeof experienceValue === 'number' ? experienceValue : 0;
  }


}
