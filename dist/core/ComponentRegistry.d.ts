import { Component, ComponentType, ComponentConfig } from '../types/core.js';
/**
 * Component factory function type
 */
export type ComponentFactory = (id: string, config: ComponentConfig) => Component;
/**
 * Registry for managing component types and their factories
 * Enables plugin-like addition of new components
 */
export declare class ComponentRegistry {
    private static instance;
    private factories;
    private components;
    private constructor();
    /**
     * Get the singleton instance
     */
    static getInstance(): ComponentRegistry;
    /**
     * Register a component factory for a specific type
     */
    registerComponentFactory(type: ComponentType, factory: ComponentFactory): void;
    /**
     * Create a component instance
     */
    createComponent(type: ComponentType, id: string, config: ComponentConfig): Component;
    /**
     * Get a component by ID
     */
    getComponent(id: string): Component | undefined;
    /**
     * Get all components of a specific type
     */
    getComponentsByType(type: ComponentType): Component[];
    /**
     * Remove a component from the registry
     */
    removeComponent(id: string): boolean;
    /**
     * Check if a component type is registered
     */
    hasComponentType(type: ComponentType): boolean;
    /**
     * Get all registered component types
     */
    getRegisteredTypes(): ComponentType[];
    /**
     * Clear all components (useful for testing)
     */
    clearComponents(): void;
    /**
     * Clear all factories (useful for testing)
     */
    clearFactories(): void;
    /**
     * Create components from configuration data
     */
    createComponentsFromConfig(componentsConfig: Array<{
        id: string;
        type: ComponentType;
        config: ComponentConfig;
    }>): Component[];
}
//# sourceMappingURL=ComponentRegistry.d.ts.map