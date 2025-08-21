import type { GameConfig } from '../types/core.js';

/**
 * Web環境用の設定ローダー
 * ブラウザ環境でfetch APIを使用して設定ファイルを読み込む
 */
export class WebConfigLoader {
  private configCache: Map<string, any> = new Map();
  private basePath: string;

  constructor(basePath: string = '/config') {
    this.basePath = basePath;
  }

  /**
   * メインゲーム設定を読み込み
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
   * 特定の設定ファイルを読み込み
   */
  async loadConfigFile(filename: string): Promise<any> {
    const filePath = `${this.basePath}/${filename}`;
    
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to load config file ${filename}: ${error}`);
    }
  }

  /**
   * 設定をデフォルト値とマージして読み込み
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
   * ゲーム設定の構造を検証
   */
  private validateGameConfig(config: any): GameConfig {
    const requiredSections = ['player', 'combat', 'dungeon', 'items', 'monsters', 'attributes', 'ui'];
    
    for (const section of requiredSections) {
      if (!config[section]) {
        throw new Error(`Missing required configuration section: ${section}`);
      }
    }

    // UI設定の検証
    if (!config.ui.viewport || !config.ui.minimap || !config.ui.layout) {
      throw new Error('Invalid UI configuration structure');
    }

    // 入力設定の検証
    if (!config.input?.keys?.movement || !config.input?.keys?.actions) {
      throw new Error('Invalid input configuration structure');
    }

    return config as GameConfig;
  }

  /**
   * デフォルトゲーム設定を取得（フォールバック用）
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
          experienceTable: [100, 220, 360, 520, 700, 900, 1120, 1360, 1620, 1900],
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
          directions: ["up", "down", "left", "right"],
          restrictions: []
        }
      },
      combat: {
        baseDamageFormula: "{attack * 1.3 * (35/36)^defense} * random(7/8, 9/8)",
        minDamage: 1,
        randomRange: {
          min: 0.875,
          max: 1.125
        },
        defenseReductionBase: 0.9722222222222222,
        attackMultiplier: 1.3,
        criticalChance: 0.05,
        criticalEffect: "defense-ignore",
        criticalFormula: "{attack * 1.3} * random(7/8, 9/8)",
        evasionEnabled: true,
        baseEvasionRate: 0.05,
        evasionEffect: "damage-zero",
        evasionTiming: "pre-damage",
        unavoidableAttackFlag: false,
        statusEffects: {},
        attributeDamageEnabled: true
      },
      dungeon: {
        defaultTileset: {
          imagePath: "/images/base.png",
          tileSize: 32,
          tiles: {
            floor: { x: 1, y: 4, width: 1, height: 1 },
            wall: { x: 1, y: 10, width: 1, height: 1 },
            "stairs-down": { x: 6, y: 51, width: 1, height: 1 },
            "stairs-up": { x: 6, y: 52, width: 1, height: 1 }
          },
          overlay: {
            wall: { x: 1, y: 10, width: 1, height: 1 }
          }
        },
        dungeonSpecificTilesets: {}
      },
      items: {},
      monsters: {},
      attributes: {
        availableAttributes: [],
        compatibilityMatrix: {},
        damageMultipliers: {
          disadvantage: 0.8,
          neutral: 1.0,
          advantage: 1.2
        },
        applicationTiming: "final"
      },
      ui: {
        fonts: {
          primary: "PixelMplus",
          secondary: "PixelMplus12",
          fallback: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        },
        viewport: {
          tilesX: 20,
          tilesY: 10,
          tileSize: 32
        },
        minimap: {
          width: 240,
          height: 160
        },
        layout: {
          maxWidth: 1180,
          gridTemplateColumns: "1fr",
          gridTemplateRows: "auto auto"
        },
        messages: {
          maxLines: 8
        }
      },
      input: {
        keys: {
          movement: {
            up: ["ArrowUp", "w", "W"],
            down: ["ArrowDown", "s", "S"],
            left: ["ArrowLeft", "a", "A"],
            right: ["ArrowRight", "d", "D"]
          },
          actions: {
            confirm: ["z", "Z", "Enter"],
            cancel: ["x", "X", "Escape"],
            inventory: ["i", "I"]
          }
        }
      },
      messages: {
        ui: {
          inventoryOpen: "インベントリを開いた",
          inventoryClose: "インベントリを閉じた",
          cancel: "キャンセル",
          attackMiss: "空振りした",
          stairsConfirmDown: "次の階へ進みますか？",
          stairsConfirmUp: "前の階へ戻りますか？",
          stairsAdvanceDown: "次の階へ進んだ",
          stairsAdvanceUp: "前の階へ戻った",
          stairsDecline: "いいえを選んだ",
          itemUseUnimplemented: "決定: アイテム使用は未実装"
        }
      }
    };
  }
}
