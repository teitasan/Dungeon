import { ConfigLoader } from './core/ConfigLoader.js';
import { ComponentSystem } from './core/ComponentSystem.js';
/**
 * Main game class that orchestrates the component system and configuration
 */
export class Game {
    configLoader;
    componentSystem;
    gameConfig = null;
    gameState;
    currentTurn = 0;
    constructor(configPath) {
        this.configLoader = new ConfigLoader(configPath);
        this.componentSystem = new ComponentSystem();
        this.gameState = {
            entities: []
        };
    }
    /**
     * Initialize the game
     */
    async initialize() {
        try {
            // Load game configuration
            this.gameConfig = await this.configLoader.loadGameConfig();
            console.log('Game configuration loaded successfully');
            // Initialize component system with default components
            this.initializeDefaultComponents();
            console.log('Game initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize game:', error);
            throw error;
        }
    }
    /**
     * Get current game context
     */
    getGameContext() {
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
    getConfig() {
        if (!this.gameConfig) {
            throw new Error('Game not initialized - call initialize() first');
        }
        return this.gameConfig;
    }
    /**
     * Get component system
     */
    getComponentSystem() {
        return this.componentSystem;
    }
    /**
     * Get configuration loader
     */
    getConfigLoader() {
        return this.configLoader;
    }
    /**
     * Advance game turn
     */
    nextTurn() {
        this.currentTurn++;
    }
    /**
     * Reset game state
     */
    reset() {
        this.currentTurn = 0;
        this.gameState = {
            entities: []
        };
    }
    /**
     * Initialize default components (placeholder for now)
     */
    initializeDefaultComponents() {
        // This will be expanded in later tasks when we implement specific components
        console.log('Default components initialized');
    }
}
//# sourceMappingURL=Game.js.map