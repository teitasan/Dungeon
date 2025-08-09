/**
 * Input handling system for keyboard and mouse input
 */
import { KeyToDirection } from '../types/movement';
export class InputSystem {
    turnSystem;
    movementSystem;
    playerEntity = null;
    keyListeners = new Map();
    constructor(turnSystem, movementSystem) {
        this.turnSystem = turnSystem;
        this.movementSystem = movementSystem;
        this.setupKeyboardListeners();
    }
    /**
     * Set the player entity for input handling
     */
    setPlayerEntity(entity) {
        this.playerEntity = entity;
    }
    /**
     * Handle keyboard input
     */
    handleKeyPress(key) {
        if (!this.playerEntity)
            return null;
        // Check if it's the player's turn
        if (!this.turnSystem.isEntityTurn(this.playerEntity)) {
            return null;
        }
        // Handle movement keys
        const direction = KeyToDirection[key];
        if (direction) {
            return this.handleMovementInput(direction);
        }
        // Handle other action keys
        switch (key.toLowerCase()) {
            case ' ':
            case 'space':
                return this.handleWaitInput();
            case 'enter':
                return this.handleConfirmInput();
            case 'escape':
                return this.handleCancelInput();
            case 'i':
                return this.handleInventoryInput();
            case 'g':
                return this.handlePickupInput();
            case 'u':
                return this.handleUseInput();
            default:
                return null;
        }
    }
    /**
     * Handle mouse click input
     */
    handleMouseClick(position) {
        if (!this.playerEntity)
            return null;
        // Check if it's the player's turn
        if (!this.turnSystem.isEntityTurn(this.playerEntity)) {
            return null;
        }
        // Check if position is adjacent (only allow adjacent movement via mouse)
        if (!this.movementSystem.arePositionsAdjacent(this.playerEntity.position, position)) {
            return null;
        }
        // Calculate direction to clicked position
        const direction = this.movementSystem.getDirectionBetween(this.playerEntity.position, position);
        if (direction) {
            return this.handleMovementInput(direction);
        }
        return null;
    }
    /**
     * Handle movement input
     */
    handleMovementInput(direction) {
        return this.turnSystem.createAction('move', this.playerEntity, { direction }, 1.0);
    }
    /**
     * Handle wait/skip turn input
     */
    handleWaitInput() {
        return this.turnSystem.createAction('wait', this.playerEntity, {}, 1.0);
    }
    /**
     * Handle confirm input (context-dependent)
     */
    handleConfirmInput() {
        // This could be used for confirming actions, using stairs, etc.
        return this.turnSystem.createAction('special', this.playerEntity, { action: 'confirm' }, 0.0 // No turn cost for confirmation
        );
    }
    /**
     * Handle cancel input
     */
    handleCancelInput() {
        return this.turnSystem.createAction('special', this.playerEntity, { action: 'cancel' }, 0.0);
    }
    /**
     * Handle inventory input
     */
    handleInventoryInput() {
        return this.turnSystem.createAction('special', this.playerEntity, { action: 'inventory' }, 0.0 // Opening inventory doesn't cost a turn
        );
    }
    /**
     * Handle pickup input
     */
    handlePickupInput() {
        return this.turnSystem.createAction('special', this.playerEntity, { action: 'pickup' }, 0.5 // Picking up items costs half a turn
        );
    }
    /**
     * Handle use item input
     */
    handleUseInput() {
        return this.turnSystem.createAction('use-item', this.playerEntity, { action: 'use' }, 1.0);
    }
    /**
     * Setup keyboard event listeners
     */
    setupKeyboardListeners() {
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', (event) => {
                const action = this.handleKeyPress(event.key);
                if (action) {
                    this.turnSystem.processTurnAction(action);
                    event.preventDefault();
                }
            });
        }
    }
    /**
     * Add custom key listener
     */
    addKeyListener(key, callback) {
        this.keyListeners.set(key, callback);
    }
    /**
     * Remove key listener
     */
    removeKeyListener(key) {
        this.keyListeners.delete(key);
    }
    /**
     * Process custom key listeners
     */
    processCustomKeyListeners(key) {
        const listener = this.keyListeners.get(key);
        if (listener) {
            listener(key);
        }
    }
    /**
     * Get available movement directions for current player
     */
    getAvailableMovements() {
        if (!this.playerEntity)
            return [];
        return this.movementSystem.getValidMovements(this.playerEntity);
    }
    /**
     * Check if a key is a movement key
     */
    isMovementKey(key) {
        return key in KeyToDirection;
    }
    /**
     * Get direction from key
     */
    getDirectionFromKey(key) {
        return KeyToDirection[key] || null;
    }
    /**
     * Enable/disable input processing
     */
    inputEnabled = true;
    setInputEnabled(enabled) {
        this.inputEnabled = enabled;
    }
    isInputEnabled() {
        return this.inputEnabled;
    }
    /**
     * Process queued actions (for AI or automated input)
     */
    actionQueue = [];
    queueAction(action) {
        this.actionQueue.push(action);
    }
    processQueuedActions() {
        while (this.actionQueue.length > 0) {
            const action = this.actionQueue.shift();
            this.turnSystem.processTurnAction(action);
        }
    }
    clearActionQueue() {
        this.actionQueue = [];
    }
    getQueuedActionCount() {
        return this.actionQueue.length;
    }
}
//# sourceMappingURL=InputSystem.js.map