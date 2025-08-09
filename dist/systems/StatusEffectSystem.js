/**
 * Status effect system for handling poison, confusion, paralysis, and bind
 */
export class StatusEffectSystem {
    statusConfigs;
    rng;
    constructor() {
        this.statusConfigs = new Map();
        this.rng = Math.random;
        this.initializeDefaultStatusEffects();
    }
    /**
     * Apply status effect to entity
     */
    applyStatusEffect(entity, effectType, intensity = 1, source) {
        const config = this.statusConfigs.get(effectType);
        if (!config) {
            console.warn(`Unknown status effect: ${effectType}`);
            return false;
        }
        // Check if entity can have status effects
        if (!this.hasStatusEffectSupport(entity)) {
            return false;
        }
        const statusEffects = this.getEntityStatusEffects(entity);
        // Check if effect is already applied
        const existingEffect = statusEffects.find(effect => effect.type === effectType);
        if (existingEffect) {
            if (config.stackable) {
                // Increase intensity or reset duration
                existingEffect.intensity = (existingEffect.intensity || 1) + intensity;
                existingEffect.turnsElapsed = 0;
            }
            else {
                // Reset duration
                existingEffect.turnsElapsed = 0;
            }
        }
        else {
            // Add new status effect
            const newEffect = {
                type: effectType,
                turnsElapsed: 0,
                intensity,
                source
            };
            statusEffects.push(newEffect);
        }
        return true;
    }
    /**
     * Remove status effect from entity
     */
    removeStatusEffect(entity, effectType) {
        if (!this.hasStatusEffectSupport(entity)) {
            return false;
        }
        const statusEffects = this.getEntityStatusEffects(entity);
        const index = statusEffects.findIndex(effect => effect.type === effectType);
        if (index !== -1) {
            statusEffects.splice(index, 1);
            return true;
        }
        return false;
    }
    /**
     * Process status effects for entity at specific timing
     */
    processStatusEffects(entity, timing) {
        if (!this.hasStatusEffectSupport(entity)) {
            return [];
        }
        const statusEffects = this.getEntityStatusEffects(entity);
        const results = [];
        // Process each status effect
        for (let i = statusEffects.length - 1; i >= 0; i--) {
            const effect = statusEffects[i];
            const config = this.statusConfigs.get(effect.type);
            if (!config)
                continue;
            const result = this.processStatusEffect(entity, effect, config, timing);
            results.push(result);
            // Remove effect if recovered or expired
            if (result.recovered || result.expired) {
                statusEffects.splice(i, 1);
            }
        }
        return results;
    }
    /**
     * Process individual status effect
     */
    processStatusEffect(entity, effect, config, timing) {
        const actions = [];
        let recovered = false;
        let expired = false;
        // Execute actions for this timing
        for (const action of config.effects) {
            if (action.timing === timing) {
                const actionResult = this.executeStatusAction(entity, effect, action);
                actions.push(actionResult);
            }
        }
        // Check for recovery at turn end
        if (timing === 'turn-end') {
            recovered = this.checkRecovery(effect, config);
            effect.turnsElapsed++;
            // Check for expiration
            if (effect.turnsElapsed >= config.maxDuration) {
                expired = true;
            }
        }
        return {
            effectId: effect.type,
            entity,
            actions,
            recovered,
            expired
        };
    }
    /**
     * Execute status effect action
     */
    executeStatusAction(entity, effect, action) {
        const intensity = effect.intensity || 1;
        let success = true;
        let value = 0;
        let message = '';
        // Check chance if specified
        if (action.chance && this.rng() > action.chance) {
            return {
                type: action.type,
                success: false,
                message: `${action.description} failed to trigger`
            };
        }
        switch (action.type) {
            case 'damage':
                value = (action.value || 1) * intensity;
                const stats = entity.stats;
                const actualDamage = Math.min(value, stats.hp);
                stats.hp = Math.max(0, stats.hp - value);
                message = `${entity.id} takes ${actualDamage} damage from ${effect.type}`;
                break;
            case 'heal':
                value = (action.value || 1) * intensity;
                const healStats = entity.stats;
                const actualHeal = Math.min(value, healStats.maxHp - healStats.hp);
                healStats.hp = Math.min(healStats.maxHp, healStats.hp + value);
                message = `${entity.id} recovers ${actualHeal} HP from ${effect.type}`;
                break;
            case 'prevent-action':
                // This would be handled by the action system
                message = `${entity.id} is unable to act due to ${effect.type}`;
                break;
            case 'random-action':
                // This would be handled by the action system
                message = `${entity.id} acts randomly due to ${effect.type}`;
                break;
            case 'stat-modifier':
                // Temporary stat modifications
                message = `${entity.id}'s stats are affected by ${effect.type}`;
                break;
            case 'movement-restriction':
                // This would be handled by the movement system
                message = `${entity.id}'s movement is restricted by ${effect.type}`;
                break;
            default:
                success = false;
                message = `Unknown status action: ${action.type}`;
        }
        return {
            type: action.type,
            success,
            value,
            message
        };
    }
    /**
     * Check if status effect recovers
     */
    checkRecovery(effect, config) {
        const { base, increase, max } = config.recoveryChance;
        // Calculate recovery chance based on turns elapsed
        const recoveryChance = Math.min(max, base + (increase * effect.turnsElapsed));
        return this.rng() < recoveryChance;
    }
    /**
     * Check if entity has status effect support
     */
    hasStatusEffectSupport(entity) {
        return 'statusEffects' in entity;
    }
    /**
     * Get entity's status effects array
     */
    getEntityStatusEffects(entity) {
        if (!this.hasStatusEffectSupport(entity)) {
            return [];
        }
        return entity.statusEffects;
    }
    /**
     * Get all status effects on entity
     */
    getStatusEffects(entity) {
        return [...this.getEntityStatusEffects(entity)];
    }
    /**
     * Check if entity has specific status effect
     */
    hasStatusEffect(entity, effectType) {
        const statusEffects = this.getEntityStatusEffects(entity);
        return statusEffects.some(effect => effect.type === effectType);
    }
    /**
     * Get status effect by type
     */
    getStatusEffect(entity, effectType) {
        const statusEffects = this.getEntityStatusEffects(entity);
        return statusEffects.find(effect => effect.type === effectType);
    }
    /**
     * Clear all status effects from entity
     */
    clearAllStatusEffects(entity) {
        if (!this.hasStatusEffectSupport(entity)) {
            return;
        }
        const statusEffects = this.getEntityStatusEffects(entity);
        statusEffects.length = 0;
    }
    /**
     * Register status effect configuration
     */
    registerStatusEffect(config) {
        this.statusConfigs.set(config.id, config);
    }
    /**
     * Get status effect configuration
     */
    getStatusEffectConfig(effectType) {
        return this.statusConfigs.get(effectType);
    }
    /**
     * Get all registered status effect types
     */
    getRegisteredStatusEffects() {
        return Array.from(this.statusConfigs.keys());
    }
    /**
     * Set random number generator (for testing)
     */
    setRNG(rng) {
        this.rng = rng;
    }
    /**
     * Initialize default status effects
     */
    initializeDefaultStatusEffects() {
        // Poison
        this.registerStatusEffect({
            id: 'poison',
            name: 'Poison',
            description: 'Takes damage each turn',
            maxDuration: 10,
            stackable: true,
            recoveryChance: {
                base: 0.1,
                increase: 0.05,
                max: 0.8
            },
            effects: [
                {
                    type: 'damage',
                    timing: 'turn-end',
                    value: 2,
                    description: 'Poison damage'
                }
            ]
        });
        // Confusion
        this.registerStatusEffect({
            id: 'confusion',
            name: 'Confusion',
            description: 'May act randomly',
            maxDuration: 8,
            stackable: false,
            recoveryChance: {
                base: 0.15,
                increase: 0.1,
                max: 0.9
            },
            effects: [
                {
                    type: 'random-action',
                    timing: 'before-action',
                    chance: 0.5,
                    description: 'Confused action'
                }
            ]
        });
        // Paralysis
        this.registerStatusEffect({
            id: 'paralysis',
            name: 'Paralysis',
            description: 'May be unable to act',
            maxDuration: 6,
            stackable: false,
            recoveryChance: {
                base: 0.2,
                increase: 0.15,
                max: 0.95
            },
            effects: [
                {
                    type: 'prevent-action',
                    timing: 'before-action',
                    chance: 0.25,
                    description: 'Paralyzed'
                }
            ]
        });
        // Bind
        this.registerStatusEffect({
            id: 'bind',
            name: 'Bind',
            description: 'Cannot move',
            maxDuration: 5,
            stackable: false,
            recoveryChance: {
                base: 0.25,
                increase: 0.2,
                max: 1.0
            },
            effects: [
                {
                    type: 'movement-restriction',
                    timing: 'before-action',
                    description: 'Movement blocked'
                }
            ]
        });
    }
}
//# sourceMappingURL=StatusEffectSystem.js.map