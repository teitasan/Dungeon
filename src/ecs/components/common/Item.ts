/**
 * Item Component - represents an item entity
 * Pure data structure, no logic
 */

import { Component } from '../../core/Component.js';

/**
 * Item effect data
 */
export interface ItemEffect {
  readonly type: string;
  readonly value?: number;
  readonly target?: string;
  readonly duration?: number;
  readonly description: string;
}

/**
 * Equipment stats for equippable items
 */
export interface EquipmentStats {
  readonly attackBonus: number;
  readonly defenseBonus: number;
  readonly accuracyBonus: number;
  readonly evasionBonus: number;
  readonly criticalBonus: number;
}

/**
 * Item component data
 */
export interface ItemComponent extends Component {
  readonly type: 'item';
  readonly templateId: string;
  readonly name: string;
  readonly itemType: string;
  readonly identified: boolean;
  readonly cursed: boolean;
  readonly quantity: number;
  readonly maxQuantity: number;
  readonly effects: ItemEffect[];
  readonly equipmentStats?: EquipmentStats;
  readonly durability?: number;
  readonly maxDurability?: number;
}

/**
 * Item component factory
 */
export class ItemComponentFactory {
  /**
   * Create an item component
   */
  static create(
    templateId: string,
    name: string,
    itemType: string,
    identified: boolean = false,
    cursed: boolean = false,
    quantity: number = 1
  ): ItemComponent {
    return {
      id: `item_${Date.now()}_${Math.random()}`,
      type: 'item',
      templateId,
      name,
      itemType,
      identified,
      cursed,
      quantity: Math.max(1, quantity),
      maxQuantity: itemType === 'consumable' ? 99 : 1,
      effects: []
    };
  }

  /**
   * Create an item component with effects
   */
  static createWithEffects(
    templateId: string,
    name: string,
    itemType: string,
    effects: ItemEffect[],
    identified: boolean = false,
    cursed: boolean = false
  ): ItemComponent {
    return {
      id: `item_${Date.now()}_${Math.random()}`,
      type: 'item',
      templateId,
      name,
      itemType,
      identified,
      cursed,
      quantity: 1,
      maxQuantity: itemType === 'consumable' ? 99 : 1,
      effects: [...effects]
    };
  }

  /**
   * Create an equipment item component
   */
  static createEquipment(
    templateId: string,
    name: string,
    itemType: string,
    equipmentStats: EquipmentStats,
    identified: boolean = false,
    cursed: boolean = false
  ): ItemComponent {
    return {
      id: `item_${Date.now()}_${Math.random()}`,
      type: 'item',
      templateId,
      name,
      itemType,
      identified,
      cursed,
      quantity: 1,
      maxQuantity: 1,
      effects: [],
      equipmentStats
    };
  }

  /**
   * Create a consumable item
   */
  static createConsumable(
    templateId: string,
    name: string,
    effects: ItemEffect[],
    quantity: number = 1
  ): ItemComponent {
    return this.createWithEffects(templateId, name, 'consumable', effects, true, false);
  }

  /**
   * Create a health potion
   */
  static createHealthPotion(): ItemComponent {
    return this.createConsumable('health-potion', 'Health Potion', [
      {
        type: 'heal',
        value: 20,
        description: 'Restores 20 HP'
      }
    ]);
  }

  /**
   * Create bread
   */
  static createBread(): ItemComponent {
    return this.createConsumable('bread', 'Bread', [
      {
        type: 'restore-hunger',
        value: 30,
        description: 'Restores 30 hunger'
      }
    ]);
  }
}

/**
 * Item utilities
 */
export class ItemUtils {
  /**
   * Check if item is consumable
   */
  static isConsumable(item: ItemComponent): boolean {
    return item.itemType === 'consumable';
  }

  /**
   * Check if item is equippable
   */
  static isEquippable(item: ItemComponent): boolean {
    return item.equipmentStats !== undefined;
  }

  /**
   * Check if item is weapon
   */
  static isWeapon(item: ItemComponent): boolean {
    return item.itemType.includes('weapon');
  }

  /**
   * Check if item is armor
   */
  static isArmor(item: ItemComponent): boolean {
    return item.itemType === 'armor';
  }

  /**
   * Check if item is accessory
   */
  static isAccessory(item: ItemComponent): boolean {
    return item.itemType === 'accessory';
  }

  /**
   * Get item display name (considering identification)
   */
  static getDisplayName(item: ItemComponent): string {
    if (item.identified) {
      return item.cursed ? `${item.name} (cursed)` : item.name;
    } else {
      return `Unidentified ${item.itemType}`;
    }
  }

  /**
   * Check if item can be stacked with another
   */
  static canStackWith(item1: ItemComponent, item2: ItemComponent): boolean {
    return (
      item1.templateId === item2.templateId &&
      item1.identified === item2.identified &&
      item1.cursed === item2.cursed &&
      ItemUtils.isConsumable(item1) &&
      ItemUtils.isConsumable(item2)
    );
  }

  /**
   * Create new item with quantity updated
   */
  static withQuantity(item: ItemComponent, newQuantity: number): ItemComponent {
    return {
      ...item,
      id: `item_${Date.now()}_${Math.random()}`, // New ID for new component
      quantity: Math.max(0, Math.min(newQuantity, item.maxQuantity))
    };
  }

  /**
   * Create new item with identification
   */
  static withIdentification(item: ItemComponent, identified: boolean = true): ItemComponent {
    return {
      ...item,
      id: `item_${Date.now()}_${Math.random()}`, // New ID for new component
      identified
    };
  }

  /**
   * Get item effects of specific type
   */
  static getEffectsOfType(item: ItemComponent, effectType: string): ItemEffect[] {
    return item.effects.filter(effect => effect.type === effectType);
  }

  /**
   * Check if item has specific effect
   */
  static hasEffect(item: ItemComponent, effectType: string): boolean {
    return item.effects.some(effect => effect.type === effectType);
  }

  /**
   * Get total effect value for specific type
   */
  static getTotalEffectValue(item: ItemComponent, effectType: string): number {
    return item.effects
      .filter(effect => effect.type === effectType)
      .reduce((total, effect) => total + (effect.value || 0), 0);
  }
}
