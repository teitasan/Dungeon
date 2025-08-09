import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentSystem } from '../ComponentSystem.js';
import { ComponentRegistry } from '../ComponentRegistry.js';
import { BaseComponent } from '../Component.js';
import { ComponentConfig, GameContext, ComponentResult } from '../../types/core.js';

// Test components
class SuccessComponent extends BaseComponent {
  constructor(id: string, config: ComponentConfig) {
    super(id, 'movement', config);
  }

  execute(context: GameContext): ComponentResult {
    return this.createSuccessResult('Success component executed');
  }
}

class FailureComponent extends BaseComponent {
  constructor(id: string, config: ComponentConfig) {
    super(id, 'movement', config);
  }

  execute(context: GameContext): ComponentResult {
    return this.createFailureResult('Failure component failed');
  }
}

class ErrorComponent extends BaseComponent {
  constructor(id: string, config: ComponentConfig) {
    super(id, 'movement', config);
  }

  execute(context: GameContext): ComponentResult {
    throw new Error('Component execution error');
  }
}

describe('ComponentSystem', () => {
  let componentSystem: ComponentSystem;
  let registry: ComponentRegistry;
  let gameContext: GameContext;

  beforeEach(() => {
    componentSystem = new ComponentSystem();
    registry = componentSystem.getRegistry();
    registry.clearFactories();
    registry.clearComponents();

    gameContext = {
      currentTurn: 1,
      gameState: { entities: [] },
      config: {} as any
    };

    // Register test component factories
    registry.registerComponentFactory('movement', (id, config) => {
      if (config.type === 'success') return new SuccessComponent(id, config);
      if (config.type === 'failure') return new FailureComponent(id, config);
      if (config.type === 'error') return new ErrorComponent(id, config);
      return new SuccessComponent(id, config);
    });
  });

  it('should execute single component successfully', () => {
    const component = registry.createComponent('movement', 'test-success', { type: 'success' });
    const result = componentSystem.executeComponent(component, gameContext);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Success component executed');
  });

  it('should handle component execution errors', () => {
    const component = registry.createComponent('movement', 'test-error', { type: 'error' });
    const result = componentSystem.executeComponent(component, gameContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Component execution failed');
  });

  it('should execute multiple components', () => {
    const component1 = registry.createComponent('movement', 'test-success-1', { type: 'success' });
    const component2 = registry.createComponent('movement', 'test-success-2', { type: 'success' });

    const results = componentSystem.executeComponents([component1, component2], gameContext);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });

  it('should execute components by type', () => {
    registry.createComponent('movement', 'test-movement-1', { type: 'success' });
    registry.createComponent('movement', 'test-movement-2', { type: 'success' });

    const results = componentSystem.executeComponentsByType('movement', gameContext);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });

  it('should set and use execution order', () => {
    const component1 = registry.createComponent('movement', 'test-second', { type: 'success', order: 2 });
    const component2 = registry.createComponent('movement', 'test-first', { type: 'success', order: 1 });

    componentSystem.setExecutionOrder('test-first', 1);
    componentSystem.setExecutionOrder('test-second', 2);

    const sortedComponents = componentSystem.sortComponentsByOrder([component1, component2]);

    expect(sortedComponents[0].id).toBe('test-first');
    expect(sortedComponents[1].id).toBe('test-second');
  });

  it('should execute components with error recovery', () => {
    const component1 = registry.createComponent('movement', 'test-success', { type: 'success' });
    const component2 = registry.createComponent('movement', 'test-failure', { type: 'failure' });
    const component3 = registry.createComponent('movement', 'test-success-2', { type: 'success' });

    let errorCallbackCalled = false;
    const onError = (component: any, error: any) => {
      errorCallbackCalled = true;
      return true; // Continue execution
    };

    const results = componentSystem.executeComponentsWithRecovery(
      [component1, component2, component3],
      gameContext,
      onError
    );

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);
    expect(errorCallbackCalled).toBe(true);
  });

  it('should stop execution on error recovery callback returning false', () => {
    const component1 = registry.createComponent('movement', 'test-success', { type: 'success' });
    const component2 = registry.createComponent('movement', 'test-failure', { type: 'failure' });
    const component3 = registry.createComponent('movement', 'test-success-2', { type: 'success' });

    const onError = (component: any, error: any) => {
      return false; // Stop execution
    };

    const results = componentSystem.executeComponentsWithRecovery(
      [component1, component2, component3],
      gameContext,
      onError
    );

    expect(results).toHaveLength(2); // Should stop after failure
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });

  it('should handle unexpected errors in error recovery', () => {
    const component = registry.createComponent('movement', 'test-error', { type: 'error' });

    const results = componentSystem.executeComponentsWithRecovery([component], gameContext);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].message).toContain('Component execution failed');
  });
});