import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentRegistry } from '../ComponentRegistry.js';
import { BaseComponent } from '../Component.js';
import { ComponentConfig, GameContext, ComponentResult } from '../../types/core.js';

// Test component implementation
class TestMovementComponent extends BaseComponent {
  constructor(id: string, config: ComponentConfig) {
    super(id, 'movement', config);
  }

  execute(context: GameContext): ComponentResult {
    return this.createSuccessResult('Movement executed');
  }
}

class TestAttackComponent extends BaseComponent {
  constructor(id: string, config: ComponentConfig) {
    super(id, 'attack-range', config);
  }

  execute(context: GameContext): ComponentResult {
    return this.createSuccessResult('Attack executed');
  }
}

describe('ComponentRegistry', () => {
  let registry: ComponentRegistry;

  beforeEach(() => {
    // Get a fresh instance and clear it
    registry = ComponentRegistry.getInstance();
    registry.clearFactories();
    registry.clearComponents();
  });

  it('should be a singleton', () => {
    const registry1 = ComponentRegistry.getInstance();
    const registry2 = ComponentRegistry.getInstance();
    expect(registry1).toBe(registry2);
  });

  it('should register and create components', () => {
    registry.registerComponentFactory('movement', (id, config) => new TestMovementComponent(id, config));

    const component = registry.createComponent('movement', 'test-movement', { speed: 1 });
    
    expect(component).toBeDefined();
    expect(component.id).toBe('test-movement');
    expect(component.type).toBe('movement');
  });

  it('should throw error for unregistered component type', () => {
    expect(() => {
      registry.createComponent('movement', 'test-movement', {});
    }).toThrow('No factory registered for component type: movement');
  });

  it('should get component by ID', () => {
    registry.registerComponentFactory('movement', (id, config) => new TestMovementComponent(id, config));
    
    const component = registry.createComponent('movement', 'test-movement', {});
    const retrieved = registry.getComponent('test-movement');
    
    expect(retrieved).toBe(component);
  });

  it('should get components by type', () => {
    registry.registerComponentFactory('movement', (id, config) => new TestMovementComponent(id, config));
    registry.registerComponentFactory('attack-range', (id, config) => new TestAttackComponent(id, config));

    registry.createComponent('movement', 'movement-1', {});
    registry.createComponent('movement', 'movement-2', {});
    registry.createComponent('attack-range', 'attack-1', {});

    const movementComponents = registry.getComponentsByType('movement');
    const attackComponents = registry.getComponentsByType('attack-range');

    expect(movementComponents).toHaveLength(2);
    expect(attackComponents).toHaveLength(1);
  });

  it('should remove components', () => {
    registry.registerComponentFactory('movement', (id, config) => new TestMovementComponent(id, config));
    
    registry.createComponent('movement', 'test-movement', {});
    expect(registry.getComponent('test-movement')).toBeDefined();

    const removed = registry.removeComponent('test-movement');
    expect(removed).toBe(true);
    expect(registry.getComponent('test-movement')).toBeUndefined();
  });

  it('should check if component type is registered', () => {
    expect(registry.hasComponentType('movement')).toBe(false);
    
    registry.registerComponentFactory('movement', (id, config) => new TestMovementComponent(id, config));
    
    expect(registry.hasComponentType('movement')).toBe(true);
  });

  it('should get registered types', () => {
    registry.registerComponentFactory('movement', (id, config) => new TestMovementComponent(id, config));
    registry.registerComponentFactory('attack-range', (id, config) => new TestAttackComponent(id, config));

    const types = registry.getRegisteredTypes();
    expect(types).toContain('movement');
    expect(types).toContain('attack-range');
    expect(types).toHaveLength(2);
  });

  it('should create components from config', () => {
    registry.registerComponentFactory('movement', (id, config) => new TestMovementComponent(id, config));
    registry.registerComponentFactory('attack-range', (id, config) => new TestAttackComponent(id, config));

    const componentsConfig = [
      { id: 'movement-1', type: 'movement' as const, config: { speed: 1 } },
      { id: 'attack-1', type: 'attack-range' as const, config: { range: 2 } }
    ];

    const components = registry.createComponentsFromConfig(componentsConfig);
    
    expect(components).toHaveLength(2);
    expect(components[0].id).toBe('movement-1');
    expect(components[1].id).toBe('attack-1');
  });

  it('should handle factory creation errors gracefully', () => {
    registry.registerComponentFactory('movement', (id, config) => {
      throw new Error('Factory error');
    });

    expect(() => {
      registry.createComponent('movement', 'test-movement', {});
    }).toThrow('Failed to create component');
  });

  it('should warn when overriding factory', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    registry.registerComponentFactory('movement', (id, config) => new TestMovementComponent(id, config));
    registry.registerComponentFactory('movement', (id, config) => new TestMovementComponent(id, config));

    expect(consoleSpy).toHaveBeenCalledWith("Component factory for type 'movement' is being overridden");
    
    consoleSpy.mockRestore();
  });
});