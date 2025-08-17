/**
 * Multiple dungeon system for managing different dungeons and progression
 */

import { DungeonManager } from '../dungeon/DungeonManager';
import { DungeonTemplate } from '../types/dungeon';
import { PlayerEntity } from '../entities/Player';

// Dungeon definition
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

// Unlock conditions
export interface UnlockCondition {
  type: UnlockConditionType;
  value: number | string;
  description: string;
}

export type UnlockConditionType = 
  | 'level' 
  | 'clear-dungeon' 
  | 'collect-item' 
  | 'defeat-boss' 
  | 'story-progress';

// Dungeon rewards
export interface DungeonReward {
  type: RewardType;
  itemId?: string;
  amount?: number;
  description: string;
}

export type RewardType = 'item' | 'gold' | 'experience' | 'unlock-dungeon' | 'title';

// Dungeon progress tracking
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

// Dungeon selection result
export interface DungeonSelectionResult {
  success: boolean;
  dungeon?: DungeonDefinition;
  message: string;
  canEnter: boolean;
}

// Dungeon completion result
export interface DungeonCompletionResult {
  success: boolean;
  dungeon: DungeonDefinition;
  floorReached: number;
  rewards: DungeonReward[];
  newUnlocks: DungeonDefinition[];
  message: string;
}

export class MultipleDungeonSystem {
  private dungeonManager: DungeonManager;
  private dungeonDefinitions: Map<string, DungeonDefinition> = new Map();
  private playerProgress: Map<string, DungeonProgress> = new Map();
  private currentDungeon?: DungeonDefinition;
  private currentFloor: number = 1;

  constructor(dungeonManager: DungeonManager) {
    this.dungeonManager = dungeonManager;
    this.initializeDefaultDungeons();
  }

  /**
   * Get all available dungeons
   */
  getAllDungeons(): DungeonDefinition[] {
    return Array.from(this.dungeonDefinitions.values());
  }

  /**
   * Get unlocked dungeons for player
   */
  getUnlockedDungeons(player: PlayerEntity): DungeonDefinition[] {
    return this.getAllDungeons().filter(dungeon => 
      this.isDungeonUnlocked(dungeon.id, player)
    );
  }

  /**
   * Get dungeon by ID
   */
  getDungeon(dungeonId: string): DungeonDefinition | undefined {
    return this.dungeonDefinitions.get(dungeonId);
  }

  /**
   * Check if dungeon is unlocked for player
   */
  isDungeonUnlocked(dungeonId: string, player: PlayerEntity): boolean {
    const progress = this.getPlayerProgress(dungeonId);
    if (progress.isUnlocked) return true;

    const dungeon = this.dungeonDefinitions.get(dungeonId);
    if (!dungeon) return false;

    // Check unlock conditions
    for (const condition of dungeon.unlockConditions) {
      if (!this.checkUnlockCondition(condition, player)) {
        return false;
      }
    }

    // All conditions met, unlock the dungeon
    progress.isUnlocked = true;
    return true;
  }

  /**
   * Select and enter dungeon
   */
  selectDungeon(dungeonId: string, player: PlayerEntity): DungeonSelectionResult {
    const dungeon = this.dungeonDefinitions.get(dungeonId);
    if (!dungeon) {
      return {
        success: false,
        message: 'Dungeon not found',
        canEnter: false
      };
    }

    if (!this.isDungeonUnlocked(dungeonId, player)) {
      return {
        success: false,
        dungeon,
        message: 'Dungeon is not unlocked',
        canEnter: false
      };
    }

    // Check level requirement
    if (player.stats.level < dungeon.minLevel) {
      return {
        success: false,
        dungeon,
        message: `Requires level ${dungeon.minLevel} (current: ${player.stats.level})`,
        canEnter: false
      };
    }

    // Ensure a matching dungeon template exists or register a default one
    this.ensureTemplateForDungeon(dungeon);

    // Enter dungeon
    this.currentDungeon = dungeon;
    this.currentFloor = 1;
    
    // Generate first floor
    this.dungeonManager.generateDungeon(dungeonId, 1);
    
    // Update progress
    const progress = this.getPlayerProgress(dungeonId);
    progress.totalAttempts++;

    return {
      success: true,
      dungeon,
      message: `Entered ${dungeon.name}`,
      canEnter: true
    };
  }

  /**
   * Advance to next floor
   */
  advanceFloor(player: PlayerEntity): {
    success: boolean;
    newFloor: number;
    message: string;
    isCompleted: boolean;
  } {
    if (!this.currentDungeon) {
      return {
        success: false,
        newFloor: this.currentFloor,
        message: 'No active dungeon',
        isCompleted: false
      };
    }

    this.currentFloor++;
    
    // Check if dungeon is completed
    if (this.currentFloor > this.currentDungeon.maxFloors) {
      const completion = this.completeDungeon(player);
      return {
        success: true,
        newFloor: this.currentFloor - 1,
        message: completion.message,
        isCompleted: true
      };
    }

    // Generate next floor
    this.ensureTemplateForDungeon(this.currentDungeon);
    this.dungeonManager.generateDungeon(this.currentDungeon.id, this.currentFloor);
    
    // Update progress
    const progress = this.getPlayerProgress(this.currentDungeon.id);
    progress.bestFloor = Math.max(progress.bestFloor, this.currentFloor);

    return {
      success: true,
      newFloor: this.currentFloor,
      message: `Advanced to floor ${this.currentFloor}`,
      isCompleted: false
    };
  }

  /**
   * Complete current dungeon
   */
  private completeDungeon(player: PlayerEntity): DungeonCompletionResult {
    if (!this.currentDungeon) {
      return {
        success: false,
        dungeon: {} as DungeonDefinition,
        floorReached: 0,
        rewards: [],
        newUnlocks: [],
        message: 'No active dungeon'
      };
    }

    const dungeon = this.currentDungeon;
    const progress = this.getPlayerProgress(dungeon.id);
    
    // Mark as completed
    progress.isCompleted = true;
    progress.completionCount++;
    progress.bestFloor = Math.max(progress.bestFloor, this.currentFloor - 1);
    
    if (!progress.firstClearTime) {
      progress.firstClearTime = new Date();
    }

    // Give rewards
    const rewards = [...dungeon.rewards];
    this.giveRewards(rewards, player);

    // Check for new unlocks
    const newUnlocks = this.checkNewUnlocks(player);

    // Reset current dungeon
    this.currentDungeon = undefined;
    this.currentFloor = 1;

    return {
      success: true,
      dungeon,
      floorReached: this.currentFloor - 1,
      rewards,
      newUnlocks,
      message: `Completed ${dungeon.name}! Received ${rewards.length} rewards.`
    };
  }

  /**
   * Exit current dungeon (failure)
   */
  exitDungeon(player: PlayerEntity, reason: 'death' | 'escape' | 'quit'): {
    success: boolean;
    message: string;
    floorReached: number;
  } {
    if (!this.currentDungeon) {
      return {
        success: false,
        message: 'No active dungeon',
        floorReached: 0
      };
    }

    const dungeon = this.currentDungeon;
    const floorReached = this.currentFloor;
    
    // Update progress
    const progress = this.getPlayerProgress(dungeon.id);
    progress.bestFloor = Math.max(progress.bestFloor, floorReached);

    // Reset current dungeon
    this.currentDungeon = undefined;
    this.currentFloor = 1;

    const reasonMessages = {
      death: 'You were defeated',
      escape: 'You escaped from the dungeon',
      quit: 'You quit the dungeon'
    };

    return {
      success: true,
      message: `${reasonMessages[reason]} on floor ${floorReached} of ${dungeon.name}`,
      floorReached
    };
  }

  /**
   * Get current dungeon info
   */
  getCurrentDungeonInfo(): {
    dungeon?: DungeonDefinition;
    floor: number;
    isActive: boolean;
  } {
    return {
      dungeon: this.currentDungeon,
      floor: this.currentFloor,
      isActive: this.currentDungeon !== undefined
    };
  }

  /**
   * Get player progress for dungeon
   */
  getPlayerProgress(dungeonId: string): DungeonProgress {
    let progress = this.playerProgress.get(dungeonId);
    if (!progress) {
      progress = {
        dungeonId,
        isUnlocked: false,
        isCompleted: false,
        bestFloor: 0,
        completionCount: 0,
        totalAttempts: 0
      };
      this.playerProgress.set(dungeonId, progress);
    }
    return progress;
  }

  /**
   * Get all player progress
   */
  getAllPlayerProgress(): Map<string, DungeonProgress> {
    return new Map(this.playerProgress);
  }

  /**
   * Check unlock condition
   */
  private checkUnlockCondition(condition: UnlockCondition, player: PlayerEntity): boolean {
    switch (condition.type) {
      case 'level':
        return player.stats.level >= (condition.value as number);
      
      case 'clear-dungeon':
        const dungeonProgress = this.getPlayerProgress(condition.value as string);
        return dungeonProgress.isCompleted;
      
      case 'collect-item':
        // Check if player has specific item
        return player.inventory.some(item => item.id === condition.value);
      
      case 'defeat-boss':
        // This would integrate with a boss tracking system
        return true; // Placeholder
      
      case 'story-progress':
        // This would integrate with a story progress system
        return true; // Placeholder
      
      default:
        return false;
    }
  }

  /**
   * Give rewards to player
   */
  private giveRewards(rewards: DungeonReward[], player: PlayerEntity): void {
    for (const reward of rewards) {
      switch (reward.type) {
        case 'gold':
          (player as any).gold = ((player as any).gold || 0) + (reward.amount || 0);
          break;
        
        case 'experience':
          player.stats.experience += (reward.amount || 0);
          break;
        
        case 'item':
          // This would integrate with item creation system
          break;
        
        case 'unlock-dungeon':
          if (reward.itemId) {
            const progress = this.getPlayerProgress(reward.itemId);
            progress.isUnlocked = true;
          }
          break;
        
        case 'title':
          // This would integrate with title system
          break;
      }
    }
  }

  /**
   * Check for new dungeon unlocks
   */
  private checkNewUnlocks(player: PlayerEntity): DungeonDefinition[] {
    const newUnlocks: DungeonDefinition[] = [];
    
    for (const dungeon of this.dungeonDefinitions.values()) {
      const progress = this.getPlayerProgress(dungeon.id);
      if (!progress.isUnlocked && this.isDungeonUnlocked(dungeon.id, player)) {
        newUnlocks.push(dungeon);
      }
    }
    
    return newUnlocks;
  }

  /**
   * Initialize default dungeons
   */
  private initializeDefaultDungeons(): void {
    // Beginner Dungeon
    this.dungeonDefinitions.set('beginner-cave', {
      id: 'beginner-cave',
      name: 'Beginner Cave',
      description: 'A simple cave perfect for new adventurers',
      minLevel: 1,
      maxFloors: 5,
      difficulty: 'easy',
      unlockConditions: [], // Always unlocked
      rewards: [
        {
          type: 'gold',
          amount: 100,
          description: '100 gold pieces'
        },
        {
          type: 'experience',
          amount: 50,
          description: '50 experience points'
        }
      ],
      specialFeatures: ['safe-zone', 'tutorial-tips']
    });

    // Forest Dungeon
    this.dungeonDefinitions.set('mystic-forest', {
      id: 'mystic-forest',
      name: 'Mystic Forest',
      description: 'A mysterious forest filled with magical creatures',
      minLevel: 5,
      maxFloors: 10,
      difficulty: 'normal',
      unlockConditions: [
        {
          type: 'clear-dungeon',
          value: 'beginner-cave',
          description: 'Clear Beginner Cave'
        }
      ],
      rewards: [
        {
          type: 'gold',
          amount: 300,
          description: '300 gold pieces'
        },
        {
          type: 'experience',
          amount: 150,
          description: '150 experience points'
        },
        {
          type: 'unlock-dungeon',
          itemId: 'ancient-ruins',
          description: 'Unlocks Ancient Ruins'
        }
      ],
      specialFeatures: ['nature-magic', 'healing-springs']
    });

    // Ancient Ruins
    this.dungeonDefinitions.set('ancient-ruins', {
      id: 'ancient-ruins',
      name: 'Ancient Ruins',
      description: 'Crumbling ruins of an ancient civilization',
      minLevel: 10,
      maxFloors: 15,
      difficulty: 'hard',
      unlockConditions: [
        {
          type: 'clear-dungeon',
          value: 'mystic-forest',
          description: 'Clear Mystic Forest'
        },
        {
          type: 'level',
          value: 10,
          description: 'Reach level 10'
        }
      ],
      rewards: [
        {
          type: 'gold',
          amount: 500,
          description: '500 gold pieces'
        },
        {
          type: 'experience',
          amount: 300,
          description: '300 experience points'
        },
        {
          type: 'unlock-dungeon',
          itemId: 'demon-tower',
          description: 'Unlocks Demon Tower'
        }
      ],
      specialFeatures: ['ancient-traps', 'treasure-chambers']
    });

    // Demon Tower
    this.dungeonDefinitions.set('demon-tower', {
      id: 'demon-tower',
      name: 'Demon Tower',
      description: 'A towering spire infested with demons',
      minLevel: 15,
      maxFloors: 25,
      difficulty: 'expert',
      unlockConditions: [
        {
          type: 'clear-dungeon',
          value: 'ancient-ruins',
          description: 'Clear Ancient Ruins'
        },
        {
          type: 'level',
          value: 15,
          description: 'Reach level 15'
        }
      ],
      rewards: [
        {
          type: 'gold',
          amount: 1000,
          description: '1000 gold pieces'
        },
        {
          type: 'experience',
          amount: 500,
          description: '500 experience points'
        },
        {
          type: 'unlock-dungeon',
          itemId: 'void-abyss',
          description: 'Unlocks Void Abyss'
        }
      ],
      specialFeatures: ['demon-magic', 'boss-floors']
    });

    // Void Abyss (Final Dungeon)
    this.dungeonDefinitions.set('void-abyss', {
      id: 'void-abyss',
      name: 'Void Abyss',
      description: 'The ultimate challenge - an endless abyss of darkness',
      minLevel: 25,
      maxFloors: 50,
      difficulty: 'nightmare',
      unlockConditions: [
        {
          type: 'clear-dungeon',
          value: 'demon-tower',
          description: 'Clear Demon Tower'
        },
        {
          type: 'level',
          value: 25,
          description: 'Reach level 25'
        }
      ],
      rewards: [
        {
          type: 'gold',
          amount: 2000,
          description: '2000 gold pieces'
        },
        {
          type: 'experience',
          amount: 1000,
          description: '1000 experience points'
        },
        {
          type: 'title',
          description: 'Void Conqueror title'
        }
      ],
      specialFeatures: ['void-magic', 'ultimate-boss', 'endless-mode']
    });

    // Unlock the first dungeon by default
    const beginnerProgress = this.getPlayerProgress('beginner-cave');
    beginnerProgress.isUnlocked = true;
  }

  /**
   * Ensure there is a registered dungeon template corresponding to the given dungeon definition.
   * If not present, register a simple default template using generic generation parameters.
   */
  private ensureTemplateForDungeon(dungeon: DungeonDefinition): void {
    const existing = this.dungeonManager.getTemplate(dungeon.id);
    if (existing) return;

    // Fallback: try to reuse an existing template id if any exist
    const availableTemplateIds = this.dungeonManager.getTemplateIds();
    if (availableTemplateIds.length === 0) {
      // No templates exist; register a minimal one
      const template: DungeonTemplate = {
        id: dungeon.id,
        name: dungeon.name,
        description: dungeon.description,
        floors: dungeon.maxFloors,
        generationParams: {
          width: 45,
          height: 45,
          minRooms: 4,
          maxRooms: 8,
          minRoomSize: 4,
          maxRoomSize: 10,
          corridorWidth: 1,
          roomDensity: 0.3,
          specialRoomChance: 0.1,
          trapDensity: 0.05
        },
        tileSet: 'basic',
        monsterTable: [],
        itemTable: [],
        specialRules: []
      };
      this.dungeonManager.registerTemplate(template);
      return;
    }

    // Templates exist but not for this id; clone a basic template shape with this dungeon's identity
    const baseTemplate = this.dungeonManager.getTemplate(availableTemplateIds[0])!;
    const clonedTemplate: DungeonTemplate = {
      ...baseTemplate,
      id: dungeon.id,
      name: dungeon.name,
      description: dungeon.description,
      floors: dungeon.maxFloors
    };
    this.dungeonManager.registerTemplate(clonedTemplate);
  }

  /**
   * Reset all progress (for testing or new game)
   */
  resetProgress(): void {
    this.playerProgress.clear();
    this.currentDungeon = undefined;
    this.currentFloor = 1;
    
    // Re-unlock beginner dungeon
    const beginnerProgress = this.getPlayerProgress('beginner-cave');
    beginnerProgress.isUnlocked = true;
  }

  /**
   * Get dungeon statistics
   */
  getDungeonStats(): {
    totalDungeons: number;
    unlockedCount: number;
    completedCount: number;
    totalAttempts: number;
    totalCompletions: number;
  } {
    const totalDungeons = this.dungeonDefinitions.size;
    let unlockedCount = 0;
    let completedCount = 0;
    let totalAttempts = 0;
    let totalCompletions = 0;

    for (const progress of this.playerProgress.values()) {
      if (progress.isUnlocked) unlockedCount++;
      if (progress.isCompleted) completedCount++;
      totalAttempts += progress.totalAttempts;
      totalCompletions += progress.completionCount;
    }

    return {
      totalDungeons,
      unlockedCount,
      completedCount,
      totalAttempts,
      totalCompletions
    };
  }
}