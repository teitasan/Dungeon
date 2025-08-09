/**
 * Base abstract class for all game components
 * Implements requirement 9.5: All game actions as replaceable components
 */
export class BaseComponent {
    id;
    type;
    config;
    constructor(id, type, config) {
        this.id = id;
        this.type = type;
        this.config = { ...config }; // Create a copy to prevent external modification
    }
    /**
     * Validate component configuration
     * Override in concrete classes for specific validation
     */
    validateConfig() {
        return this.config !== null && this.config !== undefined;
    }
    /**
     * Get a configuration value with optional default
     */
    getConfigValue(key, defaultValue) {
        return this.config[key] !== undefined ? this.config[key] : defaultValue;
    }
    /**
     * Create a success result
     */
    createSuccessResult(message, data) {
        return {
            success: true,
            message,
            data
        };
    }
    /**
     * Create a failure result
     */
    createFailureResult(message, data) {
        return {
            success: false,
            message,
            data
        };
    }
}
//# sourceMappingURL=Component.js.map