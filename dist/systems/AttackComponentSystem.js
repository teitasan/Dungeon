/**
 * Attack component system for handling different attack patterns and ranges
 */
export class AttackComponentSystem {
    dungeonManager;
    constructor(dungeonManager) {
        this.dungeonManager = dungeonManager;
    }
    /**
     * Calculate attack range positions
     */
    calculateAttackRange(attacker, rangeConfig, direction) {
        const attackerPos = attacker.position;
        const positions = [];
        switch (rangeConfig.type) {
            case 'adjacent':
                positions.push(...this.getAdjacentPositions(attackerPos, rangeConfig.range));
                break;
            case 'line':
                if (direction) {
                    positions.push(...this.getLinePositions(attackerPos, direction, rangeConfig.range));
                }
                break;
            case 'area':
                positions.push(...this.getAreaPositions(attackerPos, rangeConfig.range));
                break;
            case 'custom':
                if (rangeConfig.pattern) {
                    positions.push(...this.getCustomPatternPositions(attackerPos, rangeConfig.pattern));
                }
                break;
        }
        // Filter by line of sight if required
        if (rangeConfig.requiresLineOfSight) {
            return positions.filter(pos => this.hasLineOfSight(attackerPos, pos));
        }
        return positions;
    }
    /**
     * Get valid targets within attack range
     */
    getValidTargets(attacker, rangeConfig, targetConfig, direction) {
        const attackRange = this.calculateAttackRange(attacker, rangeConfig, direction);
        const allTargets = [];
        // Collect all entities in range
        for (const pos of attackRange) {
            const entitiesAtPos = this.dungeonManager.getEntitiesAt(pos);
            for (const entity of entitiesAtPos) {
                if (this.isValidTarget(attacker, entity, targetConfig)) {
                    allTargets.push(entity);
                }
            }
        }
        if (allTargets.length === 0) {
            return {
                validTargets: [],
                targetPositions: [],
                attackPattern: attackRange,
                canAttack: false,
                reason: 'No valid targets in range'
            };
        }
        // Select targets based on configuration
        const selectedTargets = this.selectTargets(attacker, allTargets, targetConfig);
        return {
            validTargets: selectedTargets,
            targetPositions: selectedTargets.map(t => t.position),
            attackPattern: attackRange,
            canAttack: selectedTargets.length > 0
        };
    }
    /**
     * Execute attack with components
     */
    executeAttack(attacker, rangeConfig, countConfig, targetConfig, direction) {
        const targetResult = this.getValidTargets(attacker, rangeConfig, targetConfig, direction);
        if (!targetResult.canAttack) {
            return {
                success: false,
                attacker,
                targets: [],
                totalDamage: 0,
                message: targetResult.reason || 'Attack failed'
            };
        }
        const attackResults = [];
        let totalDamage = 0;
        // Execute attacks based on count configuration
        for (let attackIndex = 0; attackIndex < countConfig.count; attackIndex++) {
            let targetsForThisAttack = targetResult.validTargets;
            // If consecutive only, attack same targets
            if (countConfig.consecutiveOnly && attackResults.length > 0) {
                targetsForThisAttack = attackResults.map(r => r.target);
            }
            // If not multi-target, select one target per attack
            if (!countConfig.multiTarget && targetsForThisAttack.length > 1) {
                targetsForThisAttack = [targetsForThisAttack[0]];
            }
            // Execute attack on each target
            for (const target of targetsForThisAttack) {
                const attackResult = this.executeIndividualAttack(attacker, target);
                // Find existing result for this target or create new one
                let targetResult = attackResults.find(r => r.target === target);
                if (!targetResult) {
                    targetResult = {
                        target,
                        position: target.position,
                        hit: false,
                        damage: 0,
                        effects: []
                    };
                    attackResults.push(targetResult);
                }
                // Accumulate results
                if (attackResult.hit) {
                    targetResult.hit = true;
                    targetResult.damage += attackResult.damage;
                    targetResult.effects.push(...attackResult.effects);
                    totalDamage += attackResult.damage;
                }
            }
        }
        const message = this.generateAttackMessage(attacker, attackResults, countConfig.count);
        return {
            success: attackResults.some(r => r.hit),
            attacker,
            targets: attackResults,
            totalDamage,
            message
        };
    }
    /**
     * Execute individual attack between two entities
     */
    executeIndividualAttack(attacker, target) {
        // This would integrate with the CombatSystem
        // For now, simplified implementation
        const attackerStats = attacker.stats;
        const targetStats = target.stats;
        if (!attackerStats || !targetStats) {
            return { hit: false, damage: 0, effects: [] };
        }
        // Simple damage calculation
        const baseDamage = Math.max(1, attackerStats.attack - targetStats.defense);
        const actualDamage = Math.min(baseDamage, targetStats.hp);
        targetStats.hp = Math.max(0, targetStats.hp - actualDamage);
        return {
            hit: true,
            damage: actualDamage,
            effects: targetStats.hp <= 0 ? ['defeated'] : []
        };
    }
    /**
     * Get adjacent positions within range
     */
    getAdjacentPositions(center, range) {
        const positions = [];
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (dx === 0 && dy === 0)
                    continue; // Skip center
                // Check Manhattan distance
                const distance = Math.abs(dx) + Math.abs(dy);
                if (distance > range)
                    continue;
                const pos = { x: center.x + dx, y: center.y + dy };
                if (this.isValidPosition(pos)) {
                    positions.push(pos);
                }
            }
        }
        return positions;
    }
    /**
     * Get line positions in direction
     */
    getLinePositions(start, direction, range) {
        const positions = [];
        // Normalize direction
        const dx = Math.sign(direction.x);
        const dy = Math.sign(direction.y);
        for (let i = 1; i <= range; i++) {
            const pos = {
                x: start.x + dx * i,
                y: start.y + dy * i
            };
            if (this.isValidPosition(pos)) {
                positions.push(pos);
            }
            else {
                break; // Stop at walls/boundaries
            }
        }
        return positions;
    }
    /**
     * Get area positions (circle/square around center)
     */
    getAreaPositions(center, range) {
        const positions = [];
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const pos = { x: center.x + dx, y: center.y + dy };
                const distance = Math.abs(dx) + Math.abs(dy); // Manhattan distance
                if (distance <= range && this.isValidPosition(pos)) {
                    positions.push(pos);
                }
            }
        }
        return positions;
    }
    /**
     * Get custom pattern positions
     */
    getCustomPatternPositions(center, pattern) {
        const positions = [];
        for (const offset of pattern) {
            const pos = {
                x: center.x + offset.x,
                y: center.y + offset.y
            };
            if (this.isValidPosition(pos)) {
                positions.push(pos);
            }
        }
        return positions;
    }
    /**
     * Check if position is valid (within bounds)
     */
    isValidPosition(position) {
        return this.dungeonManager.getCellAt(position) !== null;
    }
    /**
     * Check line of sight between two positions
     */
    hasLineOfSight(from, to) {
        // Simple line of sight check - no walls between positions
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        const steps = Math.max(dx, dy);
        if (steps === 0)
            return true;
        const stepX = (to.x - from.x) / steps;
        const stepY = (to.y - from.y) / steps;
        for (let i = 1; i < steps; i++) {
            const checkPos = {
                x: Math.round(from.x + stepX * i),
                y: Math.round(from.y + stepY * i)
            };
            if (!this.dungeonManager.isTransparent(checkPos)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Check if entity is valid target
     */
    isValidTarget(attacker, target, config) {
        // Can't attack self
        if (attacker === target)
            return false;
        // Check if target is alive
        const targetStats = target.stats;
        if (targetStats && targetStats.hp <= 0)
            return false;
        // Check friendly fire
        if (!config.friendlyFire) {
            // Simple check - same type entities don't attack each other
            const attackerType = attacker.constructor.name;
            const targetType = target.constructor.name;
            if (attackerType === targetType)
                return false;
            // Players and companions don't attack each other
            if ((attackerType === 'PlayerEntity' && targetType === 'CompanionEntity') ||
                (attackerType === 'CompanionEntity' && targetType === 'PlayerEntity')) {
                return false;
            }
        }
        return true;
    }
    /**
     * Select targets based on configuration
     */
    selectTargets(attacker, targets, config) {
        if (targets.length === 0)
            return [];
        let selectedTargets = [...targets];
        // Limit number of targets
        if (config.maxTargets > 0 && selectedTargets.length > config.maxTargets) {
            switch (config.targetSelection) {
                case 'closest':
                    selectedTargets.sort((a, b) => this.getDistance(attacker.position, a.position) -
                        this.getDistance(attacker.position, b.position));
                    break;
                case 'furthest':
                    selectedTargets.sort((a, b) => this.getDistance(attacker.position, b.position) -
                        this.getDistance(attacker.position, a.position));
                    break;
                case 'random':
                    selectedTargets = this.shuffleArray(selectedTargets);
                    break;
                case 'manual':
                    // Manual selection would be handled by UI
                    break;
            }
            selectedTargets = selectedTargets.slice(0, config.maxTargets);
        }
        return selectedTargets;
    }
    /**
     * Calculate distance between positions
     */
    getDistance(pos1, pos2) {
        return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
    }
    /**
     * Shuffle array randomly
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    /**
     * Generate attack message
     */
    generateAttackMessage(attacker, results, attackCount) {
        const attackerName = attacker.name || attacker.id;
        const hitTargets = results.filter(r => r.hit);
        if (hitTargets.length === 0) {
            return `${attackerName}'s attack misses`;
        }
        if (hitTargets.length === 1) {
            const target = hitTargets[0];
            const targetName = target.target.name || target.target.id;
            const attackText = attackCount > 1 ? `attacks ${attackCount} times` : 'attacks';
            return `${attackerName} ${attackText} ${targetName} for ${target.damage} damage`;
        }
        const totalDamage = hitTargets.reduce((sum, r) => sum + r.damage, 0);
        return `${attackerName} attacks ${hitTargets.length} targets for ${totalDamage} total damage`;
    }
    /**
     * Create default attack range configurations
     */
    static createAdjacentRange(range = 1) {
        return {
            type: 'adjacent',
            range,
            requiresLineOfSight: false,
            piercing: false
        };
    }
    static createLineRange(range, requiresLineOfSight = true) {
        return {
            type: 'line',
            range,
            requiresLineOfSight,
            piercing: false
        };
    }
    static createAreaRange(range) {
        return {
            type: 'area',
            range,
            requiresLineOfSight: false,
            piercing: true
        };
    }
    static createCustomRange(pattern, requiresLineOfSight = false) {
        return {
            type: 'custom',
            range: 0,
            pattern,
            requiresLineOfSight,
            piercing: false
        };
    }
    /**
     * Create default attack count configurations
     */
    static createSingleAttack() {
        return {
            count: 1,
            multiTarget: false,
            consecutiveOnly: false
        };
    }
    static createMultiAttack(count, multiTarget = false) {
        return {
            count,
            multiTarget,
            consecutiveOnly: !multiTarget
        };
    }
    /**
     * Create default attack target configurations
     */
    static createSingleTarget() {
        return {
            targetType: 'single',
            maxTargets: 1,
            targetSelection: 'closest',
            friendlyFire: false
        };
    }
    static createMultiTarget(maxTargets, selection = 'closest') {
        return {
            targetType: 'multiple',
            maxTargets,
            targetSelection: selection,
            friendlyFire: false
        };
    }
    static createAllTargets() {
        return {
            targetType: 'all-in-range',
            maxTargets: 0, // No limit
            targetSelection: 'closest',
            friendlyFire: false
        };
    }
}
//# sourceMappingURL=AttackComponentSystem.js.map