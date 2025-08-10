/**
 * Item entity implementation
 */
import { BaseGameEntity } from './GameEntity.js';
export class ItemEntity extends BaseGameEntity {
    name;
    itemType;
    identified;
    cursed;
    durability;
    effects;
    attributes;
    equipmentStats;
    constructor(id, name, itemType, position, identified = false, cursed = false, components = [], flags = {}) {
        // Items have minimal stats - mainly for consistency with GameEntity interface
        const itemStats = {
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
    }
    /**
     * Add an effect to this item
     */
    addEffect(effect) {
        this.effects.push(effect);
    }
    /**
     * Remove an effect from this item
     */
    removeEffect(effectType) {
        this.effects = this.effects.filter(effect => effect.type !== effectType);
    }
    /**
     * Check if item has a specific effect
     */
    hasEffect(effectType) {
        return this.effects.some(effect => effect.type === effectType);
    }
    /**
     * Get effect by type
     */
    getEffect(effectType) {
        return this.effects.find(effect => effect.type === effectType);
    }
    /**
     * Set equipment stats for equippable items
     */
    setEquipmentStats(stats) {
        this.equipmentStats = stats;
    }
    /**
     * Set item attributes (for weapons and armor)
     */
    setAttributes(attributes) {
        this.attributes = attributes;
    }
    /**
     * Set durability for items that can break
     */
    setDurability(durability) {
        this.durability = durability;
    }
    /**
     * Reduce durability (returns true if item breaks)
     */
    reduceDurability(amount = 1) {
        if (this.durability === undefined) {
            return false; // Item doesn't have durability
        }
        this.durability = Math.max(0, this.durability - amount);
        return this.durability === 0;
    }
    /**
     * Identify the item
     */
    identify() {
        this.identified = true;
    }
    /**
     * Check if item is equippable
     */
    isEquippable() {
        return ['weapon-melee', 'weapon-ranged', 'armor', 'accessory'].includes(this.itemType);
    }
    /**
     * Check if item is consumable
     */
    isConsumable() {
        return this.itemType === 'consumable';
    }
    /**
     * Check if item is a weapon
     */
    isWeapon() {
        return this.itemType === 'weapon-melee' || this.itemType === 'weapon-ranged';
    }
    /**
     * Check if item is armor
     */
    isArmor() {
        return this.itemType === 'armor';
    }
    /**
     * Check if item is an accessory
     */
    isAccessory() {
        return this.itemType === 'accessory';
    }
    /**
     * Get display name (may be different if unidentified)
     */
    getDisplayName() {
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
    use() {
        if (!this.isConsumable()) {
            return [];
        }
        // Identify item when used
        this.identify();
        return this.effects;
    }
}
//# sourceMappingURL=Item.js.map