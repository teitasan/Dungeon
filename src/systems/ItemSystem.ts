/**
 * Item system for managing items, inventory, and item usage
 */

import { GameEntity } from '../types/entities';
import { ItemEntity } from '../entities/Item';
import { PlayerEntity } from '../entities/Player';
import { Position } from '../types/core';
import { DungeonManager } from '../dungeon/DungeonManager';

// Item usage result
export interface ItemUsageResult {
  success: boolean;
  item: ItemEntity;
  user: GameEntity;
  effects: ItemUsageEffect[];
  message: string;
  consumed: boolean;
}

export interface ItemUsageEffect {
  type: ItemUsageEffectType;
  value?: number;
  target: GameEntity;
  success: boolean;
  message: string;
}

export type ItemUsageEffectType = 
  | 'heal' 
  | 'restore-hunger' 
  | 'cure-status' 
  | 'stat-boost' 
  | 'teleport' 
  | 'identify' 
  | 'damage' 
  | 'special';

// Item pickup result
export interface ItemPickupResult {
  success: boolean;
  item: ItemEntity;
  entity: GameEntity;
  message: string;
  reason?: string;
}

// Item drop result
export interface ItemDropResult {
  success: boolean;
  item: ItemEntity;
  entity: GameEntity;
  position: Position;
  message: string;
  reason?: string;
}

// Inventory management
export interface InventoryManager {
  addItem(entity: GameEntity, item: ItemEntity): boolean;
  removeItem(entity: GameEntity, itemId: string): ItemEntity | null;
  getItems(entity: GameEntity): ItemEntity[];
  hasItem(entity: GameEntity, itemId: string): boolean;
  getItemCount(entity: GameEntity): number;
  getMaxCapacity(entity: GameEntity): number;
  isFull(entity: GameEntity): boolean;
}

export class ItemSystem implements InventoryManager {
  private dungeonManager: DungeonManager;
  private itemTemplates: Map<string, ItemTemplate> = new Map();

  constructor(dungeonManager: DungeonManager) {
    this.dungeonManager = dungeonManager;
    this.initializeDefaultItems();
  }

  /**
   * Use an item
   */
  useItem(user: GameEntity, item: ItemEntity, target?: GameEntity): ItemUsageResult {
    const actualTarget = target || user;
    const effects: ItemUsageEffect[] = [];
    let consumed = false;
    let success = false;

    // Check if item is consumable
    if (!item.isConsumable()) {
      return {
        success: false,
        item,
        user,
        effects: [],
        message: `${item.name} cannot be used`,
        consumed: false
      };
    }

    // Process item effects
    for (const effect of item.effects) {
      const effectResult = this.processItemEffect(effect, actualTarget, user);
      effects.push(effectResult);
      
      if (effectResult.success) {
        success = true;
      }
    }

    // Identify item when used
    item.identify();

    // Consume item if it's consumable
    if (item.isConsumable() && success) {
      consumed = true;
      this.removeItem(user, item.id);
    }

    const message = this.generateUsageMessage(user, item, actualTarget, success);

    return {
      success,
      item,
      user,
      effects,
      message,
      consumed
    };
  }

  /**
   * Process individual item effect
   */
  private processItemEffect(
    effect: any, 
    target: GameEntity, 
    user: GameEntity
  ): ItemUsageEffect {
    let success = false;
    let message = '';
    let value = effect.value || 0;

    switch (effect.type) {
      case 'heal':
        if ('stats' in target) {
          const stats = (target as any).stats;
          const actualHeal = Math.min(value, stats.maxHp - stats.hp);
          stats.hp = Math.min(stats.maxHp, stats.hp + value);
          success = actualHeal > 0;
          message = success ? 
            `${target.id} recovers ${actualHeal} HP` : 
            `${target.id} is already at full health`;
        }
        break;

      case 'restore-hunger':
        if ('hunger' in target) {
          const player = target as PlayerEntity;
          const oldHunger = player.hunger;
          player.hunger = Math.min(player.maxHunger, player.hunger + value);
          const actualRestore = player.hunger - oldHunger;
          success = actualRestore > 0;
          message = success ? 
            `${target.id} feels less hungry` : 
            `${target.id} is not hungry`;
        }
        break;

      case 'cure-status':
        if ('statusEffects' in target) {
          const statusEffects = (target as any).statusEffects;
          const beforeCount = statusEffects.length;
          
          if (effect.statusType) {
            // Cure specific status
            const index = statusEffects.findIndex((s: any) => s.type === effect.statusType);
            if (index !== -1) {
              statusEffects.splice(index, 1);
              success = true;
              message = `${target.id} is cured of ${effect.statusType}`;
            }
          } else {
            // Cure all status effects
            statusEffects.length = 0;
            success = beforeCount > 0;
            message = success ? 
              `${target.id} is cured of all status effects` : 
              `${target.id} has no status effects to cure`;
          }
        }
        break;

      case 'stat-boost':
        // Temporary stat boost (would need integration with status effect system)
        success = true;
        message = `${target.id} feels stronger`;
        break;

      case 'teleport':
        // Random teleportation
        if (this.dungeonManager.getCurrentDungeon()) {
          // Find random walkable position
          const dungeon = this.dungeonManager.getCurrentDungeon()!;
          let attempts = 0;
          let newPos: Position | null = null;
          
          while (attempts < 50 && !newPos) {
            const x = Math.floor(Math.random() * dungeon.width);
            const y = Math.floor(Math.random() * dungeon.height);
            const testPos = { x, y };
            
            if (this.dungeonManager.isWalkable(testPos)) {
              newPos = testPos;
            }
            attempts++;
          }
          
          if (newPos) {
            this.dungeonManager.moveEntity(target, newPos);
            success = true;
            message = `${target.id} is teleported`;
          } else {
            message = `Teleportation failed`;
          }
        }
        break;

      case 'identify':
        // Identify items in inventory
        if ('inventory' in target) {
          const inventory = (target as any).inventory as ItemEntity[];
          let identifiedCount = 0;
          
          for (const invItem of inventory) {
            if (!invItem.identified) {
              invItem.identify();
              identifiedCount++;
            }
          }
          
          success = identifiedCount > 0;
          message = success ? 
            `Identified ${identifiedCount} items` : 
            `All items are already identified`;
        }
        break;

      case 'damage':
        if ('stats' in target) {
          const stats = (target as any).stats;
          const actualDamage = Math.min(value, stats.hp);
          stats.hp = Math.max(0, stats.hp - value);
          success = true;
          message = `${target.id} takes ${actualDamage} damage`;
        }
        break;

      default:
        message = `Unknown effect: ${effect.type}`;
    }

    return {
      type: effect.type,
      value,
      target,
      success,
      message
    };
  }

  /**
   * Generate usage message
   */
  private generateUsageMessage(
    user: GameEntity, 
    item: ItemEntity, 
    target: GameEntity, 
    success: boolean
  ): string {
    const userName = (user as any).name || user.id;
    const targetName = (target as any).name || target.id;
    
    if (success) {
      if (user === target) {
        return `${userName} uses ${item.name}`;
      } else {
        return `${userName} uses ${item.name} on ${targetName}`;
      }
    } else {
      return `${userName} tries to use ${item.name} but nothing happens`;
    }
  }

  /**
   * Pick up item from ground
   */
  pickupItem(entity: GameEntity, position: Position): ItemPickupResult {
    const entitiesAtPosition = this.dungeonManager.getEntitiesAt(position);
    const items = entitiesAtPosition.filter(e => e instanceof ItemEntity) as ItemEntity[];
    
    if (items.length === 0) {
      return {
        success: false,
        item: null as any,
        entity,
        message: 'No items to pick up',
        reason: 'no-items'
      };
    }

    // Pick up first item
    const item = items[0];
    
    // Check if entity can hold more items
    if (this.isFull(entity)) {
      return {
        success: false,
        item,
        entity,
        message: 'Inventory is full',
        reason: 'inventory-full'
      };
    }

    // Remove from ground and add to inventory
    this.dungeonManager.removeEntity(item);
    const added = this.addItem(entity, item);
    
    if (added) {
      const entityName = (entity as any).name || entity.id;
      return {
        success: true,
        item,
        entity,
        message: `${entityName} picks up ${item.getDisplayName()}`
      };
    } else {
      // Put back on ground if couldn't add to inventory
      this.dungeonManager.addEntity(item, position);
      return {
        success: false,
        item,
        entity,
        message: 'Could not pick up item',
        reason: 'add-failed'
      };
    }
  }

  /**
   * Drop item at position
   */
  dropItem(entity: GameEntity, itemId: string, position: Position): ItemDropResult {
    const item = this.removeItem(entity, itemId);
    
    if (!item) {
      return {
        success: false,
        item: null as any,
        entity,
        position,
        message: 'Item not found in inventory',
        reason: 'item-not-found'
      };
    }

    // Check if position is valid for dropping
    if (!this.dungeonManager.isWalkable(position)) {
      // Put back in inventory
      this.addItem(entity, item);
      return {
        success: false,
        item,
        entity,
        position,
        message: 'Cannot drop item here',
        reason: 'invalid-position'
      };
    }

    // Place item on ground
    const placed = this.dungeonManager.addEntity(item, position);
    
    if (placed) {
      const entityName = (entity as any).name || entity.id;
      return {
        success: true,
        item,
        entity,
        position,
        message: `${entityName} drops ${item.getDisplayName()}`
      };
    } else {
      // Put back in inventory if couldn't place
      this.addItem(entity, item);
      return {
        success: false,
        item,
        entity,
        position,
        message: 'Could not drop item',
        reason: 'place-failed'
      };
    }
  }

  /**
   * Add item to entity inventory
   */
  addItem(entity: GameEntity, item: ItemEntity): boolean {
    if (!this.hasInventorySupport(entity)) {
      return false;
    }

    if (this.isFull(entity)) {
      return false;
    }

    const inventory = this.getInventory(entity);
    inventory.push(item);
    return true;
  }

  /**
   * Remove item from entity inventory
   */
  removeItem(entity: GameEntity, itemId: string): ItemEntity | null {
    if (!this.hasInventorySupport(entity)) {
      return null;
    }

    const inventory = this.getInventory(entity);
    const index = inventory.findIndex(item => item.id === itemId);
    
    if (index !== -1) {
      return inventory.splice(index, 1)[0];
    }

    return null;
  }

  /**
   * Get all items in entity inventory
   */
  getItems(entity: GameEntity): ItemEntity[] {
    if (!this.hasInventorySupport(entity)) {
      return [];
    }

    return [...this.getInventory(entity)];
  }

  /**
   * Check if entity has specific item
   */
  hasItem(entity: GameEntity, itemId: string): boolean {
    const inventory = this.getInventory(entity);
    return inventory.some(item => item.id === itemId);
  }

  /**
   * Get item count in inventory
   */
  getItemCount(entity: GameEntity): number {
    return this.getInventory(entity).length;
  }

  /**
   * Get maximum inventory capacity
   */
  getMaxCapacity(entity: GameEntity): number {
    // Default capacity, could be modified by equipment/stats
    return 20;
  }

  /**
   * Check if inventory is full
   */
  isFull(entity: GameEntity): boolean {
    return this.getItemCount(entity) >= this.getMaxCapacity(entity);
  }

  /**
   * Check if entity has inventory support
   */
  private hasInventorySupport(entity: GameEntity): boolean {
    return 'inventory' in entity;
  }

  /**
   * Get entity inventory array
   */
  private getInventory(entity: GameEntity): ItemEntity[] {
    if (!this.hasInventorySupport(entity)) {
      return [];
    }
    
    return (entity as any).inventory as ItemEntity[];
  }

  /**
   * Create item from template
   */
  createItem(templateId: string, position: Position): ItemEntity | null {
    const template = this.itemTemplates.get(templateId);
    if (!template) {
      return null;
    }

    const item = new ItemEntity(
      `${templateId}-${Date.now()}`,
      template.name,
      template.itemType,
      position,
      template.identified,
      template.cursed
    );

    // Apply template properties
    if (template.effects) {
      for (const effect of template.effects) {
        item.addEffect(effect);
      }
    }

    if (template.equipmentStats) {
      item.setEquipmentStats(template.equipmentStats);
    }

    if (template.attributes) {
      item.setAttributes(template.attributes);
    }

    if (template.durability !== undefined) {
      item.setDurability(template.durability);
    }

    return item;
  }

  /**
   * Register item template
   */
  registerItemTemplate(template: ItemTemplate): void {
    this.itemTemplates.set(template.id, template);
  }

  /**
   * Get item template
   */
  getItemTemplate(templateId: string): ItemTemplate | undefined {
    return this.itemTemplates.get(templateId);
  }

  /**
   * Get all item template IDs
   */
  getItemTemplateIds(): string[] {
    return Array.from(this.itemTemplates.keys());
  }

  /**
   * Initialize default item templates
   */
  private initializeDefaultItems(): void {
    // Health Potion
    this.registerItemTemplate({
      id: 'health-potion',
      name: 'Health Potion',
      itemType: 'consumable',
      identified: false,
      cursed: false,
      effects: [
        {
          type: 'heal',
          value: 20,
          description: 'Restores 20 HP'
        }
      ]
    });

    // Bread
    this.registerItemTemplate({
      id: 'bread',
      name: 'Bread',
      itemType: 'consumable',
      identified: true,
      cursed: false,
      effects: [
        {
          type: 'restore-hunger',
          value: 30,
          description: 'Restores 30 hunger'
        }
      ]
    });

    // Antidote
    this.registerItemTemplate({
      id: 'antidote',
      name: 'Antidote',
      itemType: 'consumable',
      identified: false,
      cursed: false,
      effects: [
        {
          type: 'cure-status',
          statusType: 'poison',
          description: 'Cures poison'
        }
      ]
    });

    // Scroll of Identify
    this.registerItemTemplate({
      id: 'scroll-identify',
      name: 'Scroll of Identify',
      itemType: 'consumable',
      identified: false,
      cursed: false,
      effects: [
        {
          type: 'identify',
          description: 'Identifies all items in inventory'
        }
      ]
    });

    // Teleport Scroll
    this.registerItemTemplate({
      id: 'scroll-teleport',
      name: 'Scroll of Teleport',
      itemType: 'consumable',
      identified: false,
      cursed: false,
      effects: [
        {
          type: 'teleport',
          description: 'Teleports to random location'
        }
      ]
    });
  }
}

// Item template interface
export interface ItemTemplate {
  id: string;
  name: string;
  itemType: any;
  identified: boolean;
  cursed: boolean;
  effects?: any[];
  equipmentStats?: any;
  attributes?: any;
  durability?: number;
}