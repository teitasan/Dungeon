/**
 * Item entity implementation
 */

import { Position, Component, EntityFlags, EntityStats } from '../types/core';
import { Item, ItemType, ItemEffect, EquipmentStats, ItemFlags } from '../types/entities';
import { BaseGameEntity } from './GameEntity.js';

export class ItemEntity extends BaseGameEntity implements Item {
  public name: string;
  public itemType: ItemType;
  public identified: boolean;
  public cursed: boolean;
  public durability?: number;
  public effects: ItemEffect[];
  public attributes?: {
    attackAttribute?: string;
    defenseAttributes?: string[];
  };
  public equipmentStats?: EquipmentStats;
  public itemFlags: ItemFlags;

  constructor(
    id: string,
    name: string,
    itemType: ItemType,
    position: Position,
    identified: boolean = false,
    cursed: boolean = false,
    components: Component[] = [],
    flags: EntityFlags = {}
  ) {
    // Items have minimal stats - mainly for consistency with GameEntity interface
    const itemStats: EntityStats = {
      hp: 1,
      maxHp: 1,
      attack: 0,
      defense: 0,
      evasionRate: 0
    };
    
    super(id, position, itemStats, components, flags);
    
    this.name = name;
    this.itemType = itemType;
    this.identified = identified;
    this.cursed = cursed;
    this.effects = [];
    // 既定のフラグ（効果の有無によりデフォルトを決定、初期は効果なし想定）
    this.itemFlags = { onThrow: 'damage-then-disappear' };
  }

  /**
   * Add an effect to this item
   */
  addEffect(effect: ItemEffect): void {
    this.effects.push(effect);
    // 効果が付与された場合、デフォルトの投擲挙動を効果適用→消滅に設定
    if (this.effects.length > 0 && this.itemFlags.onThrow === 'damage-then-disappear') {
      this.itemFlags.onThrow = 'effect-then-disappear';
    }
  }

  /**
   * Remove an effect from this item
   */
  removeEffect(effectType: string): void {
    this.effects = this.effects.filter(effect => effect.type !== effectType);
  }

  /**
   * Check if item has a specific effect
   */
  hasEffect(effectType: string): boolean {
    return this.effects.some(effect => effect.type === effectType);
  }

  /**
   * Get effect by type
   */
  getEffect(effectType: string): ItemEffect | undefined {
    return this.effects.find(effect => effect.type === effectType);
  }

  /**
   * Set equipment stats for equippable items
   */
  setEquipmentStats(stats: EquipmentStats): void {
    this.equipmentStats = stats;
  }

  /**
   * Set item attributes (for weapons and armor)
   */
  setAttributes(attributes: { attackAttribute?: string; defenseAttributes?: string[] }): void {
    this.attributes = attributes;
  }

  /**
   * Set durability for items that can break
   */
  setDurability(durability: number): void {
    this.durability = durability;
  }

  /**
   * Reduce durability (returns true if item breaks)
   */
  reduceDurability(amount: number = 1): boolean {
    if (this.durability === undefined) {
      return false; // Item doesn't have durability
    }

    this.durability = Math.max(0, this.durability - amount);
    return this.durability === 0;
  }

  /**
   * Identify the item
   */
  identify(): void {
    this.identified = true;
  }

  /**
   * Check if item is equippable
   */
  isEquippable(): boolean {
    return ['weapon-melee', 'weapon-ranged', 'armor', 'accessory'].includes(this.itemType);
  }

  /**
   * Check if item is consumable
   */
  isConsumable(): boolean {
    return this.itemType === 'consumable';
  }

  /**
   * Check if item is a weapon
   */
  isWeapon(): boolean {
    return this.itemType === 'weapon-melee' || this.itemType === 'weapon-ranged';
  }

  /**
   * Check if item is armor
   */
  isArmor(): boolean {
    return this.itemType === 'armor';
  }

  /**
   * Check if item is an accessory
   */
  isAccessory(): boolean {
    return this.itemType === 'accessory';
  }

  /**
   * Get display name (may be different if unidentified)
   */
  getDisplayName(): string {
    if (!this.identified) {
      // Return generic name for unidentified items
      switch (this.itemType) {
        case 'weapon-melee':
          return 'Unknown Weapon';
        case 'weapon-ranged':
          return 'Unknown Ranged Weapon';
        case 'armor':
          return 'Unknown Armor';
        case 'accessory':
          return 'Unknown Accessory';
        case 'consumable':
          return 'Unknown Item';
        default:
          return 'Unknown Item';
      }
    }
    
    return this.name;
  }

  /**
   * Use the item (for consumables)
   */
  use(): ItemEffect[] {
    if (!this.isConsumable()) {
      return [];
    }

    // Identify item when used
    this.identify();
    
    return this.effects;
  }
}
