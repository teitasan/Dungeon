/**
 * Inventory Component - represents entity's item storage
 * Pure data structure, no logic
 */

import { Component } from '../../core/Component.js';

/**
 * Item data structure for inventory
 */
export interface InventoryItem {
  readonly id: string;
  readonly templateId: string;
  readonly name: string;
  readonly itemType: string;
  readonly identified: boolean;
  readonly cursed: boolean;
  readonly quantity: number;
}

/**
 * Inventory component data
 */
export interface InventoryComponent extends Component {
  readonly type: 'inventory';
  readonly items: InventoryItem[];
  readonly maxCapacity: number;
  readonly currentCapacity: number;
}

/**
 * Inventory component factory
 */
export class InventoryComponentFactory {
  /**
   * Create an inventory component
   */
  static create(maxCapacity: number = 20): InventoryComponent {
    return {
      id: `inventory_${Date.now()}_${Math.random()}`,
      type: 'inventory',
      items: [],
      maxCapacity: Math.max(1, maxCapacity),
      currentCapacity: 0
    };
  }

  /**
   * Create an inventory component with items
   */
  static createWithItems(items: InventoryItem[], maxCapacity: number = 20): InventoryComponent {
    return {
      id: `inventory_${Date.now()}_${Math.random()}`,
      type: 'inventory',
      items: [...items],
      maxCapacity: Math.max(1, maxCapacity),
      currentCapacity: items.length
    };
  }

  /**
   * Create a player inventory component
   */
  static createPlayer(): InventoryComponent {
    return this.create(20); // Player starts with 20 item capacity
  }

  /**
   * Create a monster inventory component (for drops)
   */
  static createMonster(): InventoryComponent {
    return this.create(5); // Monsters have limited inventory
  }
}

/**
 * Inventory utilities
 */
export class InventoryUtils {
  /**
   * Check if inventory is full
   */
  static isFull(inventory: InventoryComponent): boolean {
    return inventory.currentCapacity >= inventory.maxCapacity;
  }

  /**
   * Check if inventory is empty
   */
  static isEmpty(inventory: InventoryComponent): boolean {
    return inventory.currentCapacity === 0;
  }

  /**
   * Get available space in inventory
   */
  static getAvailableSpace(inventory: InventoryComponent): number {
    return Math.max(0, inventory.maxCapacity - inventory.currentCapacity);
  }

  /**
   * Check if inventory contains specific item
   */
  static hasItem(inventory: InventoryComponent, itemId: string): boolean {
    return inventory.items.some(item => item.id === itemId);
  }

  /**
   * Check if inventory contains item by template ID
   */
  static hasItemByTemplate(inventory: InventoryComponent, templateId: string): boolean {
    return inventory.items.some(item => item.templateId === templateId);
  }

  /**
   * Get item by ID
   */
  static getItem(inventory: InventoryComponent, itemId: string): InventoryItem | undefined {
    return inventory.items.find(item => item.id === itemId);
  }

  /**
   * Get items by template ID
   */
  static getItemsByTemplate(inventory: InventoryComponent, templateId: string): InventoryItem[] {
    return inventory.items.filter(item => item.templateId === templateId);
  }

  /**
   * Get items by type
   */
  static getItemsByType(inventory: InventoryComponent, itemType: string): InventoryItem[] {
    return inventory.items.filter(item => item.itemType === itemType);
  }

  /**
   * Create new inventory with item added
   */
  static addItem(inventory: InventoryComponent, item: InventoryItem): InventoryComponent | null {
    if (InventoryUtils.isFull(inventory)) {
      return null; // Cannot add item, inventory is full
    }

    const newItems = [...inventory.items, item];
    return InventoryComponentFactory.createWithItems(newItems, inventory.maxCapacity);
  }

  /**
   * Create new inventory with item removed
   */
  static removeItem(inventory: InventoryComponent, itemId: string): {
    inventory: InventoryComponent;
    removedItem: InventoryItem | null;
  } {
    const itemIndex = inventory.items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      return {
        inventory,
        removedItem: null
      };
    }

    const removedItem = inventory.items[itemIndex];
    const newItems = inventory.items.filter((_, index) => index !== itemIndex);
    const newInventory = InventoryComponentFactory.createWithItems(newItems, inventory.maxCapacity);

    return {
      inventory: newInventory,
      removedItem
    };
  }

  /**
   * Create new inventory with item quantity updated
   */
  static updateItemQuantity(
    inventory: InventoryComponent, 
    itemId: string, 
    newQuantity: number
  ): InventoryComponent | null {
    const itemIndex = inventory.items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      return null;
    }

    const newItems = [...inventory.items];
    
    if (newQuantity <= 0) {
      // Remove item if quantity is 0 or less
      newItems.splice(itemIndex, 1);
    } else {
      // Update quantity
      newItems[itemIndex] = {
        ...newItems[itemIndex],
        quantity: newQuantity
      };
    }

    return InventoryComponentFactory.createWithItems(newItems, inventory.maxCapacity);
  }

  /**
   * Get total quantity of all items
   */
  static getTotalQuantity(inventory: InventoryComponent): number {
    return inventory.items.reduce((total, item) => total + item.quantity, 0);
  }

  /**
   * Get inventory usage percentage
   */
  static getUsagePercentage(inventory: InventoryComponent): number {
    return Math.round((inventory.currentCapacity / inventory.maxCapacity) * 100);
  }

  /**
   * Filter items by condition
   */
  static filterItems(
    inventory: InventoryComponent, 
    predicate: (item: InventoryItem) => boolean
  ): InventoryItem[] {
    return inventory.items.filter(predicate);
  }

  /**
   * Sort items by criteria
   */
  static sortItems(
    inventory: InventoryComponent, 
    compareFn: (a: InventoryItem, b: InventoryItem) => number
  ): InventoryItem[] {
    return [...inventory.items].sort(compareFn);
  }
}
