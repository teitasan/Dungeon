import { Component, ComponentConfig, ComponentResult, ComponentType, GameContext } from '../types/core.js';

/**
 * Base abstract class for all game components
 * Implements requirement 9.5: All game actions as replaceable components
 */
export abstract class BaseComponent implements Component {
  public readonly id: string;
  public readonly type: ComponentType;
  public readonly config: ComponentConfig;

  constructor(id: string, type: ComponentType, config: ComponentConfig) {
    this.id = id;
    this.type = type;
    this.config = { ...config }; // Create a copy to prevent external modification
  }

  /**
   * Execute the component's functionality
   * Must be implemented by concrete component classes
   */
  abstract execute(context: GameContext): ComponentResult;

  /**
   * Validate component configuration
   * Override in concrete classes for specific validation
   */
  protected validateConfig(): boolean {
    return this.config !== null && this.config !== undefined;
  }

  /**
   * Get a configuration value with optional default
   */
  protected getConfigValue<T>(key: string, defaultValue?: T): T {
    return this.config[key] !== undefined ? this.config[key] : defaultValue!;
  }

  /**
   * Create a success result
   */
  protected createSuccessResult(message?: string, data?: any): ComponentResult {
    return {
      success: true,
      message,
      data
    };
  }

  /**
   * Create a failure result
   */
  protected createFailureResult(message: string, data?: any): ComponentResult {
    return {
      success: false,
      message,
      data
    };
  }
}