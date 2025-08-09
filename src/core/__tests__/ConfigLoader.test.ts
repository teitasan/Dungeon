import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigLoader } from '../ConfigLoader.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('ConfigLoader', () => {
  const testConfigPath = './test-config';
  let configLoader: ConfigLoader;

  beforeEach(() => {
    // Clean up and create test config directory
    try {
      rmSync(testConfigPath, { recursive: true, force: true });
    } catch {}
    mkdirSync(testConfigPath, { recursive: true });
    
    configLoader = new ConfigLoader(testConfigPath);
  });

  afterEach(() => {
    // Clean up test config directory
    try {
      rmSync(testConfigPath, { recursive: true, force: true });
    } catch {}
  });

  it('should load valid game configuration', async () => {
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

    const config = await configLoader.loadGameConfig();
    expect(config).toBeDefined();
    expect(config.player.initialStats.hp).toBe(100);
    expect(config.combat.minDamage).toBe(1);
  });

  it('should return default config when file is missing', async () => {
    const config = await configLoader.loadGameConfig();
    expect(config).toBeDefined();
    expect(config.player.initialStats.hp).toBe(100);
    expect(config.combat.minDamage).toBe(1);
  });

  it('should validate required configuration sections', async () => {
    const invalidConfig = { player: {} }; // Missing required sections
    writeFileSync(join(testConfigPath, 'game.json'), JSON.stringify(invalidConfig));

    const config = await configLoader.loadGameConfig();
    // Should fall back to default config
    expect(config).toBeDefined();
    expect(config.combat).toBeDefined();
  });

  it('should load config with defaults', async () => {
    const partialConfig = { testValue: 42 };
    const defaultConfig = { testValue: 0, defaultValue: 'test' };
    
    writeFileSync(join(testConfigPath, 'test.json'), JSON.stringify(partialConfig));

    const config = await configLoader.loadConfigWithDefaults('test.json', defaultConfig);
    expect(config.testValue).toBe(42);
    expect(config.defaultValue).toBe('test');
  });

  it('should clear and reload cache', async () => {
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

    // Load config first time
    await configLoader.loadGameConfig();
    
    // Clear cache and reload
    configLoader.clearCache();
    const reloadedConfig = await configLoader.reloadConfig();
    
    expect(reloadedConfig).toBeDefined();
  });
});