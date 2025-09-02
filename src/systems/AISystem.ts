/**
 * AI system for managing enemy and companion behavior
 */

import { GameEntity } from '../types/entities';
import { MonsterEntity } from '../entities/Monster';
import { CompanionEntity } from '../entities/Companion';
import { PlayerEntity } from '../entities/Player';
import { ItemEntity } from '../entities/Item';
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
  lastDecision: AIDecision | null; // 前回の決定をキャッシュ
  lastTurnProcessed?: number; // 最後に処理したターン番号
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
    // エンティティの生存チェック
    if (!this.isEntityAlive(entity)) {
      console.log(`[AISystem] 死亡エンティティ${entity.id}のAI処理をスキップ`);
      return null;
    }

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
      
      console.log(`[AI] ${entity.id}: ターゲット発見 ${target.id} (距離: ${distance})`);
      
      // Attack if in range
      const inRange = this.isInAttackRange(entity, target);
      const canAttack = this.combatSystem.canAttack(entity, target);
      console.log(`[AI] ${entity.id}: 攻撃判定 - 範囲内: ${inRange}, 攻撃可能: ${canAttack}, 距離: ${distance}`);
      
      if (inRange && canAttack) {
        console.log(`[AI] ${entity.id}: 攻撃実行 (距離: ${distance})`);
        // 攻撃決定をAI状態に保存
        state.lastDecision = {
          action: 'attack',
          target,
          priority: 10
        };
        return state.lastDecision;
      } else if (inRange && !canAttack) {
        console.log(`[AI] ${entity.id}: 範囲内だが攻撃できない - 理由を調査`);
      } else if (!inRange) {
        console.log(`[AI] ${entity.id}: 攻撃範囲外 - 現在(${entity.position.x},${entity.position.y}), 目標(${target.position.x},${target.position.y})`);
        
        // 一時的に元の判定も試す
        if (distance <= config.attackRange && canAttack) {
          console.log(`[AI] ${entity.id}: 元の判定で攻撃実行 (距離: ${distance})`);
          // 攻撃決定をAI状態に保存
          state.lastDecision = {
            action: 'attack',
            target,
            priority: 10
          };
          return state.lastDecision;
        }
      }
      
      // Move towards target
      const movePosition = this.getNextMoveTowards(entity.position, target.position);
      if (movePosition) {
        console.log(`[AI] ${entity.id}: プレイヤーに向かって移動 (${entity.position.x},${entity.position.y}) -> (${movePosition.x},${movePosition.y})`);
        return {
          action: 'move',
          position: movePosition,
          priority: 8
        };
      } else {
        console.log(`[AI] ${entity.id}: 移動先が見つからない - 現在位置(${entity.position.x},${entity.position.y}), 目標(${target.position.x},${target.position.y})`);
        // 移動できない理由を調査
        this.debugMoveFailure(entity.position, target.position);
        
        // 移動できない場合は待機（攻撃の準備）
        return { action: 'wait', priority: 5 };
      }
    } else {
      console.log(`[AI] ${entity.id}: ターゲットが見つからない (範囲: ${config.aggroRange})`);
    }
    
    // No target found, wait or patrol
    if (entity instanceof MonsterEntity) {
      // 敵の場合は、ターゲットが見つからなくてもランダムに移動
      const randomPos = this.getRandomAdjacentPosition(entity.position);
      if (randomPos) {
        console.log(`[AI] ${entity.id}: ターゲットなし、ランダム移動 (${entity.position.x},${entity.position.y}) -> (${randomPos.x},${randomPos.y})`);
        return {
          action: 'move',
          position: randomPos,
          priority: 3
        };
      }
    }
    
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
        this.isPositionAvailableForMovement(pos)
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
   * Debug move failure reasons
   */
  private debugMoveFailure(from: Position, to: Position): void {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    
    console.log(`[AI DEBUG] 移動失敗調査:`);
    console.log(`  - 現在位置: (${from.x}, ${from.y})`);
    console.log(`  - 目標位置: (${to.x}, ${to.y})`);
    console.log(`  - 方向: dx=${dx}, dy=${dy}`);
    
    // 各候補位置をチェック
    const candidates = [
      { x: from.x + dx, y: from.y + dy, name: '対角線' },
      { x: from.x + dx, y: from.y, name: '水平' },
      { x: from.x, y: from.y + dy, name: '垂直' }
    ];
    
    for (const pos of candidates) {
      const isWalkable = this.dungeonManager.isWalkable(pos);
      const entitiesAt = this.dungeonManager.getEntitiesAt(pos);
      console.log(`  - ${pos.name}位置(${pos.x}, ${pos.y}): 歩行可能=${isWalkable}, エンティティ数=${entitiesAt.length}`);
    }
  }

  /**
   * Check if position is available for movement (アイテムは通過可能)
   */
  private isPositionAvailableForMovement(pos: Position): boolean {
    const entitiesAt = this.dungeonManager.getEntitiesAt(pos);
    const blockingEntities = entitiesAt.filter(e => !(e instanceof ItemEntity));
    return blockingEntities.length === 0;
  }

  /**
   * Get next move towards target (simplified version)
   */
  private getNextMoveTowards(from: Position, to: Position): Position | null {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    
    // より効率的な移動のため、対角線移動を優先
    const candidates = [
      { x: from.x + dx, y: from.y + dy }, // Diagonal (優先)
      { x: from.x + dx, y: from.y },      // Horizontal
      { x: from.x, y: from.y + dy }       // Vertical
    ];
    
    for (const pos of candidates) {
      if (this.dungeonManager.isWalkable(pos) && 
          this.isPositionAvailableForMovement(pos)) {
        return pos;
      }
    }
    
    // 対角線移動ができない場合、単方向移動を試す
    if (dx !== 0) {
      const horizontalPos = { x: from.x + dx, y: from.y };
      if (this.dungeonManager.isWalkable(horizontalPos) && 
          this.isPositionAvailableForMovement(horizontalPos)) {
        return horizontalPos;
      }
    }
    
    if (dy !== 0) {
      const verticalPos = { x: from.x, y: from.y + dy };
      if (this.dungeonManager.isWalkable(verticalPos) && 
          this.isPositionAvailableForMovement(verticalPos)) {
        return verticalPos;
      }
    }
    
    return null;
  }

  /**
   * Get entities within specified range from position
   */
  private getEntitiesInRange(position: Position, range: number): GameEntity[] {
    const entities: GameEntity[] = [];
    
    for (let y = position.y - range; y <= position.y + range; y++) {
      for (let x = position.x - range; x <= position.x + range; x++) {
        const pos = { x, y };
        if (this.dungeonManager.isValidPosition(pos)) {
          const entitiesAtPos = this.dungeonManager.getEntitiesAt(pos);
          entities.push(...entitiesAtPos);
        }
      }
    }
    
    return entities;
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
        this.isPositionAvailableForMovement(fleePos)) {
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
      this.isPositionAvailableForMovement(pos)
    );
    
    if (walkable.length === 0) return null;
    
    return walkable[Math.floor(Math.random() * walkable.length)];
  }

  /**
   * Check if two entities are in attack range (adjacent including diagonal, but not through corners)
   */
  private isInAttackRange(entity1: GameEntity, entity2: GameEntity): boolean {
    const pos1 = entity1.position;
    const pos2 = entity2.position;
    
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    
    // 隣接判定: 上下左右(距離1) + 斜め(距離√2 ≈ 1.414)
    const isAdjacent = dx <= 1 && dy <= 1 && (dx + dy > 0); // 同じ位置は除外
    
    if (!isAdjacent) {
      console.log(`[AI DEBUG] 攻撃範囲判定: (${pos1.x},${pos1.y}) -> (${pos2.x},${pos2.y}), dx=${dx}, dy=${dy}, 結果=false (隣接していない)`);
      return false;
    }
    
    // 斜め隣接の場合、角を挟んでいないかチェック
    if (dx === 1 && dy === 1) {
      // 斜め隣接の場合、角の位置が歩行可能かチェック
      // 敵とプレイヤーの間の角をチェック
      const cornerPos1 = { x: pos1.x, y: pos2.y };
      const cornerPos2 = { x: pos2.x, y: pos1.y };
      
      const isCorner1Walkable = this.dungeonManager.isWalkable(cornerPos1);
      const isCorner2Walkable = this.dungeonManager.isWalkable(cornerPos2);
      
      // 両方の角が歩行可能でなければ攻撃禁止
      if (!isCorner1Walkable || !isCorner2Walkable) {
        const blockedCorner = !isCorner1Walkable ? cornerPos1 : cornerPos2;
        console.log(`[AI DEBUG] 攻撃範囲判定: (${pos1.x},${pos1.y}) -> (${pos2.x},${pos2.y}), 角(${blockedCorner.x},${blockedCorner.y})が歩行不可のため攻撃禁止`);
        return false;
      }
    }
    
    console.log(`[AI DEBUG] 攻撃範囲判定: (${pos1.x},${pos1.y}) -> (${pos2.x},${pos2.y}), dx=${dx}, dy=${dy}, 結果=true (攻撃可能)`);
    return true;
  }

  /**
   * Calculate distance between positions
   */
  private getDistance(pos1: Position, pos2: Position): number {
    // ユークリッド距離を使用（より正確）
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Update monster direction based on player position (for movement)
   */
  private updateMonsterDirection(monster: MonsterEntity, from: Position, to: Position): void {
    // プレイヤーの位置を取得
    const player = this.findPlayer();
    if (!player) {
      // プレイヤーが見つからない場合は移動方向で決定
      const deltaX = to.x - from.x;
      const deltaY = to.y - from.y;
      
      if (deltaX === 0 && deltaY > 0) {
        monster.currentDirection = 'front';
      } else if (deltaX === 0 && deltaY < 0) {
        monster.currentDirection = 'back';
      } else if (deltaX > 0 && deltaY === 0) {
        monster.currentDirection = 'right';
      } else if (deltaX < 0 && deltaY === 0) {
        monster.currentDirection = 'left';
      } else if (deltaX > 0 && deltaY > 0) {
        monster.currentDirection = 'se';
      } else if (deltaX < 0 && deltaY > 0) {
        monster.currentDirection = 'sw';
      } else if (deltaX > 0 && deltaY < 0) {
        monster.currentDirection = 'ne';
      } else if (deltaX < 0 && deltaY < 0) {
        monster.currentDirection = 'nw';
      }
      return;
    }
    
    // プレイヤーへの相対位置で向きを決定
    const deltaX = player.position.x - to.x;
    const deltaY = player.position.y - to.y;
    
    if (deltaX === 0 && deltaY > 0) {
      monster.currentDirection = 'front';      // プレイヤーが南（下）
    } else if (deltaX === 0 && deltaY < 0) {
      monster.currentDirection = 'back';       // プレイヤーが北（上）
    } else if (deltaX > 0 && deltaY === 0) {
      monster.currentDirection = 'right';      // プレイヤーが東（右）
    } else if (deltaX < 0 && deltaY === 0) {
      monster.currentDirection = 'left';       // プレイヤーが西（左）
    } else if (deltaX > 0 && deltaY > 0) {
      monster.currentDirection = 'se';         // プレイヤーが南東
    } else if (deltaX < 0 && deltaY > 0) {
      monster.currentDirection = 'sw';         // プレイヤーが南西
    } else if (deltaX > 0 && deltaY < 0) {
      monster.currentDirection = 'ne';         // プレイヤーが北東
    } else if (deltaX < 0 && deltaY < 0) {
      monster.currentDirection = 'nw';         // プレイヤーが北西
    }
    
    console.log(`[AISystem] 敵${monster.id}の向きを更新: ${monster.currentDirection} プレイヤー(${player.position.x},${player.position.y}) -> 敵(${to.x},${to.y})`);
    console.log(`[AISystem] 方向計算詳細: deltaX=${deltaX}, deltaY=${deltaY}`);
  }

  /**
   * Update monster direction to face player (for in-place rotation)
   */
  public updateMonsterDirectionForPlayer(monster: MonsterEntity): void {
    // エンティティの生存チェック
    if (!this.isEntityAlive(monster)) {
      console.log(`[AISystem] 死亡エンティティ${monster.id}の向き更新をスキップ`);
      return;
    }

    const player = this.findPlayer();
    if (!player) return;
    
    // プレイヤーへの相対位置で向きを決定
    const deltaX = player.position.x - monster.position.x;
    const deltaY = player.position.y - monster.position.y;
    
    if (deltaX === 0 && deltaY > 0) {
      monster.currentDirection = 'front';      // プレイヤーが南（下）
    } else if (deltaX === 0 && deltaY < 0) {
      monster.currentDirection = 'back';       // プレイヤーが北（上）
    } else if (deltaX > 0 && deltaY === 0) {
      monster.currentDirection = 'right';      // プレイヤーが東（右）
    } else if (deltaX < 0 && deltaY === 0) {
      monster.currentDirection = 'left';       // プレイヤーが西（左）
    } else if (deltaX > 0 && deltaY > 0) {
      monster.currentDirection = 'se';         // プレイヤーが南東
    } else if (deltaX < 0 && deltaY > 0) {
      monster.currentDirection = 'sw';         // プレイヤーが南西
    } else if (deltaX > 0 && deltaY < 0) {
      monster.currentDirection = 'ne';         // プレイヤーが北東
    } else if (deltaX < 0 && deltaY < 0) {
      monster.currentDirection = 'nw';         // プレイヤーが北西
    }
    
    console.log(`[AISystem] 敵${monster.id}の向きを更新（その場）: ${monster.currentDirection} プレイヤー(${player.position.x},${player.position.y}) -> 敵(${monster.position.x},${monster.position.y})`);
  }

  /**
   * Get current turn number from TurnSystem
   */
  private getCurrentTurn(): number {
    return this.turnSystem ? this.turnSystem.getCurrentTurn() : 0;
  }

  /**
   * Get or create AI state for entity
   */
  private getOrCreateAIState(entity: GameEntity): AIState {
    let state = this.aiStates.get(entity.id);
    
    if (!state) {
      state = {
        homePosition: { ...entity.position },
        lastDecision: null,
        lastTurnProcessed: undefined,
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
   * Process entity movement based on AI decision
   */
  processEntityMovement(entity: GameEntity): { moved: boolean } | null {
    console.log(`[AISystem] 移動処理開始: ${entity.id}`);
    
    if (!this.hasAISupport(entity)) {
      console.log(`[AISystem] AIサポートなし: ${entity.id}`);
      return null;
    }

    // AI決定を取得（移動処理用）
    const decision = this.processAI(entity);
    console.log(`[AISystem] 移動用AI決定: ${entity.id} - ${JSON.stringify(decision)}`);
    
    if (!decision || decision.action !== 'move' || !decision.position) {
      console.log(`[AISystem] 移動決定なし: ${entity.id} - decision=${!!decision}, action=${decision?.action}, position=${!!decision?.position}`);
      return { moved: false };
    }

    // 移動先が有効かチェック
    if (!this.dungeonManager.isWalkable(decision.position)) {
      return { moved: false };
    }
    
    // アイテム以外のエンティティがいる場合は移動不可
    const entitiesAtTarget = this.dungeonManager.getEntitiesAt(decision.position);
    const blockingEntities = entitiesAtTarget.filter(e => !(e instanceof ItemEntity));
    if (blockingEntities.length > 0) {
      return { moved: false };
    }

    // 現在位置から移動先への移動を実行
    const oldPosition = { ...entity.position };
    entity.position.x = decision.position.x;
    entity.position.y = decision.position.y;

    // ダンジョンマネージャーでエンティティの位置を更新
    this.dungeonManager.removeEntityFromPosition(entity, oldPosition);
    this.dungeonManager.addEntity(entity, decision.position);

    console.log(`[AI] ${entity.id} moved from (${oldPosition.x}, ${oldPosition.y}) to (${decision.position.x}, ${decision.position.y})`);
    return { moved: true };
  }

  /**
   * Process entity attack based on AI decision
   */
  processEntityAttack(entity: GameEntity): { attacked: boolean } | null {
    console.log(`[AISystem] 攻撃処理開始: ${entity.id}`);
    
    if (!this.hasAISupport(entity)) {
      console.log(`[AISystem] AIサポートなし: ${entity.id}`);
      return null;
    }

    // AI決定を取得（攻撃処理用）
    const decision = this.processAI(entity);
    console.log(`[AISystem] 攻撃用AI決定: ${entity.id} - ${JSON.stringify(decision)}`);
    
    if (!decision || decision.action !== 'attack' || !decision.target) {
      console.log(`[AISystem] 攻撃決定が無効: ${entity.id} - ${JSON.stringify(decision)}`);
      return { attacked: false };
    }

    // 攻撃可能かチェック
    const canAttack = this.combatSystem.canAttack(entity, decision.target);
    console.log(`[AISystem] 攻撃可能チェック: ${entity.id} -> ${decision.target.id}, 結果: ${canAttack}`);
    
    if (!canAttack) {
      console.log(`[AISystem] 攻撃不可: ${entity.id} -> ${decision.target.id}`);
      return { attacked: false };
    }

    // 攻撃実行
    console.log(`[AISystem] 攻撃実行開始: ${entity.id} -> ${decision.target.id}`);
    const attackResult = this.combatSystem.processAttack(entity, decision.target);
    console.log(`[AISystem] 攻撃結果: ${entity.id} -> ${decision.target.id}, 結果: ${JSON.stringify(attackResult)}`);
    
    if (attackResult) {
      console.log(`[AI] ${entity.id} attacked ${decision.target.id}`);
      return { attacked: true };
    }

    console.log(`[AISystem] 攻撃失敗: ${entity.id} -> ${decision.target.id}`);
    return { attacked: false };
  }

  /**
   * Process entity movement with existing AI decision
   */
  processEntityMovementWithDecision(entity: GameEntity, decision: AIDecision): { moved: boolean } | null {
    console.log(`[AISystem] 移動処理開始（決定済み）: ${entity.id}`);
    
    if (!this.hasAISupport(entity)) {
      console.log(`[AISystem] AIサポートなし: ${entity.id}`);
      return null;
    }

    if (!decision || decision.action !== 'move' || !decision.position) {
      console.log(`[AISystem] 移動決定が無効: ${entity.id} - ${JSON.stringify(decision)}`);
      return { moved: false };
    }

    // 移動先が有効かチェック
    if (!this.dungeonManager.isWalkable(decision.position)) {
      return { moved: false };
    }
    
    // アイテム以外のエンティティがいる場合は移動不可
    const entitiesAtTarget = this.dungeonManager.getEntitiesAt(decision.position);
    const blockingEntities = entitiesAtTarget.filter(e => !(e instanceof ItemEntity));
    if (blockingEntities.length > 0) {
      return { moved: false };
    }

    // 現在位置から移動先への移動を実行
    const oldPosition = { ...entity.position };
    entity.position.x = decision.position.x;
    entity.position.y = decision.position.y;

    // 移動方向を計算して更新
    if (entity instanceof MonsterEntity) {
      this.updateMonsterDirection(entity, oldPosition, decision.position);
    }

    // ダンジョンマネージャーでエンティティの位置を更新
    this.dungeonManager.removeEntityFromPosition(entity, oldPosition);
    this.dungeonManager.addEntity(entity, decision.position);

    console.log(`[AI] ${entity.id} moved from (${oldPosition.x}, ${oldPosition.y}) to (${decision.position.x}, ${decision.position.y})`);
    return { moved: true };
  }

  /**
   * Process entity attack with existing AI decision
   */
  processEntityAttackWithDecision(entity: GameEntity, decision: AIDecision): { attacked: boolean } | null {
    console.log(`[AISystem] 攻撃処理開始（決定済み）: ${entity.id}`);
    
    if (!this.hasAISupport(entity)) {
      console.log(`[AISystem] AIサポートなし: ${entity.id}`);
      return null;
    }

    if (!decision || decision.action !== 'attack' || !decision.target) {
      console.log(`[AISystem] 攻撃決定が無効: ${entity.id} - ${JSON.stringify(decision)}`);
      return { attacked: false };
    }

    // 攻撃可能かチェック
    const canAttack = this.combatSystem.canAttack(entity, decision.target);
    console.log(`[AISystem] 攻撃可能チェック: ${entity.id} -> ${decision.target.id}, 結果: ${canAttack}`);
    
    if (!canAttack) {
      console.log(`[AISystem] 攻撃不可: ${entity.id} -> ${decision.target.id}`);
      return { attacked: false };
    }

    // 攻撃前に方向を更新（その場での方向転換）
    if (entity instanceof MonsterEntity) {
      this.updateMonsterDirection(entity, entity.position, entity.position);
    }

    // 攻撃実行
    console.log(`[AISystem] 攻撃実行開始: ${entity.id} -> ${decision.target.id}`);
    const attackResult = this.combatSystem.processAttack(entity, decision.target);
    console.log(`[AISystem] 攻撃結果: ${entity.id} -> ${decision.target.id}, 結果: ${JSON.stringify(attackResult)}`);
    
    if (attackResult) {
      console.log(`[AI] ${entity.id} attacked ${decision.target.id}`);
      return { attacked: true };
    }

    console.log(`[AISystem] 攻撃失敗: ${entity.id} -> ${decision.target.id}`);
    return { attacked: false };
  }

  /**
   * Initialize default AI behaviors
   */
  private initializeDefaultBehaviors(): void {
    // Aggressive monster (プレイヤーを積極的に追跡・攻撃)
    this.registerBehavior('aggressive', {
      type: 'aggressive',
      aggroRange: 12,       // より遠くからプレイヤーを発見
      attackRange: 1,        // 隣接時のみ攻撃
      fleeThreshold: 0.1,    // ほぼ逃げない
      patrolRadius: 0,       // パトロールしない
      followDistance: 1,     // プレイヤーに近づく
      decisionCooldown: 100  // より頻繁に行動
    });

    // Simple aggressive monster (シンプルで分かりやすい行動)
    this.registerBehavior('simple-aggressive', {
      type: 'aggressive',
      aggroRange: 15,       // 非常に遠くからプレイヤーを発見
      attackRange: 1,        // 隣接時のみ攻撃
      fleeThreshold: 0.05,   // ほぼ絶対に逃げない
      patrolRadius: 0,       // パトロールしない
      followDistance: 1,     // プレイヤーに近づく
      decisionCooldown: 50   // 非常に頻繁に行動
    });

    // Basic hostile monster (後方互換性のため残す)
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

  /**
   * Check if an entity is alive
   */
  private isEntityAlive(entity: GameEntity): boolean {
    // HPベースでの生存チェック
    if (entity.stats && entity.stats.hp !== undefined) {
      return entity.stats.hp > 0;
    }
    
    // HP情報がない場合は生存とみなす
    return true;
  }
}