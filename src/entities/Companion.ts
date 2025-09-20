/**
 * Companion entity implementation
 */

import { Position, Component, EntityFlags } from '../types/core';
import { Companion, CharacterAttributes, StatusEffect, Item } from '../types/entities';
import { CharacterInfo, CharacterStats } from '../types/character-info';
import { CharacterCalculator } from '../core/character-calculator';
import { BaseGameEntity, createDefaultCharacterAttributes } from './GameEntity';
import { MovementPattern, MovementPatternConfig } from '../types/ai';

export class CompanionEntity extends BaseGameEntity implements Companion {
  public characterInfo: CharacterInfo;
  public companionType: string;
  public characterStats: CharacterStats;
  public attributes: CharacterAttributes;
  public movementPattern?: MovementPattern;
  public movementConfig?: MovementPatternConfig;
  public behaviorMode: 'follow' | 'attack' | 'defend' | 'explore' | 'wait';
  public equipment: {
    weapon?: Item;
    armor?: Item;
    accessory?: Item;
  };
  public statusEffects: StatusEffect[];

  constructor(
    id: string,
    characterInfo: CharacterInfo,
    companionType: string,
    position: Position,
    attributes?: CharacterAttributes,
    movementPattern?: MovementPattern,
    movementConfig?: MovementPatternConfig,
    components: Component[] = [],
    flags: EntityFlags = {}
  ) {
    // 新しいシステムではCharacterStatsを使用
    const characterStats = CharacterCalculator.calculateAllStats(characterInfo, 1);
    
    super(id, position, components, flags);
    
    this.characterInfo = characterInfo;
    this.companionType = companionType;
    this.characterStats = characterStats;
    this.attributes = attributes || createDefaultCharacterAttributes('neutral');
    this.movementPattern = movementPattern;
    this.movementConfig = movementConfig;
    this.behaviorMode = 'follow'; // Default behavior
    this.equipment = {};
    this.statusEffects = [];
  }

  public get name(): string {
    return this.characterInfo.name;
  }

  /**
   * Set behavior mode
   */
  setBehaviorMode(mode: 'follow' | 'attack' | 'defend' | 'explore' | 'wait'): void {
    this.behaviorMode = mode;
  }

  /**
   * Equip an item
   */
  equipItem(item: Item): boolean {
    if (!item.equipmentStats) {
      return false; // Item is not equippable
    }

    let equipSlot: keyof typeof this.equipment;
    
    switch (item.itemType) {
      case 'weapon-melee':
      case 'weapon-ranged':
        equipSlot = 'weapon';
        break;
      case 'armor':
        equipSlot = 'armor';
        break;
      case 'accessory':
        equipSlot = 'accessory';
        break;
      default:
        return false; // Item type not equippable
    }

    // Equip new item (companions don't have inventory management in this basic implementation)
    this.equipment[equipSlot] = item;

    // Apply equipment bonuses
    this.applyEquipmentBonuses();
    
    return true;
  }

  /**
   * Unequip an item
   */
  unequipItem(slot: keyof typeof this.equipment): Item | undefined {
    const item = this.equipment[slot];
    if (!item) {
      return undefined;
    }

    // Check if item is cursed
    if (item.cursed) {
      return undefined; // Cannot unequip cursed items
    }

    this.equipment[slot] = undefined;

    // Recalculate equipment bonuses
    this.applyEquipmentBonuses();

    return item;
  }

  /**
   * Apply equipment bonuses to stats
   */
  private applyEquipmentBonuses(): void {
    // Reset to base stats first (simplified implementation)
    let totalAttackBonus = 0;
    let totalDefenseBonus = 0;

    // Calculate bonuses from all equipped items
    Object.values(this.equipment).forEach(item => {
      if (item?.equipmentStats) {
        totalAttackBonus += item.equipmentStats.attackBonus || 0;
        totalDefenseBonus += item.equipmentStats.defenseBonus || 0;
      }
    });

    // Apply bonuses (simplified - real implementation would need base stat tracking)
    this.characterStats.combat.damageBonus.melee += totalAttackBonus;
    this.characterStats.combat.resistance.physical += totalDefenseBonus;
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
   * Check if companion has a specific status effect
   */
  hasStatusEffect(type: StatusEffect['type']): boolean {
    return this.statusEffects.some(effect => effect.type === type);
  }

  // aiType は廃止

  /**
   * Check if companion is following player
   */
  isFollowing(): boolean {
    return this.behaviorMode === 'follow';
  }

  /**
   * Check if companion is in combat mode
   */
  isInCombat(): boolean {
    return this.behaviorMode === 'attack';
  }

  /**
   * Get experience value based on level (companions can be defeated)
   */
  getExperienceValue(): number {
    const experienceValue = (this.flags as any)?.experienceValue;
    return typeof experienceValue === 'number' ? experienceValue : 0;
  }
}
