import { Component, ComponentConfig, ComponentResult, ComponentType, GameContext } from '../types/core.js';
/**
 * Base abstract class for all game components
 * Implements requirement 9.5: All game actions as replaceable components
 */
export declare abstract class BaseComponent implements Component {
    readonly id: string;
    readonly type: ComponentType;
    readonly config: ComponentConfig;
    constructor(id: string, type: ComponentType, config: ComponentConfig);
    /**
     * Execute the component's functionality
     * Must be implemented by concrete component classes
     */
    abstract execute(context: GameContext): ComponentResult;
    /**
     * Validate component configuration
     * Override in concrete classes for specific validation
     */
    protected validateConfig(): boolean;
    /**
     * Get a configuration value with optional default
     */
    protected getConfigValue<T>(key: string, defaultValue?: T): T;
    /**
     * Create a success result
     */
    protected createSuccessResult(message?: string, data?: any): ComponentResult;
    /**
     * Create a failure result
     */
    protected createFailureResult(message: string, data?: any): ComponentResult;
}
//# sourceMappingURL=Component.d.ts.map