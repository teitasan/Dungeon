import { describe, it, expect } from 'vitest';
import { BaseComponent } from '../Component.js';
import { ComponentType, ComponentConfig, GameContext, ComponentResult } from '../../types/core.js';

// Test implementation of BaseComponent
class TestComponent extends BaseComponent {
  constructor(id: string, config: ComponentConfig) {
    super(id, 'movement', config);
  }

  execute(context: GameContext): ComponentResult {
    const testValue = this.getConfigValue<number>('testValue', 0);
    
    if (testValue > 0) {
      return this.createSuccessResult('Test executed successfully', { testValue });
    } else {
      return this.createFailureResult('Test value must be greater than 0');
    }
  }
}

describe('BaseComponent', () => {
  it('should create component with correct properties', () => {
    const config = { testValue: 42 };
    const component = new TestComponent('test-component', config);

    expect(component.id).toBe('test-component');
    expect(component.type).toBe('movement');
    expect(component.config).toEqual(config);
  });

  it('should execute successfully with valid config', () => {
    const config = { testValue: 42 };
    const component = new TestComponent('test-component', config);
    
    const context: GameContext = {
      currentTurn: 1,
      gameState: { entities: [] },
      config: {} as any
    };

    const result = component.execute(context);
    expect(result.success).toBe(true);
    expect(result.data?.testValue).toBe(42);
  });

  it('should fail execution with invalid config', () => {
    const config = { testValue: 0 };
    const component = new TestComponent('test-component', config);
    
    const context: GameContext = {
      currentTurn: 1,
      gameState: { entities: [] },
      config: {} as any
    };

    const result = component.execute(context);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Test value must be greater than 0');
  });

  it('should get config values with defaults', () => {
    const config = { existingValue: 42 };
    const component = new TestComponent('test-component', config);

    // Access protected method through type assertion for testing
    const existingValue = (component as any).getConfigValue('existingValue', 0);
    const defaultValue = (component as any).getConfigValue('nonExistentValue', 100);

    expect(existingValue).toBe(42);
    expect(defaultValue).toBe(100);
  });

  it('should create success and failure results correctly', () => {
    const component = new TestComponent('test-component', {});

    const successResult = (component as any).createSuccessResult('Success message', { data: 'test' });
    const failureResult = (component as any).createFailureResult('Failure message', { error: 'test' });

    expect(successResult.success).toBe(true);
    expect(successResult.message).toBe('Success message');
    expect(successResult.data).toEqual({ data: 'test' });

    expect(failureResult.success).toBe(false);
    expect(failureResult.message).toBe('Failure message');
    expect(failureResult.data).toEqual({ error: 'test' });
  });
});