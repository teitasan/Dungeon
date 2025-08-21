/**
 * Pure Component - data only, no logic
 * Implements ECS principle: Component is pure data structure
 */

export type ComponentType = string;

/**
 * Base component interface - pure data only
 * No methods, no logic, just data
 */
export interface Component {
  readonly id: string;
  readonly type: ComponentType;
}

/**
 * Component metadata for type checking and registration
 */
export interface ComponentMetadata {
  readonly type: ComponentType;
  readonly version: number;
  readonly schema: Record<string, any>;
}

/**
 * Component factory for creating components
 */
export class ComponentFactory {
  private static componentTypes = new Map<ComponentType, ComponentMetadata>();

  /**
   * Register a component type
   */
  static registerType(type: ComponentType, metadata: ComponentMetadata): void {
    if (this.componentTypes.has(type)) {
      console.warn(`Component type '${type}' is already registered`);
      return;
    }
    this.componentTypes.set(type, metadata);
  }

  /**
   * Check if a component type is registered
   */
  static isRegistered(type: ComponentType): boolean {
    return this.componentTypes.has(type);
  }

  /**
   * Get component metadata
   */
  static getMetadata(type: ComponentType): ComponentMetadata | undefined {
    return this.componentTypes.get(type);
  }

  /**
   * Get all registered component types
   */
  static getRegisteredTypes(): ComponentType[] {
    return Array.from(this.componentTypes.keys());
  }
}

/**
 * Component utilities
 */
export class ComponentUtils {
  /**
   * Check if an object is a valid component
   */
  static isValid(component: any): component is Component {
    return (
      component &&
      typeof component === 'object' &&
      typeof component.id === 'string' &&
      typeof component.type === 'string'
    );
  }

  /**
   * Get component type from component
   */
  static getType(component: Component): ComponentType {
    return component.type;
  }

  /**
   * Get component ID from component
   */
  static getId(component: Component): string {
    return component.id;
  }
}
