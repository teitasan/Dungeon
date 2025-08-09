/**
 * Player entity implementation
 */
import { BaseGameEntity, createDefaultCharacterStats, createDefaultCharacterAttributes } from './GameEntity';
export class PlayerEntity extends BaseGameEntity {
    name;
    stats;
    attributes;
    hunger;
    maxHunger;
    inventory;
    equipment;
    statusEffects;
    constructor(id, name, position, stats, attributes, components = [], flags = {}) {
        const playerStats = stats || createDefaultCharacterStats(1, 30, 8, 5); // Player starts with better stats
        super(id, position, playerStats, components, flags);
        this.name = name;
        this.stats = playerStats;
        this.attributes = attributes || createDefaultCharacterAttributes('neutral');
        this.hunger = 100; // Start with full hunger
        this.maxHunger = 100;
        this.inventory = [];
        this.equipment = {};
        this.statusEffects = [];
    }
    /**
     * Add item to inventory
     */
    addToInventory(item) {
        // TODO: Check inventory limits in future tasks
        this.inventory.push(item);
        return true;
    }
    /**
     * Remove item from inventory
     */
    removeFromInventory(itemId) {
        const index = this.inventory.findIndex(item => item.id === itemId);
        if (index !== -1) {
            return this.inventory.splice(index, 1)[0];
        }
        return undefined;
    }
    /**
     * Equip an item
     */
    equipItem(item) {
        if (!item.equipmentStats) {
            return false; // Item is not equippable
        }
        let equipSlot;
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
        // Unequip current item if any
        if (this.equipment[equipSlot]) {
            this.addToInventory(this.equipment[equipSlot]);
        }
        // Equip new item
        this.equipment[equipSlot] = item;
        this.removeFromInventory(item.id);
        // Apply equipment bonuses
        this.applyEquipmentBonuses();
        return true;
    }
    /**
     * Unequip an item
     */
    unequipItem(slot) {
        const item = this.equipment[slot];
        if (!item) {
            return false;
        }
        // Check if item is cursed
        if (item.cursed) {
            return false; // Cannot unequip cursed items
        }
        this.equipment[slot] = undefined;
        this.addToInventory(item);
        // Recalculate equipment bonuses
        this.applyEquipmentBonuses();
        return true;
    }
    /**
     * Apply equipment bonuses to stats
     */
    applyEquipmentBonuses() {
        // Reset to base stats first (this is simplified - in a real implementation,
        // we'd need to track base stats separately)
        let totalAttackBonus = 0;
        let totalDefenseBonus = 0;
        // Calculate bonuses from all equipped items
        Object.values(this.equipment).forEach(item => {
            if (item?.equipmentStats) {
                totalAttackBonus += item.equipmentStats.attackBonus || 0;
                totalDefenseBonus += item.equipmentStats.defenseBonus || 0;
            }
        });
        // Apply bonuses (this is simplified - real implementation would need base stat tracking)
        this.stats.attack += totalAttackBonus;
        this.stats.defense += totalDefenseBonus;
    }
    /**
     * Add status effect
     */
    addStatusEffect(effect) {
        this.statusEffects.push(effect);
    }
    /**
     * Remove status effect
     */
    removeStatusEffect(type) {
        this.statusEffects = this.statusEffects.filter(effect => effect.type !== type);
    }
    /**
     * Check if player has a specific status effect
     */
    hasStatusEffect(type) {
        return this.statusEffects.some(effect => effect.type === type);
    }
    /**
     * Update hunger level
     */
    updateHunger(amount) {
        this.hunger = Math.max(0, Math.min(this.maxHunger, this.hunger + amount));
    }
    /**
     * Check if player is hungry (hunger at minimum)
     */
    isHungry() {
        return this.hunger <= 0;
    }
}
//# sourceMappingURL=Player.js.map