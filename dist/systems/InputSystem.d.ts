/**
 * Input handling system for keyboard and mouse input
 */
import { Position } from '../types/core';
import { GameEntity } from '../types/entities';
import { InputHandler, TurnAction, MovementDirection } from '../types/movement';
import { TurnSystem } from './TurnSystem';
import { MovementSystem } from './MovementSystem';
export declare class InputSystem implements InputHandler {
    private turnSystem;
    private movementSystem;
    private playerEntity;
    private keyListeners;
    constructor(turnSystem: TurnSystem, movementSystem: MovementSystem);
    /**
     * Set the player entity for input handling
     */
    setPlayerEntity(entity: GameEntity): void;
    /**
     * Handle keyboard input
     */
    handleKeyPress(key: string): TurnAction | null;
    /**
     * Handle mouse click input
     */
    handleMouseClick(position: Position): TurnAction | null;
    /**
     * Handle movement input
     */
    private handleMovementInput;
    /**
     * Handle wait/skip turn input
     */
    private handleWaitInput;
    /**
     * Handle confirm input (context-dependent)
     */
    private handleConfirmInput;
    /**
     * Handle cancel input
     */
    private handleCancelInput;
    /**
     * Handle inventory input
     */
    private handleInventoryInput;
    /**
     * Handle pickup input
     */
    private handlePickupInput;
    /**
     * Handle use item input
     */
    private handleUseInput;
    /**
     * Setup keyboard event listeners
     */
    private setupKeyboardListeners;
    /**
     * Add custom key listener
     */
    addKeyListener(key: string, callback: (key: string) => void): void;
    /**
     * Remove key listener
     */
    removeKeyListener(key: string): void;
    /**
     * Process custom key listeners
     */
    private processCustomKeyListeners;
    /**
     * Get available movement directions for current player
     */
    getAvailableMovements(): MovementDirection[];
    /**
     * Check if a key is a movement key
     */
    isMovementKey(key: string): boolean;
    /**
     * Get direction from key
     */
    getDirectionFromKey(key: string): MovementDirection | null;
    /**
     * Enable/disable input processing
     */
    private inputEnabled;
    setInputEnabled(enabled: boolean): void;
    isInputEnabled(): boolean;
    /**
     * Process queued actions (for AI or automated input)
     */
    private actionQueue;
    queueAction(action: TurnAction): void;
    processQueuedActions(): void;
    clearActionQueue(): void;
    getQueuedActionCount(): number;
}
//# sourceMappingURL=InputSystem.d.ts.map