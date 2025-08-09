import { ComponentRegistry } from './ComponentRegistry.js';
/**
 * System for managing and executing components
 * Provides the main interface for component-based game logic
 */
export class ComponentSystem {
    registry;
    executionOrder = new Map();
    constructor() {
        this.registry = ComponentRegistry.getInstance();
    }
    /**
     * Execute a single component
     */
    executeComponent(component, context) {
        try {
            return component.execute(context);
        }
        catch (error) {
            console.error(`Error executing component ${component.id}:`, error);
            return {
                success: false,
                message: `Component execution failed: ${error}`,
                data: { componentId: component.id, error }
            };
        }
    }
    /**
     * Execute multiple components in order
     */
    executeComponents(components, context) {
        const results = [];
        for (const component of components) {
            const result = this.executeComponent(component, context);
            results.push(result);
            // Stop execution if a critical component fails
            if (!result.success && this.isCriticalComponent(component)) {
                console.warn(`Critical component ${component.id} failed, stopping execution`);
                break;
            }
        }
        return results;
    }
    /**
     * Execute components by type
     */
    executeComponentsByType(type, context) {
        const components = this.registry.getComponentsByType(type);
        return this.executeComponents(components, context);
    }
    /**
     * Set execution order for components
     */
    setExecutionOrder(componentId, order) {
        this.executionOrder.set(componentId, order);
    }
    /**
     * Sort components by execution order
     */
    sortComponentsByOrder(components) {
        return components.sort((a, b) => {
            const orderA = this.executionOrder.get(a.id) ?? 0;
            const orderB = this.executionOrder.get(b.id) ?? 0;
            return orderA - orderB;
        });
    }
    /**
     * Check if a component is critical (failure should stop execution)
     */
    isCriticalComponent(component) {
        // Define critical component types that should stop execution on failure
        const criticalTypes = ['dungeon-generator', 'death-system'];
        return criticalTypes.includes(component.type);
    }
    /**
     * Get component registry instance
     */
    getRegistry() {
        return this.registry;
    }
    /**
     * Execute components with error recovery
     */
    executeComponentsWithRecovery(components, context, onError) {
        const results = [];
        for (const component of components) {
            try {
                const result = this.executeComponent(component, context);
                results.push(result);
                if (!result.success) {
                    const shouldContinue = onError ? onError(component, result) : true;
                    if (!shouldContinue) {
                        break;
                    }
                }
            }
            catch (error) {
                const errorResult = {
                    success: false,
                    message: `Unexpected error in component ${component.id}: ${error}`,
                    data: { componentId: component.id, error }
                };
                results.push(errorResult);
                const shouldContinue = onError ? onError(component, error) : true;
                if (!shouldContinue) {
                    break;
                }
            }
        }
        return results;
    }
}
//# sourceMappingURL=ComponentSystem.js.map