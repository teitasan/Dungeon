import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../Game.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('Game', () => {
  const testConfigPath = './test-game-config';
  let game: Game;

  beforeEach(() => {
    // Clean up and create test config directory
    try {
      rmSync(testConfigPath, { recursive: true, force: true });
    } catch {}
    mkdirSync(testConfigPath, { recursive: true });

    // Create a minimal valid config
    const testConfig = {
      player: {
        initialStats: { hp: 100, maxHp: 100, attack: 10, defense: 5, evasionRate: 0.05 },
        levelUpConfig: { experienceTable: [100], statGrowthRates: { hp: 1.1, attack: 1.2, defense: 1.2 }, maxLevel: 100 },
        hungerConfig: { maxValue: 100, decreaseRate: 1, minValue: 0, damageAmount: 5, recoveryAmount: 20, maxOverfeedTime: 10 },
        movementConfig: { distance: 1, directions: ['up', 'down', 'left', 'right'], restrictions: [] }
      },
      combat: {
        baseDamageFormula: 'test',
        minDamage: 1,
        randomRange: { min: 0.875, max: 1.125 },
        defenseReductionBase: 0.97,
        attackMultiplier: 1.3,
        criticalChance: 0.05,
        criticalEffect: 'defense-ignore',
        criticalFormula: 'test',
        evasionEnabled: true,
        baseEvasionRate: 0.05,
        evasionEffect: 'damage-zero',
        evasionTiming: 'pre-damage',
        unavoidableAttackFlag: false,
        statusEffects: {},
        attributeDamageEnabled: true
      },
      dungeon: {},
      items: {},
      monsters: {},
      attributes: {
        availableAttributes: [],
        compatibilityMatrix: {},
        damageMultipliers: { disadvantage: 0.8, neutral: 1.0, advantage: 1.2 },
        applicationTiming: 'final'
      }
    };

    writeFileSync(join(testConfigPath, 'game.json'), JSON.stringify(testConfig));
    
    game = new Game(testConfigPath);
  });

  afterEach(() => {
    // Clean up test config directory
    try {
      rmSync(testConfigPath, { recursive: true, force: true });
    } catch {}
  });

  it('should initialize successfully', async () => {
    await game.initialize();
    
    const config = game.getConfig();
    expect(config).toBeDefined();
    expect(config.player.initialStats.hp).toBe(100);
  });

  it('should throw error when getting config before initialization', () => {
    expect(() => game.getConfig()).toThrow('Game not initialized');
  });

  it('should throw error when getting context before initialization', () => {
    expect(() => game.getGameContext()).toThrow('Game not initialized');
  });

  it('should provide game context after initialization', async () => {
    await game.initialize();
    
    const context = game.getGameContext();
    expect(context).toBeDefined();
    expect(context.currentTurn).toBe(0);
    expect(context.gameState).toBeDefined();
    expect(context.config).toBeDefined();
  });

  it('should advance turns correctly', async () => {
    await game.initialize();
    
    expect(game.getGameContext().currentTurn).toBe(0);
    
    game.nextTurn();
    expect(game.getGameContext().currentTurn).toBe(1);
    
    game.nextTurn();
    expect(game.getGameContext().currentTurn).toBe(2);
  });

  it('should reset game state', async () => {
    await game.initialize();
    
    game.nextTurn();
    game.nextTurn();
    expect(game.getGameContext().currentTurn).toBe(2);
    
    game.reset();
    expect(game.getGameContext().currentTurn).toBe(0);
    expect(game.getGameContext().gameState.entities).toHaveLength(0);
  });

  it('should provide access to component system', async () => {
    await game.initialize();
    
    const componentSystem = game.getComponentSystem();
    expect(componentSystem).toBeDefined();
    expect(componentSystem.getRegistry()).toBeDefined();
  });

  it('should provide access to config loader', async () => {
    await game.initialize();
    
    const configLoader = game.getConfigLoader();
    expect(configLoader).toBeDefined();
  });

  it('should handle initialization errors', async () => {
    // Create game with invalid config path
    const invalidGame = new Game('./non-existent-path');
    
    // Should not throw, but use default config
    await invalidGame.initialize();
    
    const config = invalidGame.getConfig();
    expect(config).toBeDefined();
    expect(config.player.initialStats.hp).toBe(100); // Default value
  });
});