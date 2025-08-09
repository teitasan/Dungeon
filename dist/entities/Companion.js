/**
 * Companion entity implementation
 */
import { BaseGameEntity, createDefaultCharacterStats, createDefaultCharacterAttributes } from './GameEntity';
export class CompanionEntity extends BaseGameEntity {
    name;
    companionType;
    stats;
    attributes;
    aiType;
    behaviorMode;
    equipment;
    statusEffects;
    constructor(id, name, companionType, position, stats, attributes, aiType = 'companion-follow', components = [], flags = {}) {
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
    setBehaviorMode(mode) {
        this.behaviorMode = mode;
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
        // Equip new item (companions don't have inventory management in this basic implementation)
        this.equipment[equipSlot] = item;
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
    applyEquipmentBonuses() {
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
     * Check if companion has a specific status effect
     */
    hasStatusEffect(type) {
        return this.statusEffects.some(effect => effect.type === type);
    }
    /**
     * Update AI type
     */
    setAIType(aiType) {
        this.aiType = aiType;
    }
    /**
     * Check if companion is following player
     */
    isFollowing() {
        return this.behaviorMode === 'follow';
    }
    /**
     * Check if companion is in combat mode
     */
    isInCombat() {
        return this.behaviorMode === 'attack';
    }
    /**
     * Get experience value based on level (companions can be defeated)
     */
    getExperienceValue() {
        return this.stats.experienceValue;
    }
}
//# sourceMappingURL=Companion.js.map