import { GameConfig } from '../types/core.js';
/**
 * Configuration loader that handles loading and validating game configuration files
 * Implements requirement 9.4: All game actions, values, and rules managed by config files
 */
export declare class ConfigLoader {
    private configCache;
    private configPath;
    constructor(configPath?: string);
    /**
     * Load the main game configuration
     */
    loadGameConfig(): Promise<GameConfig>;
    /**
     * Load a specific configuration file
     */
    loadConfigFile(filename: string): Promise<any>;
    /**
     * Load configuration with fallback to default values
     */
    loadConfigWithDefaults<T>(filename: string, defaultConfig: T): Promise<T>;
    /**
     * Validate game configuration structure
     */
    private validateGameConfig;
    /**
     * Get default game configuration as fallback
     */
    private getDefaultGameConfig;
    /**
     * Clear configuration cache
     */
    clearCache(): void;
    /**
     * Reload configuration from files
     */
    reloadConfig(): Promise<GameConfig>;
}
//# sourceMappingURL=ConfigLoader.d.ts.map