import { readFileSync } from 'fs';
import { join } from 'path';
import { GameConfig } from '../types/core.js';

/**
 * Configuration loader that handles loading and validating game configuration files
 * Implements requirement 9.4: All game actions, values, and rules managed by config files
 */
export class ConfigLoader {
  private configCache: Map<string, any> = new Map();
  private configPath: string;

  constructor(configPath: string = './config') {
    this.configPath = configPath;
  }

  /**
   * Load the main game configuration
   */
  async loadGameConfig(): Promise<GameConfig> {
    const configKey = 'game-config';
    
    if (this.configCache.has(configKey)) {
      return this.configCache.get(configKey);
    }

    try {
      const config = await this.loadConfigFile('game.json');
      const validatedConfig = this.validateGameConfig(config);
      this.configCache.set(configKey, validatedConfig);
      return validatedConfig;
    } catch (error) {
      console.error('Failed to load game configuration:', error);
      return this.getDefaultGameConfig();
    }
  }

  /**
   * Load a specific configuration file
   */
  async loadConfigFile(filename: string): Promise<any> {
    const filePath = join(this.configPath, filename);
    
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Failed to load config file ${filename}: ${error}`);
    }
  }

  /**
   * Load configuration with fallback to default values
   */
  async loadConfigWithDefaults<T>(filename: string, defaultConfig: T): Promise<T> {
    try {
      const config = await this.loadConfigFile(filename);
      return { ...defaultConfig, ...config };
    } catch (error) {
      console.warn(`Using default config for ${filename}:`, error);
      return defaultConfig;
    }
  }

  /**
   * Validate game configuration structure
   */
  private validateGameConfig(config: any): GameConfig {
    const requiredSections = ['player', 'combat', 'dungeon', 'items', 'monsters', 'attributes', 'ui'];
    
    for (const section of requiredSections) {
      if (!config[section]) {
        throw new Error(`Missing required configuration section: ${section}`);
      }
    }

    // Validate player config
    if (!config.player.initialStats || !config.player.levelUpConfig) {
      throw new Error('Invalid player configuration structure');
    }

    // Validate combat config
    if (typeof config.combat.minDamage !== 'number' || config.combat.minDamage < 1) {
      throw new Error('Combat minDamage must be a number >= 1');
    }

    return config as GameConfig;
  }

  /**
   * Get default game configuration as fallback
   */
  private getDefaultGameConfig(): GameConfig {
    return {
      player: {
        initialStats: {
          hp: 100,
          maxHp: 100,
          attack: 10,
          defense: 5,
          evasionRate: 0.05
        },
        levelUpConfig: {
          experienceTable: Array.from({ length: 100 }, (_, i) => (i + 1) * 100),
          statGrowthRates: {
            hp: 1.1,
            attack: 1.2,
            defense: 1.2
          },
          maxLevel: 100
        },
        hungerConfig: {
          maxValue: 100,
          decreaseRate: 1,
          minValue: 0,
          damageAmount: 5,
          recoveryAmount: 20,
          maxOverfeedTime: 10
        },
        movementConfig: {
          distance: 1,
          directions: ['up', 'down', 'left', 'right'],
          restrictions: []
        }
      },
      combat: {
        baseDamageFormula: '{attack * 1.3 * (35/36)^defense} * random(7/8, 9/8)',
        minDamage: 1,
        randomRange: { min: 0.875, max: 1.125 },
        defenseReductionBase: 35/36,
        attackMultiplier: 1.3,
        criticalChance: 0.05,
        criticalEffect: 'defense-ignore',
        criticalFormula: '{attack * 1.3} * random(7/8, 9/8)',
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
        availableAttributes: [
          { id: 'fire', name: 'Fire', description: 'Fire attribute', color: '#ff0000' },
          { id: 'water', name: 'Water', description: 'Water attribute', color: '#0000ff' },
          { id: 'earth', name: 'Earth', description: 'Earth attribute', color: '#8b4513' },
          { id: 'air', name: 'Air', description: 'Air attribute', color: '#87ceeb' }
        ],
        compatibilityMatrix: {
          fire: { water: 0.8, earth: 1.2, air: 1.0, fire: 1.0 },
          water: { fire: 1.2, earth: 1.0, air: 0.8, water: 1.0 },
          earth: { fire: 0.8, water: 1.0, air: 1.2, earth: 1.0 },
          air: { fire: 1.0, water: 1.2, earth: 0.8, air: 1.0 }
        },
        damageMultipliers: {
          disadvantage: 0.8,
          neutral: 1.0,
          advantage: 1.2
        },
        applicationTiming: 'final'
      },
      ui: {
        fonts: {
          primary: 'PixelMplus',
          secondary: 'PixelMplus12',
          fallback: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
        }
      }
    };
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.configCache.clear();
  }

  /**
   * Reload configuration from files
   */
  async reloadConfig(): Promise<GameConfig> {
    this.clearCache();
    return this.loadGameConfig();
  }
}