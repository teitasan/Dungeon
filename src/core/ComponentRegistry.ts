import { Component, ComponentType, ComponentConfig } from '../types/core.js';
import { BaseComponent } from './Component.js';

/**
 * Component factory function type
 */
export type ComponentFactory = (id: string, config: ComponentConfig) => Component;

/**
 * Registry for managing component types and their factories
 * Enables plugin-like addition of new components
 */
export class ComponentRegistry {
  private static instance: ComponentRegistry;
  private factories: Map<ComponentType, ComponentFactory> = new Map();
  private components: Map<string, Component> = new Map();

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): ComponentRegistry {
    if (!ComponentRegistry.instance) {
      ComponentRegistry.instance = new ComponentRegistry();
    }
    return ComponentRegistry.instance;
  }

  /**
   * Register a component factory for a specific type
   */
  registerComponentFactory(type: ComponentType, factory: ComponentFactory): void {
    if (this.factories.has(type)) {
      console.warn(`Component factory for type '${type}' is being overridden`);
    }
    this.factories.set(type, factory);
  }

  /**
   * Create a component instance
   */
  createComponent(type: ComponentType, id: string, config: ComponentConfig): Component {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`No factory registered for component type: ${type}`);
    }

    try {
      const component = factory(id, config);
      this.components.set(id, component);
      return component;
    } catch (error) {
      throw new Error(`Failed to create component '${id}' of type '${type}': ${error}`);
    }
  }

  /**
   * Get a component by ID
   */
  getComponent(id: string): Component | undefined {
    return this.components.get(id);
  }

  /**
   * Get all components of a specific type
   */
  getComponentsByType(type: ComponentType): Component[] {
    return Array.from(this.components.values()).filter(component => component.type === type);
  }

  /**
   * Remove a component from the registry
   */
  removeComponent(id: string): boolean {
    return this.components.delete(id);
  }

  /**
   * Check if a component type is registered
   */
  hasComponentType(type: ComponentType): boolean {
    return this.factories.has(type);
  }

  /**
   * Get all registered component types
   */
  getRegisteredTypes(): ComponentType[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Clear all components (useful for testing)
   */
  clearComponents(): void {
    this.components.clear();
  }

  /**
   * Clear all factories (useful for testing)
   */
  clearFactories(): void {
    this.factories.clear();
  }

  /**
   * Create components from configuration data
   */
  createComponentsFromConfig(componentsConfig: Array<{
    id: string;
    type: ComponentType;
    config: ComponentConfig;
  }>): Component[] {
    const components: Component[] = [];

    for (const componentConfig of componentsConfig) {
      try {
        const component = this.createComponent(
          componentConfig.type,
          componentConfig.id,
          componentConfig.config
        );
        components.push(component);
      } catch (error) {
        console.error(`Failed to create component from config:`, componentConfig, error);
      }
    }

    return components;
  }
}