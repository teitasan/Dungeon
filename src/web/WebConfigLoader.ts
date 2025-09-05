import type { GameConfig } from '../types/core.js';

/**
 * Web環境用の設定ローダー
 * ブラウザ環境でfetch APIを使用して設定ファイルを読み込む
 * 複数の設定ファイルを統合してGameConfigを構築する
 */
export class WebConfigLoader {
  private configCache: Map<string, any> = new Map();
  private basePath: string;

  constructor(basePath?: string) {
    // Use Vite's base to resolve the correct root on GitHub Pages
    const viteBase = (import.meta as any).env?.BASE_URL || '/';
    this.basePath = basePath ?? (viteBase.replace(/\/$/, '') + '/config');
  }

  /**
   * メインゲーム設定を読み込み（複数ファイルを統合）
   */
  async loadGameConfig(): Promise<GameConfig> {
    const configKey = 'game-config';
    
    if (this.configCache.has(configKey)) {
      return this.configCache.get(configKey);
    }

    try {
      // 複数の設定ファイルを並行読み込み
      const [
        dungeonConfig,
        charactersConfig,
        itemsConfig,
        effectsConfig,
        systemConfig
      ] = await Promise.all([
        this.loadConfigFile('dungeon.json'),
        this.loadConfigFile('characters.json'),
        this.loadConfigFile('items.json'),
        this.loadConfigFile('effects.json'),
        this.loadConfigFile('system.json')
      ]);

      // 設定を統合
      const config: GameConfig = {
        ...systemConfig,
        dungeon: dungeonConfig,
        player: charactersConfig.player,
        monsters: charactersConfig.monsters,
        items: itemsConfig,
        attributes: effectsConfig.attributes,
        combat: {
          ...systemConfig.combat,
          statusEffects: effectsConfig.statusEffects
        }
      };

      const validatedConfig = this.validateGameConfig(config);
      this.configCache.set(configKey, validatedConfig);
      return validatedConfig;
    } catch (error) {
      console.error('Failed to load game configuration:', error);
      throw new Error('設定ファイルの読み込みに失敗しました。設定ファイルが正しく配置されているか確認してください。');
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
      const config = await response.json();
      return config;
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
    const requiredSections = ['player', 'combat', 'dungeon', 'items', 'monsters', 'attributes', 'ui', 'turnSystem'];
    
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

    // プレイヤー設定の検証
    if (!config.player.initialStats || !config.player.levelUpConfig) {
      throw new Error('Invalid player configuration structure');
    }

    // モンスター設定の検証
    if (!config.monsters.templates || !config.monsters.spritesheets) {
      throw new Error('Invalid monsters configuration structure');
    }

    return config as GameConfig;
  }


}
