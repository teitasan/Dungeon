/**
 * Multiple dungeon system for managing different dungeons and progression
 */
import { DungeonManager } from '../dungeon/DungeonManager';
import { PlayerEntity } from '../entities/Player';
export interface DungeonDefinition {
    id: string;
    name: string;
    description: string;
    minLevel: number;
    maxFloors: number;
    difficulty: DungeonDifficulty;
    unlockConditions: UnlockCondition[];
    rewards: DungeonReward[];
    specialFeatures: string[];
}
export type DungeonDifficulty = 'easy' | 'normal' | 'hard' | 'expert' | 'nightmare';
export interface UnlockCondition {
    type: UnlockConditionType;
    value: number | string;
    description: string;
}
export type UnlockConditionType = 'level' | 'clear-dungeon' | 'collect-item' | 'defeat-boss' | 'story-progress';
export interface DungeonReward {
    type: RewardType;
    itemId?: string;
    amount?: number;
    description: string;
}
export type RewardType = 'item' | 'gold' | 'experience' | 'unlock-dungeon' | 'title';
export interface DungeonProgress {
    dungeonId: string;
    isUnlocked: boolean;
    isCompleted: boolean;
    bestFloor: number;
    completionCount: number;
    firstClearTime?: Date;
    bestTime?: number;
    totalAttempts: number;
}
export interface DungeonSelectionResult {
    success: boolean;
    dungeon?: DungeonDefinition;
    message: string;
    canEnter: boolean;
}
export interface DungeonCompletionResult {
    success: boolean;
    dungeon: DungeonDefinition;
    floorReached: number;
    rewards: DungeonReward[];
    newUnlocks: DungeonDefinition[];
    message: string;
}
export declare class MultipleDungeonSystem {
    private dungeonManager;
    private dungeonDefinitions;
    private playerProgress;
    private currentDungeon?;
    private currentFloor;
    constructor(dungeonManager: DungeonManager);
    /**
     * Get all available dungeons
     */
    getAllDungeons(): DungeonDefinition[];
    /**
     * Get unlocked dungeons for player
     */
    getUnlockedDungeons(player: PlayerEntity): DungeonDefinition[];
    /**
     * Get dungeon by ID
     */
    getDungeon(dungeonId: string): DungeonDefinition | undefined;
    /**
     * Check if dungeon is unlocked for player
     */
    isDungeonUnlocked(dungeonId: string, player: PlayerEntity): boolean;
    /**
     * Select and enter dungeon
     */
    selectDungeon(dungeonId: string, player: PlayerEntity): DungeonSelectionResult;
    /**
     * Advance to next floor
     */
    advanceFloor(player: PlayerEntity): {
        success: boolean;
        newFloor: number;
        message: string;
        isCompleted: boolean;
    };
    /**
     * Complete current dungeon
     */
    private completeDungeon;
    /**
     * Exit current dungeon (failure)
     */
    exitDungeon(player: PlayerEntity, reason: 'death' | 'escape' | 'quit'): {
        success: boolean;
        message: string;
        floorReached: number;
    };
    /**
     * Get current dungeon info
     */
    getCurrentDungeonInfo(): {
        dungeon?: DungeonDefinition;
        floor: number;
        isActive: boolean;
    };
    /**
     * Get player progress for dungeon
     */
    getPlayerProgress(dungeonId: string): DungeonProgress;
    /**
     * Get all player progress
     */
    getAllPlayerProgress(): Map<string, DungeonProgress>;
    /**
     * Check unlock condition
     */
    private checkUnlockCondition;
    /**
     * Give rewards to player
     */
    private giveRewards;
    /**
     * Check for new dungeon unlocks
     */
    private checkNewUnlocks;
    /**
     * Initialize default dungeons
     */
    private initializeDefaultDungeons;
    /**
     * Ensure there is a registered dungeon template corresponding to the given dungeon definition.
     * If not present, register a simple default template using generic generation parameters.
     */
    private ensureTemplateForDungeon;
    /**
     * Reset all progress (for testing or new game)
     */
    resetProgress(): void;
    /**
     * Get dungeon statistics
     */
    getDungeonStats(): {
        totalDungeons: number;
        unlockedCount: number;
        completedCount: number;
        totalAttempts: number;
        totalCompletions: number;
    };
}
//# sourceMappingURL=MultipleDungeonSystem.d.ts.map