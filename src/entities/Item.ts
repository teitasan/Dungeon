/**
 * Item entity implementation
 */

import { Position, Component, EntityFlags } from '../types/core';
import { Item, ItemType, ItemEffect, EquipmentStats, ItemFlags, ItemIdentificationInfo, GridPosition } from '../types/entities';
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
  public spriteId?: string;
  public identificationGroupId?: string;
  public unidentifiedName?: string;
  public alwaysIdentified: boolean;
  public itemFlags: ItemFlags;
  public gridPosition?: GridPosition;
  private identifyHandler?: (item: ItemEntity) => void;

  constructor(
    id: string,
    name: string,
    itemType: ItemType,
    position: Position,
    identified: boolean = false,
    cursed: boolean = false,
    spriteId?: string,
    components: Component[] = [],
    flags: EntityFlags = {}
  ) {
    super(id, position, components, flags);
    this.entityType = 'item';
    
    this.name = name;
    this.itemType = itemType;
    this.identified = identified;
    this.cursed = cursed;
    this.spriteId = spriteId;
    this.effects = [];
    this.identificationGroupId = undefined;
    this.unidentifiedName = undefined;
    this.alwaysIdentified = false;
    this.identifyHandler = undefined;
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

  setIdentificationInfo(info: ItemIdentificationInfo = {}): void {
    this.identificationGroupId = info.groupId;
    this.unidentifiedName = info.unidentifiedName;
    this.alwaysIdentified = !!info.alwaysIdentified;
    if (this.alwaysIdentified) {
      this.identified = true;
    }
  }

  setIdentifyHandler(handler?: (item: ItemEntity) => void): void {
    this.identifyHandler = handler;
  }

  setIdentified(isIdentified: boolean): void {
    this.identified = isIdentified;
  }

  private copyIdentificationState(target: ItemEntity): void {
    target.identificationGroupId = this.identificationGroupId;
    target.unidentifiedName = this.unidentifiedName;
    target.alwaysIdentified = this.alwaysIdentified;
    target.identifyHandler = this.identifyHandler;
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
    if (!this.identified) {
      this.identified = true;
    }
    if (this.identifyHandler) {
      this.identifyHandler(this);
    }
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
    if (this.identified || this.alwaysIdentified) {
      return this.name;
    }

    if (this.unidentifiedName) {
      return this.unidentifiedName;
    }

    // Return generic name for unidentified items as fallback
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

  // ===== ECSから移植した便利メソッド =====

  /**
   * Check if item can be stacked with another
   */
  canStackWith(other: ItemEntity): boolean {
    return (
      this.name === other.name &&
      this.identified === other.identified &&
      this.cursed === other.cursed &&
      this.isConsumable() &&
      other.isConsumable()
    );
  }

  /**
   * Create new item with quantity updated
   */
  withQuantity(newQuantity: number): ItemEntity {
    const newItem = new ItemEntity(
      this.id,
      this.name,
      this.itemType,
      this.position,
      this.identified,
      this.cursed,
      this.spriteId,
      this.components,
      this.flags
    );
    newItem.effects = [...this.effects];
    newItem.equipmentStats = this.equipmentStats ? { ...this.equipmentStats } : undefined;
    newItem.attributes = this.attributes ? { ...this.attributes } : undefined;
    newItem.durability = this.durability;
    this.copyIdentificationState(newItem);
    return newItem;
  }

  /**
   * Create new item with identification
   */
  withIdentification(identified: boolean = true): ItemEntity {
    const newItem = new ItemEntity(
      this.id,
      this.name,
      this.itemType,
      this.position,
      identified,
      this.cursed,
      this.spriteId,
      this.components,
      this.flags
    );
    newItem.effects = [...this.effects];
    newItem.equipmentStats = this.equipmentStats ? { ...this.equipmentStats } : undefined;
    newItem.attributes = this.attributes ? { ...this.attributes } : undefined;
    newItem.durability = this.durability;
    this.copyIdentificationState(newItem);
    return newItem;
  }

  /**
   * Get item effects of specific type
   */
  getEffectsOfType(effectType: string): ItemEffect[] {
    return this.effects.filter(effect => effect.type === effectType);
  }

  /**
   * Get total effect value for specific type
   */
  getTotalEffectValue(effectType: string): number {
    return this.effects
      .filter(effect => effect.type === effectType)
      .reduce((total, effect) => total + (effect.value || 0), 0);
  }

  // ===== 汎用ファクトリメソッド =====

  /**
   * Create item from template ID using ItemSystem
   */
  static createFromTemplate(templateId: string, position: Position, itemSystem?: any): ItemEntity | null {
    try {
      if (itemSystem && typeof itemSystem.createItem === 'function') {
        return itemSystem.createItem(templateId, position);
      }

      // ItemSystemが未提供の場合はテンプレート取得のみ行う
      let template = null;
      if (itemSystem && typeof itemSystem.getItemTemplate === 'function') {
        template = itemSystem.getItemTemplate(templateId);
      }
      
      if (!template) {
        console.warn(`Item template not found: ${templateId}`);
        return null;
      }

      // テンプレートからアイテムを作成
      const templateIdentification = (template as any).identification as ItemIdentificationInfo | undefined;
      const startIdentified = templateIdentification?.alwaysIdentified ? true : !!template.identified;

      const item = new ItemEntity(
        `${templateId}-${Date.now()}`,
        template.name,
        template.itemType,
        position,
        startIdentified,
        template.cursed,
        (template as any).spriteId
      );

      if (templateIdentification) {
        const candidateNames = templateIdentification.unidentifiedNames;
        let unidentifiedName = templateIdentification.unidentifiedName;
        if (!unidentifiedName && Array.isArray(candidateNames) && candidateNames.length > 0) {
          const index = Math.floor(Math.random() * candidateNames.length);
          unidentifiedName = candidateNames[index];
        }

        item.setIdentificationInfo({
          ...templateIdentification,
          unidentifiedName,
        });
      }

      // エフェクトを追加
      if (template.effects) {
        template.effects.forEach((effect: any) => item.addEffect(effect));
      }

      // 装備ステータスを設定
      if (template.equipmentStats) {
        item.setEquipmentStats(template.equipmentStats);
      }

      // 属性を設定
      if (template.attributes) {
        item.setAttributes(template.attributes);
      }

      // 耐久度を設定
      if (template.durability !== undefined) {
        item.setDurability(template.durability);
      }

      return item;
    } catch (error) {
      console.error(`Failed to create item from template ${templateId}:`, error);
      return null;
    }
  }
  /**
   * Create item from template object
   */
  static createFromTemplateObject(template: any, position: Position): ItemEntity {
    const item = new ItemEntity(
      `${template.id || 'item'}-${Date.now()}`,
      template.name || template.id || 'Unknown Item',
      template.itemType || 'consumable',
      position,
      template.identified || false,
      template.cursed || false,
      (template as any).spriteId
    );

    if ((template as any).identification) {
      const identification = { ...((template as any).identification as ItemIdentificationInfo) };
      if (!identification.unidentifiedName && Array.isArray(identification.unidentifiedNames) && identification.unidentifiedNames.length > 0) {
        const index = Math.floor(Math.random() * identification.unidentifiedNames.length);
        identification.unidentifiedName = identification.unidentifiedNames[index];
      }
      item.setIdentificationInfo(identification);
    }

    // エフェクトを追加
    if (template.effects) {
      template.effects.forEach((effect: any) => item.addEffect(effect));
    }

    // 装備ステータスを設定
    if (template.equipmentStats) {
      item.setEquipmentStats(template.equipmentStats);
    }

    // 属性を設定
    if (template.attributes) {
      item.setAttributes(template.attributes);
    }

    // 耐久度を設定
    if (template.durability !== undefined) {
      item.setDurability(template.durability);
    }

    return item;
  }
}
