/**
 * AI System - manages AI behavior for monsters
 * Pure ECS implementation: processes entities with AI components
 */

import { System, SystemContext } from '../../core/System.js';
import { ComponentManager } from '../../core/ComponentManager.js';
import { EntityId } from '../../core/Entity.js';
import { AIComponent, AIUtils, AIBehavior, AIState } from '../../components/combat/AI.js';
import { PositionComponent } from '../../components/common/Position.js';
import { HealthComponent } from '../../components/common/Health.js';
import { VelocityComponent, VelocityComponentFactory } from '../../components/movement/Velocity.js';

/**
 * AI action result
 */
export interface AIActionResult {
  entityId: EntityId;
  action: 'move' | 'attack' | 'idle' | 'patrol' | 'chase' | 'flee';
  targetPosition?: { x: number; y: number };
  targetId?: EntityId;
  success: boolean;
  message: string;
}

/**
 * AI System
 */
export class AISystem extends System {
  private currentTime: number = 0;
  private playerPosition: { x: number; y: number } | null = null;

  constructor(componentManager: ComponentManager) {
    // This system processes entities that have AI
    super(componentManager, ['ai', 'position']);
  }

  /**
   * Process AI for entities
   */
  protected process(context: SystemContext, entities: EntityId[]): void {
    this.currentTime = Date.now();
    
    for (const entityId of entities) {
      const ai = this.getComponent<AIComponent>(entityId, 'ai');
      const position = this.getComponent<PositionComponent>(entityId, 'position');
      const health = this.getComponent<HealthComponent>(entityId, 'health');

      if (!ai || !position) continue;

      // Check if AI can act
      if (!AIUtils.canAct(ai, this.currentTime)) continue;

      // Process AI behavior
      const result = this.processAIBehavior(entityId, ai, position, health);
      if (result) {
        this.executeAIAction(entityId, result);
      }
    }
  }

  /**
   * Process AI behavior based on type
   */
  private processAIBehavior(
    entityId: EntityId, 
    ai: AIComponent, 
    position: PositionComponent, 
    health: HealthComponent | undefined
  ): AIActionResult | null {
    // Check if monster should flee (low HP)
    if (health && health.current < health.max * 0.3) {
      return this.processFleeBehavior(entityId, ai, position);
    }

    switch (ai.behavior) {
      case 'passive':
        return this.processPassiveBehavior(entityId, ai, position);
      
      case 'aggressive':
        return this.processAggressiveBehavior(entityId, ai, position);
      
      case 'patrol':
        return this.processPatrolBehavior(entityId, ai, position);
      
      case 'wander':
        return this.processWanderBehavior(entityId, ai, position);
      
      case 'guard':
        return this.processGuardBehavior(entityId, ai, position);
      
      case 'boss':
        return this.processBossBehavior(entityId, ai, position);
      
      default:
        return null;
    }
  }

  /**
   * Process passive behavior
   */
  private processPassiveBehavior(entityId: EntityId, ai: AIComponent, position: PositionComponent): AIActionResult {
    return {
      entityId,
      action: 'idle',
      success: true,
      message: 'Passive monster waits'
    };
  }

  /**
   * Process aggressive behavior
   */
  private processAggressiveBehavior(entityId: EntityId, ai: AIComponent, position: PositionComponent): AIActionResult {
    if (!this.playerPosition) {
      return {
        entityId,
        action: 'idle',
        success: true,
        message: 'No player to chase'
      };
    }

    const distance = this.calculateDistance(position, this.playerPosition);
    
    if (distance <= 1) {
      // Close enough to attack
      return {
        entityId,
        action: 'attack',
        targetId: 'player-1', // Assuming player ID
        success: true,
        message: 'Monster attacks player'
      };
    } else if (distance <= 8) {
      // Chase player
      const direction = this.calculateDirection(position, this.playerPosition);
      const targetPos = {
        x: position.x + direction.x,
        y: position.y + direction.y
      };
      
      return {
        entityId,
        action: 'chase',
        targetPosition: targetPos,
        targetId: 'player-1',
        success: true,
        message: 'Monster chases player'
      };
    }

    return {
      entityId,
      action: 'idle',
      success: true,
      message: 'Player too far to chase'
    };
  }

  /**
   * Process patrol behavior
   */
  private processPatrolBehavior(entityId: EntityId, ai: AIComponent, position: PositionComponent): AIActionResult {
    if (!ai.patrolPoints || ai.patrolPoints.length === 0) {
      return {
        entityId,
        action: 'idle',
        success: false,
        message: 'No patrol points defined'
      };
    }

    const currentPoint = AIUtils.getCurrentPatrolPoint(ai);
    if (!currentPoint) {
      return {
        entityId,
        action: 'idle',
        success: false,
        message: 'Invalid patrol point'
      };
    }

    const distance = this.calculateDistance(position, currentPoint);
    
    if (distance <= 1) {
      // Move to next patrol point
      const newAI = AIUtils.nextPatrolPoint(ai);
      this.componentManager.removeComponent(entityId, 'ai');
      this.componentManager.addComponent(entityId, newAI);
      
      return {
        entityId,
        action: 'patrol',
        success: true,
        message: 'Moving to next patrol point'
      };
    } else {
      // Move towards current patrol point
      const direction = this.calculateDirection(position, currentPoint);
      const targetPos = {
        x: position.x + direction.x,
        y: position.y + direction.y
      };
      
      return {
        entityId,
        action: 'move',
        targetPosition: targetPos,
        success: true,
        message: 'Moving to patrol point'
      };
    }
  }

  /**
   * Process wander behavior
   */
  private processWanderBehavior(entityId: EntityId, ai: AIComponent, position: PositionComponent): AIActionResult {
    // Random movement in 8 directions
    const directions = [
      { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
      { x: -1, y: 0 }, { x: 1, y: 0 },
      { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }
    ];
    
    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    const targetPos = {
      x: position.x + randomDir.x,
      y: position.y + randomDir.y
    };
    
    return {
      entityId,
      action: 'move',
      targetPosition: targetPos,
      success: true,
      message: 'Wandering randomly'
    };
  }

  /**
   * Process guard behavior
   */
  private processGuardBehavior(entityId: EntityId, ai: AIComponent, position: PositionComponent): AIActionResult {
    // Guard behavior: stay in place unless player is very close
    if (this.playerPosition) {
      const distance = this.calculateDistance(position, this.playerPosition);
      if (distance <= 3) {
        // Player is close, become aggressive
        const newAI = AIUtils.updateState(ai, 'chasing');
        this.componentManager.removeComponent(entityId, 'ai');
        this.componentManager.addComponent(entityId, newAI);
        
        return {
          entityId,
          action: 'chase',
          targetId: 'player-1',
          success: true,
          message: 'Guard becomes aggressive'
        };
      }
    }
    
    return {
      entityId,
      action: 'idle',
      success: true,
      message: 'Guarding position'
    };
  }

  /**
   * Process boss behavior
   */
  private processBossBehavior(entityId: EntityId, ai: AIComponent, position: PositionComponent): AIActionResult {
    // Boss behavior: more complex AI patterns
    if (this.playerPosition) {
      const distance = this.calculateDistance(position, this.playerPosition);
      
      if (distance <= 1) {
        return {
          entityId,
          action: 'attack',
          targetId: 'player-1',
          success: true,
          message: 'Boss attacks player'
        };
      } else if (distance <= 5) {
        // Special boss ability or movement
        const direction = this.calculateDirection(position, this.playerPosition);
        const targetPos = {
          x: position.x + direction.x * 2,
          y: position.y + direction.y * 2
        };
        
        return {
          entityId,
          action: 'move',
          targetPosition: targetPos,
          success: true,
          message: 'Boss uses special movement'
        };
      }
    }
    
    return {
      entityId,
      action: 'idle',
      success: true,
      message: 'Boss waits for player'
    };
  }

  /**
   * Process flee behavior
   */
  private processFleeBehavior(entityId: EntityId, ai: AIComponent, position: PositionComponent): AIActionResult {
    if (!this.playerPosition) {
      return {
        entityId,
        action: 'idle',
        success: true,
        message: 'No player to flee from'
      };
    }

    // Move away from player
    const direction = this.calculateDirection(this.playerPosition, position);
    const targetPos = {
      x: position.x + direction.x,
      y: position.y + direction.y
    };
    
    // Update AI state to fleeing
    const newAI = AIUtils.updateState(ai, 'fleeing');
    this.componentManager.removeComponent(entityId, 'ai');
    this.componentManager.addComponent(entityId, newAI);
    
    return {
      entityId,
      action: 'flee',
      targetPosition: targetPos,
      success: true,
      message: 'Monster flees from player'
    };
  }

  /**
   * Execute AI action
   */
  private executeAIAction(entityId: EntityId, result: AIActionResult): void {
    if (result.action === 'move' && result.targetPosition) {
      // Update position
      const newPosition: PositionComponent = {
        id: `position-${entityId}`,
        type: 'position',
        x: result.targetPosition.x,
        y: result.targetPosition.y
      };
      
      this.componentManager.removeComponent(entityId, 'position');
      this.componentManager.addComponent(entityId, newPosition);
      
      // Add velocity for smooth movement
      const velocity = VelocityComponentFactory.create(0, 0);
      this.componentManager.addComponent(entityId, velocity);
    }
    
    // Update AI last action time
    const ai = this.getComponent<AIComponent>(entityId, 'ai');
    if (ai) {
      const newAI = {
        ...ai,
        lastActionTime: this.currentTime
      };
      this.componentManager.removeComponent(entityId, 'ai');
      this.componentManager.addComponent(entityId, newAI);
    }
  }

  /**
   * Set player position for AI targeting
   */
  setPlayerPosition(position: { x: number; y: number }): void {
    this.playerPosition = position;
  }

  /**
   * Calculate distance between two positions
   */
  private calculateDistance(pos1: PositionComponent, pos2: { x: number; y: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate direction from pos1 to pos2
   */
  private calculateDirection(pos1: PositionComponent, pos2: { x: number; y: number }): { x: number; y: number } {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    
    // Normalize to -1, 0, or 1
    return {
      x: dx > 0 ? 1 : dx < 0 ? -1 : 0,
      y: dy > 0 ? 1 : dy < 0 ? -1 : 0
    };
  }

  protected onInitialize(): void {
    console.log('AI System initialized');
  }
}
