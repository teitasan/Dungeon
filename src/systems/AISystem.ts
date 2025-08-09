/**
 * AI system for managing enemy and companion behavior
 */

import { GameEntity } from '../types/entities';
import { MonsterEntity } from '../entities/Monster';
import { CompanionEntity } from '../entities/Companion';
import { PlayerEntity } from '../entities/Player';
import { Position } from '../types/core';
import { DungeonManager } from '../dungeon/DungeonManager';
import { MovementSystem } from './MovementSystem';
import { CombatSystem } from './CombatSystem';
import { TurnSystem } from './TurnSystem';

// AI behavior types
export type AIBehaviorType = 
  | 'aggressive' 
  | 'defensive' 
  | 'passive' 
  | 'patrol' 
  | 'guard' 
  | 'follow' 
  | 'flee' 
  | 'random';

// AI action types
export type AIActionType = 'move' | 'attack' | 'wait' | 'use-item' | 'special';

// AI decision result
export interface AIDecision {
  action: AIActionType;
  target?: GameEntity;
  position?: Position;
  data?: any;
  priority: number;
}

// AI behavior configuration
export interface AIBehaviorConfig {
  type: AIBehaviorType;
  aggroRange: number;
  attackRange: number;
  fleeThreshold: number; // HP percentage to start fleeing
  patrolRadius: number;
  followDistance: number;
  decisionCooldown: number;
}

// AI state
export interface AIState {
  target?: GameEntity;
  lastKnownTargetPosition?: Position;
  homePosition: Position;
  patrolPoints: Position[];
  currentPatrolIndex: number;
  aggroLevel: number;
  lastDecisionTime: number;
  behaviorOverride?: AIBehaviorType;
}

export class AISystem {
  private dungeonManager: DungeonManager;
  private movementSystem: MovementSystem;
  private combatSystem: CombatSystem;
  private turnSystem: TurnSystem;
  private aiStates: Map<string, AIState> = new Map();
  private behaviorConfigs: Map<string, AIBehaviorConfig> = new Map();

  constructor(
    dungeonManager: DungeonManager,
    movementSystem: MovementSystem,
    combatSystem: CombatSystem,
    turnSystem: TurnSystem
  ) {
    this.dungeonManager = dungeonManager;
    this.movementSystem = movementSystem;
    this.combatSystem = combatSystem;
    this.turnSystem = turnSystem;
    this.initializeDefaultBehaviors();
  }

  /**
   * Process AI for an entity
   */
  processAI(entity: GameEntity): AIDecision | null {
    if (!this.hasAISupport(entity)) {
      return null;
    }

    const aiType = this.getAIType(entity);
    const config = this.behaviorConfigs.get(aiType);
    if (!config) {
      return null;
    }

    const state = this.getOrCreateAIState(entity);
    
    // Check decision cooldown
    const currentTime = Date.now();
    if (currentTime - state.lastDecisionTime < config.decisionCooldown) {
      return { action: 'wait', priority: 0 };
    }

    state.lastDecisionTime = currentTime;

    // Get behavior type (check for override)
    const behaviorType = state.behaviorOverride || config.type;

    // Make decision based on behavior
    const decision = this.makeDecision(entity, config, state, behaviorType);
    
    // Update AI state based on decision
    this.updateAIState(entity, state, decision);

    return decision;
  }

  /**
   * Make AI decision based on behavior type
   */
  private makeDecision(
    entity: GameEntity,
    config: AIBehaviorConfig,
    state: AIState,
    behaviorType: AIBehaviorType
  ): AIDecision {
    switch (behaviorType) {
      case 'aggressive':
        return this.makeAggressiveDecision(entity, config, state);
      case 'defensive':
        return this.makeDefensiveDecision(entity, config, state);
      case 'passive':
        return this.makePassiveDecision(entity, config, state);
      case 'patrol':
        return this.makePatrolDecision(entity, config, state);
      case 'guard':
        return this.makeGuardDecision(entity, config, state);
      case 'follow':
        return this.makeFollowDecision(entity, config, state);
      case 'flee':
        return this.makeFleeDecision(entity, config, state);
      case 'random':
        return this.makeRandomDecision(entity, config, state);
      default:
        return { action: 'wait', priority: 0 };
    }
  }

  /**
   * Aggressive AI behavior
   */
  private makeAggressiveDecision(
    entity: GameEntity,
    config: AIBehaviorConfig,
    state: AIState
  ): AIDecision {
    // Find nearest enemy
    const target = this.findNearestEnemy(entity, config.aggroRange);
    
    if (target) {
      state.target = target;
      state.lastKnownTargetPosition = target.position;
      
      const distance = this.getDistance(entity.position, target.position);
      
      // Attack if in range
      if (distance <= config.attackRange && this.combatSystem.canAttack(entity, target)) {
        return {
          action: 'attack',
          target,
          priority: 10
        };
      }
      
      // Move towards target
      const movePosition = this.getNextMoveTowards(entity.position, target.position);
      if (movePosition) {
        return {
          action: 'move',
          position: movePosition,
          priority: 8
        };
      }
    }
    
    // No target found, wait or patrol
    return { action: 'wait', priority: 1 };
  }

  /**
   * Defensive AI behavior
   */
  private makeDefensiveDecision(
    entity: GameEntity,
    config: AIBehaviorConfig,
    state: AIState
  ): AIDecision {
    // Check if being attacked
    const nearbyEnemies = this.findNearbyEnemies(entity, config.aggroRange);
    
    if (nearbyEnemies.length > 0) {
      const target = nearbyEnemies[0];
      const distance = this.getDistance(entity.position, target.position);
      
      // Attack if enemy is very close
      if (distance <= config.attackRange && this.combatSystem.canAttack(entity, target)) {
        return {
          action: 'attack',
          target,
          priority: 9
        };
      }
      
      // Move away from enemy if too close
      if (distance < config.followDistance) {
        const fleePosition = this.getFleePosition(entity.position, target.position);
        if (fleePosition) {
          return {
            action: 'move',
            position: fleePosition,
            priority: 7
          };
        }
      }
    }
    
    // Return to home position if far away
    const homeDistance = this.getDistance(entity.position, state.homePosition);
    if (homeDistance > config.patrolRadius) {
      const movePosition = this.getNextMoveTowards(entity.position, state.homePosition);
      if (movePosition) {
        return {
          action: 'move',
          position: movePosition,
          priority: 5
        };
      }
    }
    
    return { action: 'wait', priority: 1 };
  }

  /**
   * Follow AI behavior (for companions)
   */
  private makeFollowDecision(
    entity: GameEntity,
    config: AIBehaviorConfig,
    state: AIState
  ): AIDecision {
    // Find player to follow
    const player = this.findPlayer();
    if (!player) {
      return { action: 'wait', priority: 1 };
    }
    
    const distance = this.getDistance(entity.position, player.position);
    
    // Attack nearby enemies if companion is in attack mode
    if (entity instanceof CompanionEntity && entity.behaviorMode === 'attack') {
      const nearbyEnemies = this.findNearbyEnemies(entity, config.aggroRange);
      if (nearbyEnemies.length > 0) {
        const target = nearbyEnemies[0];
        const targetDistance = this.getDistance(entity.position, target.position);
        
        if (targetDistance <= config.attackRange && this.combatSystem.canAttack(entity, target)) {
          return {
            action: 'attack',
            target,
            priority: 9
          };
        }
      }
    }
    
    // Follow player if too far
    if (distance > config.followDistance) {
      const movePosition = this.getNextMoveTowards(entity.position, player.position);
      if (movePosition) {
        return {
          action: 'move',
          position: movePosition,
          priority: 6
        };
      }
    }
    
    // Stay close but not too close
    if (distance < 2) {
      const positions = this.dungeonManager.getAdjacentPositions(player.position);
      const validPositions = positions.filter(pos => 
        this.dungeonManager.isWalkable(pos) && 
        this.dungeonManager.getEntitiesAt(pos).length === 0
      );
      
      if (validPositions.length > 0) {
        return {
          action: 'move',
          position: validPositions[0],
          priority: 4
        };
      }
    }
    
    return { action: 'wait', priority: 1 };
  }

  /**
   * Passive AI behavior
   */
  private makePassiveDecision(
    entity: GameEntity,
    config: AIBehaviorConfig,
    state: AIState
  ): AIDecision {
    // Only react if directly attacked
    const stats = (entity as any).stats;
    if (stats && stats.hp < stats.maxHp * 0.8) {
      // Find attacker and flee
      const nearbyEnemies = this.findNearbyEnemies(entity, config.aggroRange);
      if (nearbyEnemies.length > 0) {
        const fleePosition = this.getFleePosition(entity.position, nearbyEnemies[0].position);
        if (fleePosition) {
          return {
            action: 'move',
            position: fleePosition,
            priority: 8
          };
        }
      }
    }
    
    return { action: 'wait', priority: 1 };
  }

  /**
   * Patrol AI behavior
   */
  private makePatrolDecision(
    entity: GameEntity,
    config: AIBehaviorConfig,
    state: AIState
  ): AIDecision {
    // Check for enemies first
    const target = this.findNearestEnemy(entity, config.aggroRange);
    if (target) {
      const distance = this.getDistance(entity.position, target.position);
      if (distance <= config.attackRange && this.combatSystem.canAttack(entity, target)) {
        return {
          action: 'attack',
          target,
          priority: 10
        };
      }
    }
    
    // Continue patrol
    if (state.patrolPoints.length > 0) {
      const currentTarget = state.patrolPoints[state.currentPatrolIndex];
      const distance = this.getDistance(entity.position, currentTarget);
      
      if (distance <= 1) {
        // Reached patrol point, move to next
        state.currentPatrolIndex = (state.currentPatrolIndex + 1) % state.patrolPoints.length;
      }
      
      const movePosition = this.getNextMoveTowards(entity.position, currentTarget);
      if (movePosition) {
        return {
          action: 'move',
          position: movePosition,
          priority: 5
        };
      }
    }
    
    return { action: 'wait', priority: 1 };
  }

  /**
   * Guard AI behavior
   */
  private makeGuardDecision(
    entity: GameEntity,
    config: AIBehaviorConfig,
    state: AIState
  ): AIDecision {
    // Attack enemies in range
    const target = this.findNearestEnemy(entity, config.aggroRange);
    if (target) {
      const distance = this.getDistance(entity.position, target.position);
      if (distance <= config.attackRange && this.combatSystem.canAttack(entity, target)) {
        return {
          action: 'attack',
          target,
          priority: 10
        };
      }
    }
    
    // Return to guard position if too far
    const homeDistance = this.getDistance(entity.position, state.homePosition);
    if (homeDistance > 2) {
      const movePosition = this.getNextMoveTowards(entity.position, state.homePosition);
      if (movePosition) {
        return {
          action: 'move',
          position: movePosition,
          priority: 6
        };
      }
    }
    
    return { action: 'wait', priority: 1 };
  }

  /**
   * Flee AI behavior
   */
  private makeFleeDecision(
    entity: GameEntity,
    config: AIBehaviorConfig,
    state: AIState
  ): AIDecision {
    const nearbyEnemies = this.findNearbyEnemies(entity, config.aggroRange);
    
    if (nearbyEnemies.length > 0) {
      // Flee from nearest enemy
      const fleePosition = this.getFleePosition(entity.position, nearbyEnemies[0].position);
      if (fleePosition) {
        return {
          action: 'move',
          position: fleePosition,
          priority: 9
        };
      }
    }
    
    return { action: 'wait', priority: 1 };
  }

  /**
   * Random AI behavior
   */
  private makeRandomDecision(
    entity: GameEntity,
    config: AIBehaviorConfig,
    state: AIState
  ): AIDecision {
    const randomPos = this.getRandomAdjacentPosition(entity.position) || undefined;
    const actions: AIDecision[] = [
      { action: 'wait', priority: 3 },
      { action: 'move', position: randomPos, priority: 2 }
    ];
    
    // Sometimes attack if enemies nearby
    const nearbyEnemies = this.findNearbyEnemies(entity, config.attackRange);
    if (nearbyEnemies.length > 0 && Math.random() < 0.3) {
      actions.push({
        action: 'attack',
        target: nearbyEnemies[0],
        priority: 5
      });
    }
    
    // Return random action
    return actions[Math.floor(Math.random() * actions.length)];
  }

  /**
   * Find nearest enemy
   */
  private findNearestEnemy(entity: GameEntity, range: number): GameEntity | null {
    const enemies = this.findNearbyEnemies(entity, range);
    if (enemies.length === 0) return null;
    
    return enemies.reduce((nearest, enemy) => {
      const nearestDistance = this.getDistance(entity.position, nearest.position);
      const enemyDistance = this.getDistance(entity.position, enemy.position);
      return enemyDistance < nearestDistance ? enemy : nearest;
    });
  }

  /**
   * Find nearby enemies
   */
  private findNearbyEnemies(entity: GameEntity, range: number): GameEntity[] {
    const allEntities = this.dungeonManager.getAllEntities();
    const enemies: GameEntity[] = [];
    
    for (const other of allEntities) {
      if (this.isEnemy(entity, other)) {
        const distance = this.getDistance(entity.position, other.position);
        if (distance <= range) {
          enemies.push(other);
        }
      }
    }
    
    return enemies;
  }

  /**
   * Check if two entities are enemies
   */
  private isEnemy(entity1: GameEntity, entity2: GameEntity): boolean {
    const type1 = entity1.constructor.name;
    const type2 = entity2.constructor.name;
    
    // Monsters attack players and companions
    if (type1 === 'MonsterEntity') {
      return type2 === 'PlayerEntity' || type2 === 'CompanionEntity';
    }
    
    // Players and companions attack monsters
    if (type1 === 'PlayerEntity' || type1 === 'CompanionEntity') {
      return type2 === 'MonsterEntity';
    }
    
    return false;
  }

  /**
   * Find player entity
   */
  private findPlayer(): PlayerEntity | null {
    const allEntities = this.dungeonManager.getAllEntities();
    return allEntities.find(e => e instanceof PlayerEntity) as PlayerEntity || null;
  }

  /**
   * Get next move towards target
   */
  private getNextMoveTowards(from: Position, to: Position): Position | null {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    
    const candidates = [
      { x: from.x + dx, y: from.y + dy }, // Diagonal
      { x: from.x + dx, y: from.y },     // Horizontal
      { x: from.x, y: from.y + dy }      // Vertical
    ];
    
    for (const pos of candidates) {
      if (this.dungeonManager.isWalkable(pos) && 
          this.dungeonManager.getEntitiesAt(pos).length === 0) {
        return pos;
      }
    }
    
    return null;
  }

  /**
   * Get flee position away from threat
   */
  private getFleePosition(from: Position, threat: Position): Position | null {
    const dx = from.x - threat.x;
    const dy = from.y - threat.y;
    
    // Normalize direction
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return null;
    
    const fleeX = Math.round(dx / length);
    const fleeY = Math.round(dy / length);
    
    const fleePos = { x: from.x + fleeX, y: from.y + fleeY };
    
    if (this.dungeonManager.isWalkable(fleePos) && 
        this.dungeonManager.getEntitiesAt(fleePos).length === 0) {
      return fleePos;
    }
    
    return null;
  }

  /**
   * Get random adjacent position
   */
  private getRandomAdjacentPosition(from: Position): Position | null {
    const adjacent = this.dungeonManager.getAdjacentPositions(from);
    const walkable = adjacent.filter(pos => 
      this.dungeonManager.isWalkable(pos) && 
      this.dungeonManager.getEntitiesAt(pos).length === 0
    );
    
    if (walkable.length === 0) return null;
    
    return walkable[Math.floor(Math.random() * walkable.length)];
  }

  /**
   * Calculate distance between positions
   */
  private getDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  /**
   * Get or create AI state for entity
   */
  private getOrCreateAIState(entity: GameEntity): AIState {
    let state = this.aiStates.get(entity.id);
    
    if (!state) {
      state = {
        homePosition: { ...entity.position },
        patrolPoints: [],
        currentPatrolIndex: 0,
        aggroLevel: 0,
        lastDecisionTime: 0
      };
      this.aiStates.set(entity.id, state);
    }
    
    return state;
  }

  /**
   * Update AI state based on decision
   */
  private updateAIState(entity: GameEntity, state: AIState, decision: AIDecision): void {
    if (decision.target) {
      state.target = decision.target;
      state.lastKnownTargetPosition = decision.target.position;
    }
  }

  /**
   * Check if entity has AI support
   */
  private hasAISupport(entity: GameEntity): boolean {
    return 'aiType' in entity;
  }

  /**
   * Get AI type from entity
   */
  private getAIType(entity: GameEntity): string {
    return (entity as any).aiType || 'passive';
  }

  /**
   * Register AI behavior configuration
   */
  registerBehavior(aiType: string, config: AIBehaviorConfig): void {
    this.behaviorConfigs.set(aiType, config);
  }

  /**
   * Set behavior override for entity
   */
  setBehaviorOverride(entity: GameEntity, behavior: AIBehaviorType): void {
    const state = this.getOrCreateAIState(entity);
    state.behaviorOverride = behavior;
  }

  /**
   * Clear behavior override for entity
   */
  clearBehaviorOverride(entity: GameEntity): void {
    const state = this.aiStates.get(entity.id);
    if (state) {
      state.behaviorOverride = undefined;
    }
  }

  /**
   * Initialize default AI behaviors
   */
  private initializeDefaultBehaviors(): void {
    // Basic hostile monster
    this.registerBehavior('basic-hostile', {
      type: 'aggressive',
      aggroRange: 5,
      attackRange: 1,
      fleeThreshold: 0.2,
      patrolRadius: 3,
      followDistance: 2,
      decisionCooldown: 500
    });

    // Defensive monster
    this.registerBehavior('defensive', {
      type: 'defensive',
      aggroRange: 3,
      attackRange: 1,
      fleeThreshold: 0.3,
      patrolRadius: 2,
      followDistance: 3,
      decisionCooldown: 600
    });

    // Companion follow
    this.registerBehavior('companion-follow', {
      type: 'follow',
      aggroRange: 4,
      attackRange: 1,
      fleeThreshold: 0.1,
      patrolRadius: 0,
      followDistance: 3,
      decisionCooldown: 400
    });

    // Passive creature
    this.registerBehavior('passive-neutral', {
      type: 'passive',
      aggroRange: 2,
      attackRange: 1,
      fleeThreshold: 0.5,
      patrolRadius: 1,
      followDistance: 0,
      decisionCooldown: 1000
    });
  }
}