/**
 * Companion entity implementation
 */

import { Position, Component, EntityFlags } from '../types/core';
import { Companion, CharacterStats, CharacterAttributes, StatusEffect, Item } from '../types/entities';
import { BaseGameEntity, createDefaultCharacterStats, createDefaultCharacterAttributes } from './GameEntity';

export class CompanionEntity extends BaseGameEntity implements Companion {
  public name: string;
  public companionType: string;
  public stats: CharacterStats;
  public attributes: CharacterAttributes;
  public aiType: string;
  public behaviorMode: 'follow' | 'attack' | 'defend' | 'explore' | 'wait';
  public equipment: {
    weapon?: Item;
    armor?: Item;
    accessory?: Item;
  };
  public statusEffects: StatusEffect[];

  constructor(
    id: string,
    name: string,
    companionType: string,
    position: Position,
    stats?: CharacterStats,
    attributes?: CharacterAttributes,
    aiType: string = 'companion-follow',
    components: Component[] = [],
    flags: EntityFlags = {}
  ) {
    const companionStats = stats || createDefaultCharacterStats(1, 25, 7, 4); // Companions have balanced stats
    super(id, position, companionStats, components, flags);
    
    this.name = name;
    this.companionType = companionType;
    this.stats = companionStats;
    this.attributes = attributes || createDefaultCharacterAttributes('neutral');
    this.aiType = aiType;
    this.behaviorMode = 'follow'; // Default behavior
    this.equipment = {};
    this.statusEffects = [];
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
    this.stats.attack += totalAttackBonus;
    this.stats.defense += totalDefenseBonus;
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

  /**
   * Update AI type
   */
  setAIType(aiType: string): void {
    this.aiType = aiType;
  }

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
    return this.stats.experienceValue;
  }
}