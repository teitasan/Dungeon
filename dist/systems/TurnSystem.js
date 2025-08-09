/**
 * Turn management system
 */
export class TurnSystem {
    turnManager;
    turnListeners;
    constructor() {
        this.turnManager = {
            currentTurn: 1,
            turnOrder: [],
            currentEntityIndex: 0,
            turnPhase: 'player-action'
        };
        this.turnListeners = new Map();
    }
    /**
     * Initialize turn system with entities
     */
    initializeTurnOrder(entities) {
        this.turnManager.turnOrder = [...entities];
        this.turnManager.currentEntityIndex = 0;
        this.turnManager.turnPhase = 'player-action';
        // Sort by initiative/speed if needed
        this.sortTurnOrder();
    }
    /**
     * Add entity to turn order
     */
    addEntity(entity) {
        if (!this.turnManager.turnOrder.includes(entity)) {
            this.turnManager.turnOrder.push(entity);
            this.sortTurnOrder();
        }
    }
    /**
     * Remove entity from turn order
     */
    removeEntity(entity) {
        const index = this.turnManager.turnOrder.indexOf(entity);
        if (index !== -1) {
            this.turnManager.turnOrder.splice(index, 1);
            // Adjust current index if necessary
            if (this.turnManager.currentEntityIndex >= index) {
                this.turnManager.currentEntityIndex = Math.max(0, this.turnManager.currentEntityIndex - 1);
            }
        }
    }
    /**
     * Get current active entity
     */
    getCurrentEntity() {
        if (this.turnManager.turnOrder.length === 0)
            return null;
        const index = this.turnManager.currentEntityIndex;
        return this.turnManager.turnOrder[index] || null;
    }
    /**
     * Get current turn number
     */
    getCurrentTurn() {
        return this.turnManager.currentTurn;
    }
    /**
     * Get current turn phase
     */
    getCurrentPhase() {
        return this.turnManager.turnPhase;
    }
    /**
     * Process a turn action
     */
    processTurnAction(action) {
        const currentEntity = this.getCurrentEntity();
        if (!currentEntity || currentEntity !== action.entity) {
            return false; // Not this entity's turn
        }
        // Validate action based on current phase
        if (!this.isActionValidForPhase(action, this.turnManager.turnPhase)) {
            return false;
        }
        // Process the action
        this.executeAction(action);
        // Advance turn if action consumed full turn
        if (action.cost >= 1.0) {
            this.advanceTurn();
        }
        return true;
    }
    /**
     * Advance to next entity/phase
     */
    advanceTurn() {
        this.turnManager.currentEntityIndex++;
        // Check if we've gone through all entities
        if (this.turnManager.currentEntityIndex >= this.turnManager.turnOrder.length) {
            this.advancePhase();
        }
    }
    /**
     * Advance to next phase
     */
    advancePhase() {
        const phases = [
            'player-action',
            'recovery',
            'ally-movement',
            'enemy-movement',
            'traps',
            'attacks',
            'end-turn'
        ];
        const currentPhaseIndex = phases.indexOf(this.turnManager.turnPhase);
        const nextPhaseIndex = (currentPhaseIndex + 1) % phases.length;
        this.turnManager.turnPhase = phases[nextPhaseIndex];
        this.turnManager.currentEntityIndex = 0;
        // If we're back to player-action, increment turn counter
        if (this.turnManager.turnPhase === 'player-action') {
            this.turnManager.currentTurn++;
        }
        // Notify listeners
        this.notifyPhaseListeners(this.turnManager.turnPhase);
    }
    /**
     * Skip current entity's turn
     */
    skipTurn() {
        this.advanceTurn();
    }
    /**
     * Force advance to specific phase
     */
    setPhase(phase) {
        this.turnManager.turnPhase = phase;
        this.turnManager.currentEntityIndex = 0;
        this.notifyPhaseListeners(phase);
    }
    /**
     * Check if action is valid for current phase
     */
    isActionValidForPhase(action, phase) {
        switch (phase) {
            case 'player-action':
                return true; // Player can do any action during their phase
            case 'ally-movement':
                return action.type === 'move' || action.type === 'wait';
            case 'enemy-movement':
                return action.type === 'move' || action.type === 'wait';
            case 'attacks':
                return action.type === 'attack';
            default:
                return false; // No actions allowed during other phases
        }
    }
    /**
     * Execute a turn action
     */
    executeAction(action) {
        // This is a placeholder - actual action execution would be handled
        // by other systems (MovementSystem, CombatSystem, etc.)
        console.log(`Executing ${action.type} action for entity ${action.entity.id}`);
    }
    /**
     * Sort turn order by initiative/speed
     */
    sortTurnOrder() {
        // For now, keep original order
        // In future, could sort by speed stats or initiative
        // this.turnManager.turnOrder.sort((a, b) => b.stats.speed - a.stats.speed);
    }
    /**
     * Add listener for phase changes
     */
    addPhaseListener(phase, callback) {
        if (!this.turnListeners.has(phase)) {
            this.turnListeners.set(phase, []);
        }
        this.turnListeners.get(phase).push(callback);
    }
    /**
     * Remove phase listener
     */
    removePhaseListener(phase, callback) {
        const listeners = this.turnListeners.get(phase);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }
    /**
     * Notify phase listeners
     */
    notifyPhaseListeners(phase) {
        const listeners = this.turnListeners.get(phase);
        if (listeners) {
            const relevantEntities = this.getEntitiesForPhase(phase);
            listeners.forEach(callback => callback(relevantEntities));
        }
    }
    /**
     * Get entities relevant to current phase
     */
    getEntitiesForPhase(phase) {
        switch (phase) {
            case 'player-action':
                return this.turnManager.turnOrder.filter(entity => entity.constructor.name === 'PlayerEntity');
            case 'ally-movement':
                return this.turnManager.turnOrder.filter(entity => entity.constructor.name === 'CompanionEntity');
            case 'enemy-movement':
                return this.turnManager.turnOrder.filter(entity => entity.constructor.name === 'MonsterEntity');
            default:
                return this.turnManager.turnOrder;
        }
    }
    /**
     * Create a turn action
     */
    createAction(type, entity, data, cost = 1.0) {
        return {
            type,
            entity,
            data,
            cost
        };
    }
    /**
     * Check if it's a specific entity's turn
     */
    isEntityTurn(entity) {
        return this.getCurrentEntity() === entity;
    }
    /**
     * Get turn statistics
     */
    getTurnStats() {
        const currentEntity = this.getCurrentEntity();
        return {
            currentTurn: this.turnManager.currentTurn,
            currentPhase: this.turnManager.turnPhase,
            currentEntity: currentEntity ? currentEntity.id : null,
            totalEntities: this.turnManager.turnOrder.length,
            entityIndex: this.turnManager.currentEntityIndex
        };
    }
    /**
     * Reset turn system
     */
    reset() {
        this.turnManager = {
            currentTurn: 1,
            turnOrder: [],
            currentEntityIndex: 0,
            turnPhase: 'player-action'
        };
    }
}
//# sourceMappingURL=TurnSystem.js.map