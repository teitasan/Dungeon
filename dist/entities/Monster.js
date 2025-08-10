/**
 * Monster entity implementation
 */
import { BaseGameEntity, createDefaultCharacterStats, createDefaultCharacterAttributes } from './GameEntity.js';
export class MonsterEntity extends BaseGameEntity {
    name;
    monsterType;
    stats;
    attributes;
    aiType;
    dropTable;
    spawnWeight;
    spawnConditions;
    statusEffects;
    constructor(id, name, monsterType, position, stats, attributes, aiType = 'basic-hostile', components = [], flags = {}) {
        const monsterStats = stats || createDefaultCharacterStats(1, 15, 6, 2); // Monsters have varied stats
        super(id, position, monsterStats, components, flags);
        this.name = name;
        this.monsterType = monsterType;
        this.stats = monsterStats;
        this.attributes = attributes || createDefaultCharacterAttributes('neutral');
        this.aiType = aiType;
        this.dropTable = [];
        this.spawnWeight = 1.0; // Default spawn weight
        this.spawnConditions = [];
        this.statusEffects = [];
    }
    /**
     * Add drop table entry
     */
    addDropTableEntry(entry) {
        this.dropTable.push(entry);
    }
    /**
     * Remove drop table entry
     */
    removeDropTableEntry(itemId) {
        this.dropTable = this.dropTable.filter(entry => entry.itemId !== itemId);
    }
    /**
     * Get total drop weight for probability calculations
     */
    getTotalDropWeight() {
        return this.dropTable.reduce((total, entry) => total + entry.weight, 0);
    }
    /**
     * Add spawn condition
     */
    addSpawnCondition(condition) {
        this.spawnConditions.push(condition);
    }
    /**
     * Check if monster can spawn based on conditions
     */
    canSpawn(context) {
        // TODO: Implement spawn condition checking in future tasks
        return this.spawnConditions.every(condition => {
            // Placeholder - actual implementation depends on condition types
            return true;
        });
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
     * Check if monster has a specific status effect
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
     * Check if monster is hostile
     */
    isHostile() {
        return this.aiType.includes('hostile');
    }
    /**
     * Get experience value based on level
     */
    getExperienceValue() {
        return this.stats.experienceValue;
    }
}
//# sourceMappingURL=Monster.js.map