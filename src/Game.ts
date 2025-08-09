import { ConfigLoader } from './core/ConfigLoader.js';
import { ComponentSystem } from './core/ComponentSystem.js';
import { GameConfig, GameContext, GameState } from './types/core.js';

/**
 * Main game class that orchestrates the component system and configuration
 */
export class Game {
  private configLoader: ConfigLoader;
  private componentSystem: ComponentSystem;
  private gameConfig: GameConfig | null = null;
  private gameState: GameState;
  private currentTurn: number = 0;

  constructor(configPath?: string) {
    this.configLoader = new ConfigLoader(configPath);
    this.componentSystem = new ComponentSystem();
    this.gameState = {
      entities: []
    };
  }

  /**
   * Initialize the game
   */
  async initialize(): Promise<void> {
    try {
      // Load game configuration
      this.gameConfig = await this.configLoader.loadGameConfig();
      console.log('Game configuration loaded successfully');

      // Initialize component system with default components
      this.initializeDefaultComponents();

      console.log('Game initialized successfully');
    } catch (error) {
      console.error('Failed to initialize game:', error);
      throw error;
    }
  }

  /**
   * Get current game context
   */
  getGameContext(): GameContext {
    if (!this.gameConfig) {
      throw new Error('Game not initialized - call initialize() first');
    }

    return {
      currentTurn: this.currentTurn,
      gameState: this.gameState,
      config: this.gameConfig
    };
  }

  /**
   * Get game configuration
   */
  getConfig(): GameConfig {
    if (!this.gameConfig) {
      throw new Error('Game not initialized - call initialize() first');
    }
    return this.gameConfig;
  }

  /**
   * Get component system
   */
  getComponentSystem(): ComponentSystem {
    return this.componentSystem;
  }

  /**
   * Get configuration loader
   */
  getConfigLoader(): ConfigLoader {
    return this.configLoader;
  }

  /**
   * Advance game turn
   */
  nextTurn(): void {
    this.currentTurn++;
  }

  /**
   * Reset game state
   */
  reset(): void {
    this.currentTurn = 0;
    this.gameState = {
      entities: []
    };
  }

  /**
   * Initialize default components (placeholder for now)
   */
  private initializeDefaultComponents(): void {
    // This will be expanded in later tasks when we implement specific components
    console.log('Default components initialized');
  }
}