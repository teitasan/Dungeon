/**
 * Base GameEntity class and factory functions
 * Provides common functionality for all game entities
 */
/**
 * Base GameEntity implementation
 */
export class BaseGameEntity {
    id;
    position;
    components;
    stats;
    flags;
    constructor(id, position, stats, components = [], flags = {}) {
        this.id = id;
        this.position = position;
        this.stats = stats;
        this.components = components;
        this.flags = flags;
    }
    /**
     * Update entity position
     */
    setPosition(position) {
        this.position = position;
    }
    /**
     * Add a component to this entity
     */
    addComponent(component) {
        this.components.push(component);
    }
    /**
     * Remove a component by ID
     */
    removeComponent(componentId) {
        this.components = this.components.filter(c => c.id !== componentId);
    }
    /**
     * Get a component by ID
     */
    getComponent(componentId) {
        return this.components.find(c => c.id === componentId);
    }
    /**
     * Update entity stats
     */
    updateStats(newStats) {
        this.stats = { ...this.stats, ...newStats };
    }
    /**
     * Set a flag value
     */
    setFlag(key, value) {
        this.flags[key] = value;
    }
    /**
     * Get a flag value
     */
    getFlag(key) {
        return this.flags[key];
    }
}
/**
 * Create default character stats
 */
export function createDefaultCharacterStats(level = 1, baseHp = 20, baseAttack = 5, baseDefense = 3) {
    return {
        level,
        experience: 0,
        experienceValue: level * 10, // Default experience value when defeated
        hp: baseHp,
        maxHp: baseHp,
        attack: baseAttack,
        defense: baseDefense,
        evasionRate: 0.05 // 5% base evasion rate
    };
}
/**
 * Create default character attributes
 */
export function createDefaultCharacterAttributes(primaryAttribute = 'neutral') {
    return {
        primary: primaryAttribute,
        resistances: [],
        weaknesses: []
    };
}
/**
 * Calculate level-up stats based on growth rates
 */
export function calculateLevelUpStats(currentStats, growthRates) {
    const newLevel = currentStats.level + 1;
    const newMaxHp = Math.floor(currentStats.maxHp * growthRates.hp);
    const hpIncrease = newMaxHp - currentStats.maxHp;
    return {
        ...currentStats,
        level: newLevel,
        experienceValue: newLevel * 10, // Update experience value
        hp: currentStats.hp + hpIncrease, // Increase current HP by the same amount
        maxHp: newMaxHp,
        attack: Math.floor(currentStats.attack * growthRates.attack),
        defense: Math.floor(currentStats.defense * growthRates.defense)
    };
}
/**
 * Check if character has enough experience to level up
 */
export function canLevelUp(stats, experienceTable) {
    if (stats.level >= experienceTable.length) {
        return false; // Max level reached
    }
    const requiredExp = experienceTable[stats.level - 1]; // Array is 0-indexed, level is 1-indexed
    return stats.experience >= requiredExp;
}
/**
 * Add experience to character and handle level up
 */
export function addExperience(stats, amount, experienceTable, growthRates) {
    let newStats = { ...stats, experience: stats.experience + amount };
    let leveledUp = false;
    // Check for level up
    while (canLevelUp(newStats, experienceTable)) {
        const requiredExp = experienceTable[newStats.level - 1];
        const remainingExp = newStats.experience - requiredExp;
        newStats = calculateLevelUpStats(newStats, growthRates);
        newStats.experience = remainingExp; // Set remaining experience after level up
        leveledUp = true;
    }
    return { newStats, leveledUp };
}
//# sourceMappingURL=GameEntity.js.map