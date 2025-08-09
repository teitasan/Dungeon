import { Component, GameContext, ComponentResult } from '../types/core.js';
import { ComponentRegistry } from './ComponentRegistry.js';
/**
 * System for managing and executing components
 * Provides the main interface for component-based game logic
 */
export declare class ComponentSystem {
    private registry;
    private executionOrder;
    constructor();
    /**
     * Execute a single component
     */
    executeComponent(component: Component, context: GameContext): ComponentResult;
    /**
     * Execute multiple components in order
     */
    executeComponents(components: Component[], context: GameContext): ComponentResult[];
    /**
     * Execute components by type
     */
    executeComponentsByType(type: string, context: GameContext): ComponentResult[];
    /**
     * Set execution order for components
     */
    setExecutionOrder(componentId: string, order: number): void;
    /**
     * Sort components by execution order
     */
    sortComponentsByOrder(components: Component[]): Component[];
    /**
     * Check if a component is critical (failure should stop execution)
     */
    private isCriticalComponent;
    /**
     * Get component registry instance
     */
    getRegistry(): ComponentRegistry;
    /**
     * Execute components with error recovery
     */
    executeComponentsWithRecovery(components: Component[], context: GameContext, onError?: (component: Component, error: any) => boolean): ComponentResult[];
}
//# sourceMappingURL=ComponentSystem.d.ts.map