/**
 * ECS Item System - manages inventory and item usage
 * Pure ECS implementation: processes entities with inventory components
 */

import { System, SystemContext } from '../../core/System.js';
import { ComponentManager } from '../../core/ComponentManager.js';
import { EntityId } from '../../core/Entity.js';
import { InventoryComponent, InventoryComponentFactory, InventoryUtils, InventoryItem } from '../../components/common/Inventory.js';
import { ItemComponent, ItemComponentFactory, ItemUtils, ItemEffect } from '../../components/common/Item.js';
import { PositionComponent } from '../../components/common/Position.js';
import { HealthComponent, HealthUtils, HealthComponentFactory } from '../../components/common/Health.js';
import { HungerComponent, HungerUtils, HungerComponentFactory } from '../../components/status/Hunger.js';

/**
 * Item usage result
 */
export interface ItemUsageResult {
  success: boolean;
  itemId: string;
  userId: EntityId;
  targetId?: EntityId;
  effects: ItemEffectResult[];
  message: string;
  consumed: boolean;
}

/**
 * Item effect result
 */
export interface ItemEffectResult {
  type: string;
  value?: number;
  target: EntityId;
  success: boolean;
  message: string;
}

/**
 * Item pickup result
 */
export interface ItemPickupResult {
  success: boolean;
  itemId: string;
  entityId: EntityId;
  message: string;
  reason?: string;
}

/**
 * Item drop result
 */
export interface ItemDropResult {
  success: boolean;
  itemId: string;
  entityId: EntityId;
  position: { x: number; y: number };
  message: string;
  reason?: string;
}

/**
 * ECS Item System
 */
export class ECSItemSystem extends System {
  private groundItems: Map<string, { item: ItemComponent; position: PositionComponent }> = new Map();
  private itemTemplates: Map<string, ItemComponent> = new Map();

  constructor(componentManager: ComponentManager) {
    // This system processes entities that have inventory
    super(componentManager, ['inventory']);
    this.initializeDefaultItems();
    this.reloadTemplatesFromRegistry();
  }

  /**
   * Process items (mainly for cleanup and maintenance)
   */
  protected process(context: SystemContext, entities: EntityId[]): void {
    // Items are mainly event-driven
    // This could be used for item decay, expiration, etc.
  }

  /**
   * Use an item from entity's inventory
   */
  useItem(userId: EntityId, itemId: string, targetId?: EntityId): ItemUsageResult {
    const inventory = this.getComponent<InventoryComponent>(userId, 'inventory');
    if (!inventory) {
      return {
        success: false,
        itemId,
        userId,
        targetId,
        effects: [],
        message: 'Entity has no inventory',
        consumed: false
      };
    }

    const inventoryItem = InventoryUtils.getItem(inventory, itemId);
    if (!inventoryItem) {
      return {
        success: false,
        itemId,
        userId,
        targetId,
        effects: [],
        message: 'Item not found in inventory',
        consumed: false
      };
    }

    // Get item template for effects
    const itemTemplate = this.itemTemplates.get(inventoryItem.templateId);
    if (!itemTemplate) {
      return {
        success: false,
        itemId,
        userId,
        targetId,
        effects: [],
        message: 'Unknown item type',
        consumed: false
      };
    }

    const actualTarget = targetId || userId;
    const effects: ItemEffectResult[] = [];
    let success = false;

    // Process item effects
    for (const effect of itemTemplate.effects) {
      const effectResult = this.processItemEffect(effect, actualTarget, userId);
      effects.push(effectResult);
      
      if (effectResult.success) {
        success = true;
      }
    }

    // Consume item if successful and consumable
    let consumed = false;
    if (success && ItemUtils.isConsumable(itemTemplate)) {
      const removeResult = InventoryUtils.removeItem(inventory, itemId);
      if (removeResult.removedItem) {
        this.componentManager.removeComponent(userId, 'inventory');
        this.componentManager.addComponent(userId, removeResult.inventory);
        consumed = true;
      }
    }

    const message = this.generateUsageMessage(userId, inventoryItem, actualTarget, success);

    return {
      success,
      itemId,
      userId,
      targetId: actualTarget,
      effects,
      message,
      consumed
    };
  }

  /**
   * Throw an item from entity's inventory
   * Handles trajectory calculation, collision detection, and landing
   */
  throwItem(userId: EntityId, itemId: string, direction: 'north'|'south'|'east'|'west'|'northeast'|'southeast'|'southwest'|'northwest'): {
    success: boolean;
    message: string;
    landingPosition?: { x: number; y: number };
    consumed: boolean;
  } {
    const inventory = this.getComponent<InventoryComponent>(userId, 'inventory');
    if (!inventory) {
      return {
        success: false,
        message: 'Entity has no inventory',
        consumed: false
      };
    }

    // Find and remove item from inventory
    const itemIndex = inventory.items.findIndex(item => String(item.id) === String(itemId));
    if (itemIndex === -1) {
      return {
        success: false,
        message: 'Item not found in inventory',
        consumed: false
      };
    }

    const item = inventory.items[itemIndex];
    inventory.items.splice(itemIndex, 1);
    
    // 新しいインベントリを作成して更新
    const newInventory = {
      ...inventory,
      currentCapacity: Math.max(0, inventory.currentCapacity - 1)
    };
    this.componentManager.removeComponent(userId, 'inventory');
    this.componentManager.addComponent(userId, newInventory);

    // Direction vector mapping
    const dirMap: Record<string, { x: number; y: number }> = {
      north: { x: 0, y: -1 },
      south: { x: 0, y: 1 },
      west: { x: -1, y: 0 },
      east: { x: 1, y: 0 },
      northeast: { x: 1, y: -1 },
      southeast: { x: 1, y: 1 },
      southwest: { x: -1, y: 1 },
      northwest: { x: -1, y: -1 }
    };

    const vector = dirMap[direction] || { x: 0, y: 1 };
    const maxRange = 10;
    let lastValid = { x: 0, y: 0 };
    let landing: { x: number; y: number } | null = null;

    // Calculate trajectory and check for collisions
    for (let step = 1; step <= maxRange; step++) {
      const pos = { 
        x: vector.x * step, 
        y: vector.y * step 
      };
      
      // For now, assume all positions are valid (wall collision will be handled by non-ECS side)
      // In a full ECS implementation, this would check PositionComponent and collision components
      lastValid = { ...pos };
      
      if (step === maxRange) {
        landing = { ...pos };
        break;
      }
    }

    if (!landing) {
      landing = { ...lastValid };
    }

    // Return success - the actual landing and collision detection will be handled by the bridge
    return {
      success: true,
      message: 'Item thrown successfully',
      landingPosition: landing,
      consumed: true
    };
  }

  /**
   * Process individual item effect
   */
  private processItemEffect(effect: ItemEffect, targetId: EntityId, userId: EntityId): ItemEffectResult {
    let success = false;
    let message = '';
    const value = effect.value || 0;

    switch (effect.type) {
      case 'heal':
        const health = this.getComponent<HealthComponent>(targetId, 'health');
        if (health) {
          const actualHeal = HealthUtils.calculateApplicableHealing(health, value);
          const newHealth = HealthUtils.applyHealing(health, actualHeal);
          
          this.componentManager.removeComponent(targetId, 'health');
          this.componentManager.addComponent(targetId, newHealth);
          
          success = actualHeal > 0;
          message = success ? 
            `${targetId} recovers ${actualHeal} HP` : 
            `${targetId} is already at full health`;
        }
        break;

      case 'restore-hunger':
        const hunger = this.getComponent<HungerComponent>(targetId, 'hunger');
        if (hunger) {
          const actualRestore = HungerUtils.calculateApplicableRestore(hunger, value);
          const newHunger = HungerUtils.applyFeeding(hunger, actualRestore);
          
          this.componentManager.removeComponent(targetId, 'hunger');
          this.componentManager.addComponent(targetId, newHunger);
          
          success = actualRestore > 0;
          message = success ? 
            `${targetId} feels less hungry` : 
            `${targetId} is not hungry`;
        }
        break;

      case 'cure-status':
        // TODO: Implement status effect system
        success = true;
        message = `${targetId} feels refreshed`;
        break;

      case 'stat-boost':
        // TODO: Implement temporary stat boost system
        success = true;
        message = `${targetId} feels stronger`;
        break;

      case 'teleport':
        // TODO: Implement teleportation with dungeon system integration
        success = true;
        message = `${targetId} is teleported`;
        break;

      case 'identify':
        // Identify all items in target's inventory
        const targetInventory = this.getComponent<InventoryComponent>(targetId, 'inventory');
        if (targetInventory) {
          let identifiedCount = 0;
          const newItems: InventoryItem[] = [];
          
          for (const item of targetInventory.items) {
            if (!item.identified) {
              newItems.push({ ...item, identified: true });
              identifiedCount++;
            } else {
              newItems.push(item);
            }
          }
          
          if (identifiedCount > 0) {
            const newInventory = InventoryComponentFactory.createWithItems(newItems, targetInventory.maxCapacity);
            this.componentManager.removeComponent(targetId, 'inventory');
            this.componentManager.addComponent(targetId, newInventory);
          }
          
          success = identifiedCount > 0;
          message = success ? 
            `Identified ${identifiedCount} items` : 
            `All items are already identified`;
        }
        break;

      case 'damage':
        const targetHealth = this.getComponent<HealthComponent>(targetId, 'health');
        if (targetHealth) {
          const actualDamage = HealthUtils.calculateApplicableDamage(targetHealth, value);
          const newHealth = HealthUtils.applyDamage(targetHealth, actualDamage);
          
          this.componentManager.removeComponent(targetId, 'health');
          this.componentManager.addComponent(targetId, newHealth);
          
          success = true;
          message = `${targetId} takes ${actualDamage} damage`;
        }
        break;

      default:
        message = `Unknown effect: ${effect.type}`;
    }

    return {
      type: effect.type,
      value,
      target: targetId,
      success,
      message
    };
  }

  /**
   * Add item to entity's inventory
   */
  addItemToInventory(entityId: EntityId, item: InventoryItem): boolean {
    const inventory = this.getComponent<InventoryComponent>(entityId, 'inventory');
    if (!inventory) {
      return false;
    }

    const newInventory = InventoryUtils.addItem(inventory, item);
    if (!newInventory) {
      return false; // Inventory full
    }

    this.componentManager.removeComponent(entityId, 'inventory');
    this.componentManager.addComponent(entityId, newInventory);
    
    return true;
  }

  /**
   * Remove item from entity's inventory
   */
  removeItemFromInventory(entityId: EntityId, itemId: string): InventoryItem | null {
    const inventory = this.getComponent<InventoryComponent>(entityId, 'inventory');
    if (!inventory) {
      return null;
    }

    const removeResult = InventoryUtils.removeItem(inventory, itemId);
    if (!removeResult.removedItem) {
      return null;
    }

    this.componentManager.removeComponent(entityId, 'inventory');
    this.componentManager.addComponent(entityId, removeResult.inventory);
    
    return removeResult.removedItem;
  }

  /**
   * Pick up item from ground
   */
  pickupItem(entityId: EntityId, position: PositionComponent): ItemPickupResult {
    // Find items at position
    const positionKey = `${position.x},${position.y}`;
    const groundItemsAtPos = Array.from(this.groundItems.entries())
      .filter(([_, data]) => data.position.x === position.x && data.position.y === position.y);

    if (groundItemsAtPos.length === 0) {
      return {
        success: false,
        itemId: '',
        entityId,
        message: 'No items to pick up',
        reason: 'no-items'
      };
    }

    // Pick up first item
    const [groundItemId, groundItemData] = groundItemsAtPos[0];
    const item = groundItemData.item;

    // Check if entity has inventory
    const inventory = this.getComponent<InventoryComponent>(entityId, 'inventory');
    if (!inventory) {
      return {
        success: false,
        itemId: item.id,
        entityId,
        message: 'Entity has no inventory',
        reason: 'no-inventory'
      };
    }

    // Check if inventory is full
    if (InventoryUtils.isFull(inventory)) {
      return {
        success: false,
        itemId: item.id,
        entityId,
        message: 'Inventory is full',
        reason: 'inventory-full'
      };
    }

    // Convert item component to inventory item
    const inventoryItem: InventoryItem = {
      id: item.id,
      templateId: item.templateId,
      name: item.name,
      itemType: item.itemType,
      identified: item.identified,
      cursed: item.cursed,
      quantity: item.quantity
    };

    // Add to inventory
    const added = this.addItemToInventory(entityId, inventoryItem);
    if (added) {
      // Remove from ground
      this.groundItems.delete(groundItemId);
      
      return {
        success: true,
        itemId: item.id,
        entityId,
        message: `${entityId} picks up ${ItemUtils.getDisplayName(item)}`
      };
    } else {
      return {
        success: false,
        itemId: item.id,
        entityId,
        message: 'Could not pick up item',
        reason: 'add-failed'
      };
    }
  }

  /**
   * Drop item at position
   */
  dropItem(entityId: EntityId, itemId: string, position: PositionComponent): ItemDropResult {
    const removedItem = this.removeItemFromInventory(entityId, itemId);
    if (!removedItem) {
      return {
        success: false,
        itemId,
        entityId,
        position: { x: position.x, y: position.y },
        message: 'Item not found in inventory',
        reason: 'item-not-found'
      };
    }

    // Create item component for ground
    const itemComponent = ItemComponentFactory.create(
      removedItem.templateId,
      removedItem.name,
      removedItem.itemType,
      removedItem.identified,
      removedItem.cursed,
      removedItem.quantity
    );

    // Add to ground items
    const groundItemId = `ground_${Date.now()}_${Math.random()}`;
    this.groundItems.set(groundItemId, {
      item: itemComponent,
      position
    });

    return {
      success: true,
      itemId,
      entityId,
      position: { x: position.x, y: position.y },
      message: `${entityId} drops ${ItemUtils.getDisplayName(itemComponent)}`
    };
  }

  /**
   * Generate usage message
   */
  private generateUsageMessage(
    userId: EntityId,
    item: InventoryItem,
    targetId: EntityId,
    success: boolean
  ): string {
    if (success) {
      if (userId === targetId) {
        return `${userId} uses ${item.name}`;
      } else {
        return `${userId} uses ${item.name} on ${targetId}`;
      }
    } else {
      return `${userId} tries to use ${item.name} but nothing happens`;
    }
  }

  /**
   * Get items at position
   */
  getItemsAtPosition(position: PositionComponent): ItemComponent[] {
    return Array.from(this.groundItems.values())
      .filter(data => data.position.x === position.x && data.position.y === position.y)
      .map(data => data.item);
  }

  /**
   * Get all ground items
   */
  getAllGroundItems(): Array<{ item: ItemComponent; position: PositionComponent }> {
    return Array.from(this.groundItems.values());
  }

  /**
   * 地面にアイテムを作成・配置
   */
  createGroundItem(itemTemplateId: string, position: { x: number; y: number }, itemId?: string): string {
    const template = this.itemTemplates.get(itemTemplateId);
    if (!template) {
      throw new Error(`Item template not found: ${itemTemplateId}`);
    }

    const entityId = itemId || `ground-item-${Date.now()}-${Math.random()}`;
    
    // アイテムコンポーネントを作成
    const itemComponent = ItemComponentFactory.create(
      entityId,
      template.name,
      template.itemType,
      template.identified,
      template.cursed,
      template.quantity || 1
    );

    // 効果と装備ステータスをコピー
    if (template.effects) {
      (itemComponent as any).effects = [...template.effects];
    }
    if (template.equipmentStats) {
      (itemComponent as any).equipmentStats = { ...template.equipmentStats };
    }

    // 位置コンポーネントを作成（正しい型で）
    const positionComponent: PositionComponent = {
      id: `position-${entityId}`,
      type: 'position',
      x: position.x,
      y: position.y
    };

    // エンティティにコンポーネントを追加
    this.componentManager.addComponent(entityId, itemComponent);
    this.componentManager.addComponent(entityId, positionComponent);

    // 地面アイテムマップに登録
    this.groundItems.set(entityId, { item: itemComponent, position: positionComponent });

    console.log(`[ECSItemSystem] Ground item created: ${entityId} at (${position.x}, ${position.y})`);
    return entityId;
  }

  /**
   * 指定位置の地面アイテムを取得
   */
  getGroundItemAt(position: { x: number; y: number }): string | null {
    for (const [entityId, data] of this.groundItems) {
      if (data.position.x === position.x && data.position.y === position.y) {
        return entityId;
      }
    }
    return null;
  }

  /**
   * 地面アイテムを削除
   */
  removeGroundItem(itemId: string): boolean {
    if (!this.groundItems.has(itemId)) {
      return false;
    }

    // コンポーネントを削除
    this.componentManager.removeComponent(itemId, 'item');
    this.componentManager.removeComponent(itemId, 'position');

    // 地面アイテムマップから削除
    this.groundItems.delete(itemId);

    console.log(`[ECSItemSystem] Ground item removed: ${itemId}`);
    return true;
  }

  /**
   * 地面アイテムを移動
   */
  moveGroundItem(itemId: string, newPosition: { x: number; y: number }): boolean {
    const itemData = this.groundItems.get(itemId);
    if (!itemData) {
      return false;
    }

    // 新しい位置コンポーネントを作成
    const newPositionComponent: PositionComponent = {
      id: itemData.position.id,
      type: 'position',
      x: newPosition.x,
      y: newPosition.y
    };

    // 地面アイテムマップを更新
    this.groundItems.set(itemId, {
      item: itemData.item,
      position: newPositionComponent
    });

    // コンポーネントマネージャーの位置コンポーネントも更新
    this.componentManager.removeComponent(itemId, 'position');
    this.componentManager.addComponent(itemId, newPositionComponent);

    console.log(`[ECSItemSystem] Ground item moved: ${itemId} to (${newPosition.x}, ${newPosition.y})`);
    return true;
  }

  /**
   * 地面アイテムの数を取得
   */
  getGroundItemCount(): number {
    return this.groundItems.size;
  }

  /**
   * 地面アイテムを拾得
   */
  pickupGroundItem(itemId: string, userId: EntityId): ItemPickupResult {
    // 地面アイテムの存在確認
    const groundItemData = this.groundItems.get(itemId);
    if (!groundItemData) {
      return {
        success: false,
        itemId,
        entityId: userId,
        message: 'Item not found on ground',
        reason: 'item-not-found'
      };
    }

    // 拾得者のインベントリを取得
    const inventory = this.getComponent<InventoryComponent>(userId, 'inventory');
    if (!inventory) {
      return {
        success: false,
        itemId,
        entityId: userId,
        message: 'Entity has no inventory',
        reason: 'no-inventory'
      };
    }

    // インベントリの容量チェック
    if (inventory.currentCapacity >= inventory.maxCapacity) {
      return {
        success: false,
        itemId,
        entityId: userId,
        message: 'Inventory is full',
        reason: 'inventory-full'
      };
    }

    // インベントリにアイテムを追加
    const inventoryItem: InventoryItem = {
      id: groundItemData.item.id,
      templateId: groundItemData.item.templateId,
      name: groundItemData.item.name,
      itemType: groundItemData.item.itemType,
      identified: groundItemData.item.identified,
      cursed: groundItemData.item.cursed,
      quantity: groundItemData.item.quantity || 1
    };

    // 正しいメソッド名を使用
    const added = this.addItemToInventory(userId, inventoryItem);
    if (!added) {
      return {
        success: false,
        itemId,
        entityId: userId,
        message: 'Failed to add item to inventory',
        reason: 'add-failed'
      };
    }

    // 地面からアイテムを削除
    this.removeGroundItem(itemId);

    console.log(`[ECSItemSystem] Item picked up: ${itemId} by ${userId}`);
    
    return {
      success: true,
      itemId,
      entityId: userId,
      message: `${groundItemData.item.name} を ひろった！`
    };
  }

  /**
   * 指定位置のアイテムを自動拾得（容量チェック付き）
   */
  autoPickupAtPosition(position: { x: number; y: number }, userId: EntityId): ItemPickupResult | null {
    const itemId = this.getGroundItemAt(position);
    if (!itemId) {
      return null; // アイテムがない
    }

    return this.pickupGroundItem(itemId, userId);
  }

  /**
   * Create item from template
   */
  createItemFromTemplate(templateId: string): ItemComponent | null {
    const template = this.itemTemplates.get(templateId);
    if (!template) {
      return null;
    }

    return {
      ...template,
      id: `item_${Date.now()}_${Math.random()}` // New unique ID
    };
  }

  /**
   * Register item template
   */
  registerItemTemplate(template: ItemComponent): void {
    this.itemTemplates.set(template.templateId, template);
  }

  /**
   * Get item template
   */
  getItemTemplate(templateId: string): ItemComponent | undefined {
    return this.itemTemplates.get(templateId);
  }

  /**
   * Get all item template IDs
   */
  getItemTemplateIds(): string[] {
    return Array.from(this.itemTemplates.keys());
  }

  /**
   * Check if entity's inventory is full
   */
  isInventoryFull(entityId: EntityId): boolean {
    const inventory = this.getComponent<InventoryComponent>(entityId, 'inventory');
    return inventory ? InventoryUtils.isFull(inventory) : false;
  }

  /**
   * Get entity's inventory items
   */
  getInventoryItems(entityId: EntityId): InventoryItem[] {
    const inventory = this.getComponent<InventoryComponent>(entityId, 'inventory');
    return inventory ? inventory.items : [];
  }

  /**
   * Get entity's inventory capacity info
   */
  getInventoryCapacity(entityId: EntityId): { current: number; max: number } | null {
    const inventory = this.getComponent<InventoryComponent>(entityId, 'inventory');
    return inventory ? { current: inventory.currentCapacity, max: inventory.maxCapacity } : null;
  }

  /**
   * Initialize default item templates
   */
  private initializeDefaultItems(): void {
    // Health Potion
    this.registerItemTemplate(ItemComponentFactory.createHealthPotion());

    // Bread
    this.registerItemTemplate(ItemComponentFactory.createBread());

    // Antidote
    this.registerItemTemplate(ItemComponentFactory.createWithEffects(
      'antidote',
      'Antidote',
      'consumable',
      [
        {
          type: 'cure-status',
          description: 'Cures poison'
        }
      ]
    ));

    // Scroll of Identify
    this.registerItemTemplate(ItemComponentFactory.createWithEffects(
      'scroll-identify',
      'Scroll of Identify',
      'consumable',
      [
        {
          type: 'identify',
          description: 'Identifies all items in inventory'
        }
      ]
    ));

    // Teleport Scroll
    this.registerItemTemplate(ItemComponentFactory.createWithEffects(
      'scroll-teleport',
      'Scroll of Teleport',
      'consumable',
      [
        {
          type: 'teleport',
          description: 'Teleports to random location'
        }
      ]
    ));

    // Basic Sword
    this.registerItemTemplate(ItemComponentFactory.createEquipment(
      'basic-sword',
      'Basic Sword',
      'weapon-melee',
      {
        attackBonus: 3,
        defenseBonus: 0,
        accuracyBonus: 0,
        evasionBonus: 0,
        criticalBonus: 0.02
      }
    ));

    // Leather Armor
    this.registerItemTemplate(ItemComponentFactory.createEquipment(
      'leather-armor',
      'Leather Armor',
      'armor',
      {
        attackBonus: 0,
        defenseBonus: 2,
        accuracyBonus: 0,
        evasionBonus: 0.02,
        criticalBonus: 0
      }
    ));
  }

  protected onInitialize(): void {
    console.log('ECS Item System initialized');
  }

  /**
   * ItemRegistry にテンプレートが入っていれば、ECS側のテンプレマップを差し替える
   */
  public reloadTemplatesFromRegistry(): void {
    try {
      // 動的読み込み（ブラウザ/Node両対応用の安全策）
      // @ts-ignore
      const mod = require('../../../core/ItemRegistry.js');
      const reg = mod?.ItemRegistry?.getInstance?.();
      if (!reg || !reg.hasTemplates()) return;

      this.itemTemplates.clear();
      for (const tpl of reg.getAll()) {
        const comp = ItemComponentFactory.create(
          tpl.id,
          tpl.name,
          tpl.itemType,
          tpl.identified,
          tpl.cursed,
          1
        );
        // effects / equipmentStats などを反映
        if (tpl.effects && tpl.effects.length) {
          (comp as any).effects = [...tpl.effects];
        }
        if (tpl.equipmentStats) {
          (comp as any).equipmentStats = { ...tpl.equipmentStats };
        }
        this.itemTemplates.set(comp.templateId, comp);
      }
      console.log('[ECSItemSystem] templates loaded from ItemRegistry');
    } catch (e) {
      // 失敗してもデフォルトテンプレで継続
      console.warn('[ECSItemSystem] registry reload skipped:', e);
    }
  }
}
