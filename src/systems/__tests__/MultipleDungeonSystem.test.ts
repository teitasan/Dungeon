/**
 * Tests for MultipleDungeonSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MultipleDungeonSystem } from '../MultipleDungeonSystem';
import { DungeonManager } from '../../dungeon/DungeonManager';
import { PlayerEntity } from '../../entities/Player';

describe('MultipleDungeonSystem', () => {
  let multipleDungeonSystem: MultipleDungeonSystem;
  let dungeonManager: DungeonManager;
  let player: PlayerEntity;

  beforeEach(() => {
    dungeonManager = new DungeonManager();
    multipleDungeonSystem = new MultipleDungeonSystem(dungeonManager);
    
    // Create player
    player = new PlayerEntity('player-1', 'Hero', { x: 0, y: 0 });
    player.stats.level = 1;
    player.stats.experience = 0;
    (player as any).gold = 0;
  });

  it('should initialize with default dungeons', () => {
    const allDungeons = multipleDungeonSystem.getAllDungeons();
    
    expect(allDungeons.length).toBe(5);
    
    const dungeonIds = allDungeons.map(d => d.id);
    expect(dungeonIds).toContain('beginner-cave');
    expect(dungeonIds).toContain('mystic-forest');
    expect(dungeonIds).toContain('ancient-ruins');
    expect(dungeonIds).toContain('demon-tower');
    expect(dungeonIds).toContain('void-abyss');
  });

  it('should have beginner cave unlocked by default', () => {
    const unlockedDungeons = multipleDungeonSystem.getUnlockedDungeons(player);
    
    expect(unlockedDungeons.length).toBe(1);
    expect(unlockedDungeons[0].id).toBe('beginner-cave');
    
    expect(multipleDungeonSystem.isDungeonUnlocked('beginner-cave', player)).toBe(true);
    expect(multipleDungeonSystem.isDungeonUnlocked('mystic-forest', player)).toBe(false);
  });

  it('should get dungeon by ID', () => {
    const beginnerCave = multipleDungeonSystem.getDungeon('beginner-cave');
    
    expect(beginnerCave).toBeDefined();
    expect(beginnerCave!.name).toBe('Beginner Cave');
    expect(beginnerCave!.difficulty).toBe('easy');
    expect(beginnerCave!.maxFloors).toBe(5);
    
    const nonExistent = multipleDungeonSystem.getDungeon('non-existent');
    expect(nonExistent).toBeUndefined();
  });

  it('should select and enter unlocked dungeon', () => {
    const result = multipleDungeonSystem.selectDungeon('beginner-cave', player);
    
    expect(result.success).toBe(true);
    expect(result.canEnter).toBe(true);
    expect(result.dungeon).toBeDefined();
    expect(result.message).toContain('Entered');
    
    const currentInfo = multipleDungeonSystem.getCurrentDungeonInfo();
    expect(currentInfo.isActive).toBe(true);
    expect(currentInfo.dungeon!.id).toBe('beginner-cave');
    expect(currentInfo.floor).toBe(1);
  });

  it('should fail to select locked dungeon', () => {
    const result = multipleDungeonSystem.selectDungeon('mystic-forest', player);
    
    expect(result.success).toBe(false);
    expect(result.canEnter).toBe(false);
    expect(result.message).toContain('not unlocked');
  });

  it('should fail to select dungeon with insufficient level', () => {
    // Manually unlock mystic forest but keep player at level 1
    const progress = multipleDungeonSystem.getPlayerProgress('mystic-forest');
    progress.isUnlocked = true;
    
    const result = multipleDungeonSystem.selectDungeon('mystic-forest', player);
    
    expect(result.success).toBe(false);
    expect(result.canEnter).toBe(false);
    expect(result.message).toContain('Requires level');
  });

  it('should fail to select non-existent dungeon', () => {
    const result = multipleDungeonSystem.selectDungeon('non-existent', player);
    
    expect(result.success).toBe(false);
    expect(result.canEnter).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('should advance floors in dungeon', () => {
    // Enter beginner cave
    multipleDungeonSystem.selectDungeon('beginner-cave', player);
    
    // Advance to floor 2
    const result = multipleDungeonSystem.advanceFloor(player);
    
    expect(result.success).toBe(true);
    expect(result.newFloor).toBe(2);
    expect(result.isCompleted).toBe(false);
    expect(result.message).toContain('Advanced to floor 2');
    
    const currentInfo = multipleDungeonSystem.getCurrentDungeonInfo();
    expect(currentInfo.floor).toBe(2);
  });

  it('should complete dungeon when reaching max floors', () => {
    // Enter beginner cave
    multipleDungeonSystem.selectDungeon('beginner-cave', player);
    
    // Advance through all floors (5 floors total)
    for (let i = 2; i <= 5; i++) {
      const result = multipleDungeonSystem.advanceFloor(player);
      expect(result.isCompleted).toBe(false);
    }
    
    // Advance past final floor should complete dungeon
    const completionResult = multipleDungeonSystem.advanceFloor(player);
    
    expect(completionResult.success).toBe(true);
    expect(completionResult.isCompleted).toBe(true);
    expect(completionResult.message).toContain('Completed');
    
    // Should no longer be in dungeon
    const currentInfo = multipleDungeonSystem.getCurrentDungeonInfo();
    expect(currentInfo.isActive).toBe(false);
    
    // Progress should be updated
    const progress = multipleDungeonSystem.getPlayerProgress('beginner-cave');
    expect(progress.isCompleted).toBe(true);
    expect(progress.completionCount).toBe(1);
    expect(progress.bestFloor).toBe(5);
  });

  it('should unlock new dungeons after completion', () => {
    // Complete beginner cave
    multipleDungeonSystem.selectDungeon('beginner-cave', player);
    for (let i = 2; i <= 6; i++) {
      multipleDungeonSystem.advanceFloor(player);
    }
    
    // Mystic forest should now be unlocked
    expect(multipleDungeonSystem.isDungeonUnlocked('mystic-forest', player)).toBe(true);
    
    const unlockedDungeons = multipleDungeonSystem.getUnlockedDungeons(player);
    expect(unlockedDungeons.length).toBe(2);
    expect(unlockedDungeons.map(d => d.id)).toContain('mystic-forest');
  });

  it('should handle dungeon exit scenarios', () => {
    // Enter beginner cave and advance a few floors
    multipleDungeonSystem.selectDungeon('beginner-cave', player);
    multipleDungeonSystem.advanceFloor(player);
    multipleDungeonSystem.advanceFloor(player);
    
    // Exit due to death
    const exitResult = multipleDungeonSystem.exitDungeon(player, 'death');
    
    expect(exitResult.success).toBe(true);
    expect(exitResult.floorReached).toBe(3);
    expect(exitResult.message).toContain('defeated');
    
    // Should no longer be in dungeon
    const currentInfo = multipleDungeonSystem.getCurrentDungeonInfo();
    expect(currentInfo.isActive).toBe(false);
    
    // Progress should be updated
    const progress = multipleDungeonSystem.getPlayerProgress('beginner-cave');
    expect(progress.bestFloor).toBe(3);
    expect(progress.isCompleted).toBe(false);
  });

  it('should handle exit when no active dungeon', () => {
    const exitResult = multipleDungeonSystem.exitDungeon(player, 'quit');
    
    expect(exitResult.success).toBe(false);
    expect(exitResult.message).toContain('No active dungeon');
  });

  it('should handle advance floor when no active dungeon', () => {
    const result = multipleDungeonSystem.advanceFloor(player);
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('No active dungeon');
  });

  it('should track player progress correctly', () => {
    const initialProgress = multipleDungeonSystem.getPlayerProgress('beginner-cave');
    expect(initialProgress.totalAttempts).toBe(0);
    expect(initialProgress.bestFloor).toBe(0);
    
    // Enter dungeon
    multipleDungeonSystem.selectDungeon('beginner-cave', player);
    expect(initialProgress.totalAttempts).toBe(1);
    
    // Advance floors
    multipleDungeonSystem.advanceFloor(player);
    multipleDungeonSystem.advanceFloor(player);
    expect(initialProgress.bestFloor).toBe(3);
    
    // Exit and re-enter
    multipleDungeonSystem.exitDungeon(player, 'escape');
    multipleDungeonSystem.selectDungeon('beginner-cave', player);
    expect(initialProgress.totalAttempts).toBe(2);
  });

  it('should check unlock conditions correctly', () => {
    // Level requirement
    player.stats.level = 4;
    expect(multipleDungeonSystem.isDungeonUnlocked('mystic-forest', player)).toBe(false);
    
    // Complete beginner cave
    const beginnerProgress = multipleDungeonSystem.getPlayerProgress('beginner-cave');
    beginnerProgress.isCompleted = true;
    
    player.stats.level = 5;
    expect(multipleDungeonSystem.isDungeonUnlocked('mystic-forest', player)).toBe(true);
  });

  it('should provide dungeon statistics', () => {
    const initialStats = multipleDungeonSystem.getDungeonStats();
    expect(initialStats.totalDungeons).toBe(5);
    expect(initialStats.unlockedCount).toBe(1);
    expect(initialStats.completedCount).toBe(0);
    
    // Complete a dungeon
    const progress = multipleDungeonSystem.getPlayerProgress('beginner-cave');
    progress.isCompleted = true;
    progress.completionCount = 2;
    progress.totalAttempts = 3;
    
    const updatedStats = multipleDungeonSystem.getDungeonStats();
    expect(updatedStats.completedCount).toBe(1);
    expect(updatedStats.totalCompletions).toBe(2);
    expect(updatedStats.totalAttempts).toBe(3);
  });

  it('should reset progress correctly', () => {
    // Make some progress
    multipleDungeonSystem.selectDungeon('beginner-cave', player);
    multipleDungeonSystem.advanceFloor(player);
    
    const progress = multipleDungeonSystem.getPlayerProgress('beginner-cave');
    expect(progress.totalAttempts).toBe(1);
    expect(progress.bestFloor).toBe(2);
    
    // Reset
    multipleDungeonSystem.resetProgress();
    
    // Should be back to initial state
    const currentInfo = multipleDungeonSystem.getCurrentDungeonInfo();
    expect(currentInfo.isActive).toBe(false);
    
    const resetProgress = multipleDungeonSystem.getPlayerProgress('beginner-cave');
    expect(resetProgress.isUnlocked).toBe(true); // Should still be unlocked
    expect(resetProgress.totalAttempts).toBe(0);
    expect(resetProgress.bestFloor).toBe(0);
  });

  it('should handle complex unlock chains', () => {
    // Set up player to meet level requirements
    player.stats.level = 25;
    
    // Complete dungeons in sequence
    const beginnerProgress = multipleDungeonSystem.getPlayerProgress('beginner-cave');
    beginnerProgress.isCompleted = true;
    
    const forestProgress = multipleDungeonSystem.getPlayerProgress('mystic-forest');
    forestProgress.isCompleted = true;
    
    const ruinsProgress = multipleDungeonSystem.getPlayerProgress('ancient-ruins');
    ruinsProgress.isCompleted = true;
    
    const towerProgress = multipleDungeonSystem.getPlayerProgress('demon-tower');
    towerProgress.isCompleted = true;
    
    // All dungeons should be unlocked
    expect(multipleDungeonSystem.isDungeonUnlocked('mystic-forest', player)).toBe(true);
    expect(multipleDungeonSystem.isDungeonUnlocked('ancient-ruins', player)).toBe(true);
    expect(multipleDungeonSystem.isDungeonUnlocked('demon-tower', player)).toBe(true);
    expect(multipleDungeonSystem.isDungeonUnlocked('void-abyss', player)).toBe(true);
    
    const unlockedDungeons = multipleDungeonSystem.getUnlockedDungeons(player);
    expect(unlockedDungeons.length).toBe(5);
  });

  it('should handle all player progress operations', () => {
    const allProgress = multipleDungeonSystem.getAllPlayerProgress();
    expect(allProgress.size).toBeGreaterThanOrEqual(1); // At least beginner cave
    
    // Add progress for multiple dungeons
    multipleDungeonSystem.getPlayerProgress('mystic-forest');
    multipleDungeonSystem.getPlayerProgress('ancient-ruins');
    
    const updatedProgress = multipleDungeonSystem.getAllPlayerProgress();
    expect(updatedProgress.size).toBe(3);
    expect(updatedProgress.has('beginner-cave')).toBe(true);
    expect(updatedProgress.has('mystic-forest')).toBe(true);
    expect(updatedProgress.has('ancient-ruins')).toBe(true);
  });

  it('should handle different exit reasons', () => {
    multipleDungeonSystem.selectDungeon('beginner-cave', player);
    
    const escapeResult = multipleDungeonSystem.exitDungeon(player, 'escape');
    expect(escapeResult.message).toContain('escaped');
    
    multipleDungeonSystem.selectDungeon('beginner-cave', player);
    const quitResult = multipleDungeonSystem.exitDungeon(player, 'quit');
    expect(quitResult.message).toContain('quit');
  });
});