/**
 * Turn management system
 */
import { GameEntity } from '../types/entities';
import { TurnPhase, TurnAction, TurnActionType } from '../types/movement';
export declare class TurnSystem {
    private turnManager;
    private turnListeners;
    constructor();
    /**
     * Initialize turn system with entities
     */
    initializeTurnOrder(entities: GameEntity[]): void;
    /**
     * Add entity to turn order
     */
    addEntity(entity: GameEntity): void;
    /**
     * Remove entity from turn order
     */
    removeEntity(entity: GameEntity): void;
    /**
     * Get current active entity
     */
    getCurrentEntity(): GameEntity | null;
    /**
     * Get current turn number
     */
    getCurrentTurn(): number;
    /**
     * Get current turn phase
     */
    getCurrentPhase(): TurnPhase;
    /**
     * Process a turn action
     */
    processTurnAction(action: TurnAction): boolean;
    /**
     * Advance to next entity/phase
     */
    advanceTurn(): void;
    /**
     * Advance to next phase
     */
    private advancePhase;
    /**
     * Skip current entity's turn
     */
    skipTurn(): void;
    /**
     * Force advance to specific phase
     */
    setPhase(phase: TurnPhase): void;
    /**
     * Check if action is valid for current phase
     */
    private isActionValidForPhase;
    /**
     * Execute a turn action
     */
    private executeAction;
    /**
     * Sort turn order by initiative/speed
     */
    private sortTurnOrder;
    /**
     * Add listener for phase changes
     */
    addPhaseListener(phase: TurnPhase, callback: (entities: GameEntity[]) => void): void;
    /**
     * Remove phase listener
     */
    removePhaseListener(phase: TurnPhase, callback: (entities: GameEntity[]) => void): void;
    /**
     * Notify phase listeners
     */
    private notifyPhaseListeners;
    /**
     * Get entities relevant to current phase
     */
    private getEntitiesForPhase;
    /**
     * Create a turn action
     */
    createAction(type: TurnActionType, entity: GameEntity, data?: any, cost?: number): TurnAction;
    /**
     * Check if it's a specific entity's turn
     */
    isEntityTurn(entity: GameEntity): boolean;
    /**
     * Get turn statistics
     */
    getTurnStats(): {
        currentTurn: number;
        currentPhase: TurnPhase;
        currentEntity: string | null;
        totalEntities: number;
        entityIndex: number;
    };
    /**
     * Reset turn system
     */
    reset(): void;
}
//# sourceMappingURL=TurnSystem.d.ts.map