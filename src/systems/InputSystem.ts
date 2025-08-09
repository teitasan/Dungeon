/**
 * Input handling system for keyboard and mouse input
 */

import { Position } from '../types/core';
import { GameEntity } from '../types/entities';
import { 
  InputHandler, 
  TurnAction, 
  MovementDirection,
  KeyToDirection 
} from '../types/movement';
import { TurnSystem } from './TurnSystem';
import { MovementSystem } from './MovementSystem';

export class InputSystem implements InputHandler {
  private turnSystem: TurnSystem;
  private movementSystem: MovementSystem;
  private playerEntity: GameEntity | null = null;
  private keyListeners: Map<string, (key: string) => void> = new Map();

  constructor(turnSystem: TurnSystem, movementSystem: MovementSystem) {
    this.turnSystem = turnSystem;
    this.movementSystem = movementSystem;
    this.setupKeyboardListeners();
  }

  /**
   * Set the player entity for input handling
   */
  setPlayerEntity(entity: GameEntity): void {
    this.playerEntity = entity;
  }

  /**
   * Handle keyboard input
   */
  handleKeyPress(key: string): TurnAction | null {
    if (!this.playerEntity) return null;

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
  handleMouseClick(position: Position): TurnAction | null {
    if (!this.playerEntity) return null;

    // Check if it's the player's turn
    if (!this.turnSystem.isEntityTurn(this.playerEntity)) {
      return null;
    }

    // Check if position is adjacent (only allow adjacent movement via mouse)
    if (!this.movementSystem.arePositionsAdjacent(this.playerEntity.position, position)) {
      return null;
    }

    // Calculate direction to clicked position
    const direction = this.movementSystem.getDirectionBetween(
      this.playerEntity.position, 
      position
    );

    if (direction) {
      return this.handleMovementInput(direction);
    }

    return null;
  }

  /**
   * Handle movement input
   */
  private handleMovementInput(direction: MovementDirection): TurnAction {
    return this.turnSystem.createAction(
      'move',
      this.playerEntity!,
      { direction },
      1.0
    );
  }

  /**
   * Handle wait/skip turn input
   */
  private handleWaitInput(): TurnAction {
    return this.turnSystem.createAction(
      'wait',
      this.playerEntity!,
      {},
      1.0
    );
  }

  /**
   * Handle confirm input (context-dependent)
   */
  private handleConfirmInput(): TurnAction {
    // This could be used for confirming actions, using stairs, etc.
    return this.turnSystem.createAction(
      'special',
      this.playerEntity!,
      { action: 'confirm' },
      0.0 // No turn cost for confirmation
    );
  }

  /**
   * Handle cancel input
   */
  private handleCancelInput(): TurnAction {
    return this.turnSystem.createAction(
      'special',
      this.playerEntity!,
      { action: 'cancel' },
      0.0
    );
  }

  /**
   * Handle inventory input
   */
  private handleInventoryInput(): TurnAction {
    return this.turnSystem.createAction(
      'special',
      this.playerEntity!,
      { action: 'inventory' },
      0.0 // Opening inventory doesn't cost a turn
    );
  }

  /**
   * Handle pickup input
   */
  private handlePickupInput(): TurnAction {
    return this.turnSystem.createAction(
      'special',
      this.playerEntity!,
      { action: 'pickup' },
      0.5 // Picking up items costs half a turn
    );
  }

  /**
   * Handle use item input
   */
  private handleUseInput(): TurnAction {
    return this.turnSystem.createAction(
      'use-item',
      this.playerEntity!,
      { action: 'use' },
      1.0
    );
  }

  /**
   * Setup keyboard event listeners
   */
  private setupKeyboardListeners(): void {
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
  addKeyListener(key: string, callback: (key: string) => void): void {
    this.keyListeners.set(key, callback);
  }

  /**
   * Remove key listener
   */
  removeKeyListener(key: string): void {
    this.keyListeners.delete(key);
  }

  /**
   * Process custom key listeners
   */
  private processCustomKeyListeners(key: string): void {
    const listener = this.keyListeners.get(key);
    if (listener) {
      listener(key);
    }
  }

  /**
   * Get available movement directions for current player
   */
  getAvailableMovements(): MovementDirection[] {
    if (!this.playerEntity) return [];
    
    return this.movementSystem.getValidMovements(this.playerEntity);
  }

  /**
   * Check if a key is a movement key
   */
  isMovementKey(key: string): boolean {
    return key in KeyToDirection;
  }

  /**
   * Get direction from key
   */
  getDirectionFromKey(key: string): MovementDirection | null {
    return KeyToDirection[key] || null;
  }

  /**
   * Enable/disable input processing
   */
  private inputEnabled: boolean = true;

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
  }

  isInputEnabled(): boolean {
    return this.inputEnabled;
  }

  /**
   * Process queued actions (for AI or automated input)
   */
  private actionQueue: TurnAction[] = [];

  queueAction(action: TurnAction): void {
    this.actionQueue.push(action);
  }

  processQueuedActions(): void {
    while (this.actionQueue.length > 0) {
      const action = this.actionQueue.shift()!;
      this.turnSystem.processTurnAction(action);
    }
  }

  clearActionQueue(): void {
    this.actionQueue = [];
  }

  getQueuedActionCount(): number {
    return this.actionQueue.length;
  }
}