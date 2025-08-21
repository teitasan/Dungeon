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
}
