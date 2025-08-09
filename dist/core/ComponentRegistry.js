/**
 * Registry for managing component types and their factories
 * Enables plugin-like addition of new components
 */
export class ComponentRegistry {
    static instance;
    factories = new Map();
    components = new Map();
    constructor() { }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!ComponentRegistry.instance) {
            ComponentRegistry.instance = new ComponentRegistry();
        }
        return ComponentRegistry.instance;
    }
    /**
     * Register a component factory for a specific type
     */
    registerComponentFactory(type, factory) {
        if (this.factories.has(type)) {
            console.warn(`Component factory for type '${type}' is being overridden`);
        }
        this.factories.set(type, factory);
    }
    /**
     * Create a component instance
     */
    createComponent(type, id, config) {
        const factory = this.factories.get(type);
        if (!factory) {
            throw new Error(`No factory registered for component type: ${type}`);
        }
        try {
            const component = factory(id, config);
            this.components.set(id, component);
            return component;
        }
        catch (error) {
            throw new Error(`Failed to create component '${id}' of type '${type}': ${error}`);
        }
    }
    /**
     * Get a component by ID
     */
    getComponent(id) {
        return this.components.get(id);
    }
    /**
     * Get all components of a specific type
     */
    getComponentsByType(type) {
        return Array.from(this.components.values()).filter(component => component.type === type);
    }
    /**
     * Remove a component from the registry
     */
    removeComponent(id) {
        return this.components.delete(id);
    }
    /**
     * Check if a component type is registered
     */
    hasComponentType(type) {
        return this.factories.has(type);
    }
    /**
     * Get all registered component types
     */
    getRegisteredTypes() {
        return Array.from(this.factories.keys());
    }
    /**
     * Clear all components (useful for testing)
     */
    clearComponents() {
        this.components.clear();
    }
    /**
     * Clear all factories (useful for testing)
     */
    clearFactories() {
        this.factories.clear();
    }
    /**
     * Create components from configuration data
     */
    createComponentsFromConfig(componentsConfig) {
        const components = [];
        for (const componentConfig of componentsConfig) {
            try {
                const component = this.createComponent(componentConfig.type, componentConfig.id, componentConfig.config);
                components.push(component);
            }
            catch (error) {
                console.error(`Failed to create component from config:`, componentConfig, error);
            }
        }
        return components;
    }
}
//# sourceMappingURL=ComponentRegistry.js.map