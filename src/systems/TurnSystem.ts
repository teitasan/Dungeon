/**
 * Turn management system
 */

import { GameEntity } from '../types/entities';
import { 
  TurnManager, 
  TurnPhase, 
  TurnAction, 
  TurnActionType 
} from '../types/movement';

export class TurnSystem {
  private turnManager: TurnManager;
  private turnListeners: Map<TurnPhase, ((entities: GameEntity[]) => void)[]>;

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
  initializeTurnOrder(entities: GameEntity[]): void {
    this.turnManager.turnOrder = [...entities];
    this.turnManager.currentEntityIndex = 0;
    this.turnManager.turnPhase = 'player-action';
    
    // Sort by initiative/speed if needed
    this.sortTurnOrder();
  }

  /**
   * Add entity to turn order
   */
  addEntity(entity: GameEntity): void {
    if (!this.turnManager.turnOrder.includes(entity)) {
      this.turnManager.turnOrder.push(entity);
      this.sortTurnOrder();
    }
  }

  /**
   * Remove entity from turn order
   */
  removeEntity(entity: GameEntity): void {
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
  getCurrentEntity(): GameEntity | null {
    if (this.turnManager.turnOrder.length === 0) return null;
    
    const index = this.turnManager.currentEntityIndex;
    return this.turnManager.turnOrder[index] || null;
  }

  /**
   * Get current turn number
   */
  getCurrentTurn(): number {
    return this.turnManager.currentTurn;
  }

  /**
   * Get current turn phase
   */
  getCurrentPhase(): TurnPhase {
    return this.turnManager.turnPhase;
  }

  /**
   * Process a turn action
   */
  processTurnAction(action: TurnAction): boolean {
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
  advanceTurn(): void {
    this.turnManager.currentEntityIndex++;
    
    // Check if we've gone through all entities
    if (this.turnManager.currentEntityIndex >= this.turnManager.turnOrder.length) {
      this.advancePhase();
    }
  }

  /**
   * Advance to next phase
   */
  private advancePhase(): void {
    const phases: TurnPhase[] = [
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
  skipTurn(): void {
    this.advanceTurn();
  }

  /**
   * Force advance to specific phase
   */
  setPhase(phase: TurnPhase): void {
    this.turnManager.turnPhase = phase;
    this.turnManager.currentEntityIndex = 0;
    this.notifyPhaseListeners(phase);
  }

  /**
   * Check if action is valid for current phase
   */
  private isActionValidForPhase(action: TurnAction, phase: TurnPhase): boolean {
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
  private executeAction(action: TurnAction): void {
    // This is a placeholder - actual action execution would be handled
    // by other systems (MovementSystem, CombatSystem, etc.)
    console.log(`Executing ${action.type} action for entity ${action.entity.id}`);
  }

  /**
   * Sort turn order by initiative/speed
   */
  private sortTurnOrder(): void {
    // For now, keep original order
    // In future, could sort by speed stats or initiative
    // this.turnManager.turnOrder.sort((a, b) => b.stats.speed - a.stats.speed);
  }

  /**
   * Add listener for phase changes
   */
  addPhaseListener(phase: TurnPhase, callback: (entities: GameEntity[]) => void): void {
    if (!this.turnListeners.has(phase)) {
      this.turnListeners.set(phase, []);
    }
    this.turnListeners.get(phase)!.push(callback);
  }

  /**
   * Remove phase listener
   */
  removePhaseListener(phase: TurnPhase, callback: (entities: GameEntity[]) => void): void {
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
  private notifyPhaseListeners(phase: TurnPhase): void {
    const listeners = this.turnListeners.get(phase);
    if (listeners) {
      const relevantEntities = this.getEntitiesForPhase(phase);
      listeners.forEach(callback => callback(relevantEntities));
    }
  }

  /**
   * Get entities relevant to current phase
   */
  private getEntitiesForPhase(phase: TurnPhase): GameEntity[] {
    switch (phase) {
      case 'player-action':
        return this.turnManager.turnOrder.filter(entity => 
          entity.constructor.name === 'PlayerEntity'
        );
      case 'ally-movement':
        return this.turnManager.turnOrder.filter(entity => 
          entity.constructor.name === 'CompanionEntity'
        );
      case 'enemy-movement':
        return this.turnManager.turnOrder.filter(entity => 
          entity.constructor.name === 'MonsterEntity'
        );
      default:
        return this.turnManager.turnOrder;
    }
  }

  /**
   * Create a turn action
   */
  createAction(
    type: TurnActionType, 
    entity: GameEntity, 
    data?: any, 
    cost: number = 1.0
  ): TurnAction {
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
  isEntityTurn(entity: GameEntity): boolean {
    return this.getCurrentEntity() === entity;
  }

  /**
   * Get turn statistics
   */
  getTurnStats(): {
    currentTurn: number;
    currentPhase: TurnPhase;
    currentEntity: string | null;
    totalEntities: number;
    entityIndex: number;
  } {
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
  reset(): void {
    this.turnManager = {
      currentTurn: 1,
      turnOrder: [],
      currentEntityIndex: 0,
      turnPhase: 'player-action'
    };
  }
}