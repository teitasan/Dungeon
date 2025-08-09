import { ConfigLoader } from './core/ConfigLoader.js';
import { ComponentSystem } from './core/ComponentSystem.js';
import { GameConfig, GameContext } from './types/core.js';
/**
 * Main game class that orchestrates the component system and configuration
 */
export declare class Game {
    private configLoader;
    private componentSystem;
    private gameConfig;
    private gameState;
    private currentTurn;
    constructor(configPath?: string);
    /**
     * Initialize the game
     */
    initialize(): Promise<void>;
    /**
     * Get current game context
     */
    getGameContext(): GameContext;
    /**
     * Get game configuration
     */
    getConfig(): GameConfig;
    /**
     * Get component system
     */
    getComponentSystem(): ComponentSystem;
    /**
     * Get configuration loader
     */
    getConfigLoader(): ConfigLoader;
    /**
     * Advance game turn
     */
    nextTurn(): void;
    /**
     * Reset game state
     */
    reset(): void;
    /**
     * Initialize default components (placeholder for now)
     */
    private initializeDefaultComponents;
}
//# sourceMappingURL=Game.d.ts.map