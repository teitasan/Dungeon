/**
 * AI system for managing enemy and companion behavior
 */

import { GameEntity } from '../types/entities';
import { MonsterEntity } from '../entities/Monster';
import { CompanionEntity } from '../entities/Companion';
import { PlayerEntity } from '../entities/Player';
import { ItemEntity } from '../entities/Item';
import { Position } from '../types/core';
import { MovementPattern, MovementPatternConfig } from '../types/ai';
import { DungeonManager } from '../dungeon/DungeonManager';
import { MovementSystem } from './MovementSystem';
import { CombatSystem } from './CombatSystem';
import { TurnSystem } from './TurnSystem';

// AI behavior types
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
// AI state
export interface AIState {
  target?: GameEntity;
  lastKnownTargetPosition?: Position;
  homePosition: Position;
  patrolPoints: Position[];
  currentPatrolIndex: number;
  aggroLevel: number;
  lastDecisionTime: number;
  lastDecision: AIDecision | null; // 前回の決定をキャッシュ
  lastTurnProcessed?: number; // 最後に処理したターン番号
  warpCooldownLeft?: number; // ワープの簡易クールダウン
}

export class AISystem {
  private dungeonManager: DungeonManager;
  private movementSystem: MovementSystem;
  private combatSystem: CombatSystem;
  private turnSystem: TurnSystem;
  private aiStates: Map<string, AIState> = new Map();

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

    const state = this.getOrCreateAIState(entity);

    // 新: 7種の移動パターンに一本化
    const pattern = this.getMovementPattern(entity);
    const patternConfig = this.getMovementConfig(entity, pattern);

    const decision = this.makePatternDecision(entity, state, pattern, patternConfig);
    
    // Update AI state based on decision
    this.updateAIState(entity, state, decision);

    return decision;
  }

  /**
   * Make AI decision based on behavior type
   */
  // 旧ビヘイビア分岐は削除済み（新パターンのみ）

  /**
   * 7種の移動パターンに基づく意思決定
   */
  private makePatternDecision(
    entity: GameEntity,
    state: AIState,
    pattern: MovementPattern,
    cfg: MovementPatternConfig
  ): AIDecision {
    // 目標（敵 or 追従対象）を決定
    const target = this.resolvePatternTarget(entity, pattern);

    // 可能なら攻撃を優先（接近系・一定距離系など対象ありの場合）
    if (target && this.isInAttackRange(entity, target) && this.combatSystem.canAttack(entity, target)) {
      return { action: 'attack', target, priority: 10 };
    }

    switch (pattern) {
      case 'idle':
        return { action: 'wait', priority: 1 };
      case 'random': {
        const moveProb = cfg.moveProbability ?? 0.5;
        if (Math.random() < moveProb) {
          const pos = this.getRandomAdjacentPosition(entity.position);
          if (pos) return { action: 'move', position: pos, priority: 3 };
        }
        return { action: 'wait', priority: 1 };
      }
      case 'approach': {
        if (!target) return { action: 'wait', priority: 1 };
        const next = this.getNextStepByPathfind(entity.position, target.position) || this.getNextMoveTowards(entity.position, target.position);
        if (next) return { action: 'move', position: next, priority: 8 };
        return { action: 'wait', priority: 2 };
      }
      case 'escape': {
        if (!target) return { action: 'wait', priority: 1 };
        const fleePos = this.getFleePosition(entity.position, target.position) || this.getRandomAdjacentPosition(entity.position);
        if (fleePos) return { action: 'move', position: fleePos, priority: 8 };
        return { action: 'wait', priority: 2 };
      }
      case 'keep-distance': {
        if (!target) return { action: 'wait', priority: 1 };
        const minD = cfg.minDistance ?? 2;
        const maxD = cfg.maxDistance ?? 3;
        const dist = this.getDistance(entity.position, target.position);
        if (dist < minD) {
          // 離れる
          const away = this.getFleePosition(entity.position, target.position) || this.getRandomAdjacentPosition(entity.position);
          if (away) return { action: 'move', position: away, priority: 7 };
          return { action: 'wait', priority: 2 };
        } else if (dist > maxD) {
          // 近づく
          const step = this.getNextStepByPathfind(entity.position, target.position) || this.getNextMoveTowards(entity.position, target.position);
          if (step) return { action: 'move', position: step, priority: 7 };
          return { action: 'wait', priority: 2 };
        }
        // 範囲内なら待機
        return { action: 'wait', priority: 3 };
      }
      case 'patrol': {
        const points = cfg.patrolPoints && cfg.patrolPoints.length > 0 ? cfg.patrolPoints : state.patrolPoints;
        if (!points || points.length === 0) {
          // パトロールポイントが無い場合はランダム移動
          const pos = this.getRandomAdjacentPosition(entity.position);
          if (pos) return { action: 'move', position: pos, priority: 4 };
          return { action: 'wait', priority: 1 };
        }
        // 現在の目標ポイントへ
        const idx = state.currentPatrolIndex % points.length;
        const goal = points[idx];
        const dist = this.getDistance(entity.position, goal);
        if (dist <= 1) {
          state.currentPatrolIndex = (state.currentPatrolIndex + 1) % points.length;
        }
        const step = this.getNextStepByPathfind(entity.position, goal) || this.getNextMoveTowards(entity.position, goal);
        if (step) return { action: 'move', position: step, priority: 5 };
        return { action: 'wait', priority: 2 };
      }
      case 'warp': {
        // 簡易クールダウン（ターン制御が無い前提で控えめに）
        if (state.warpCooldownLeft && state.warpCooldownLeft > 0) {
          state.warpCooldownLeft -= 1;
          return { action: 'wait', priority: 1 };
        }
        const range = cfg.warpRange ?? 6;
        const dest = this.selectRandomWarpPosition(entity.position, range);
        if (dest) {
          state.warpCooldownLeft = cfg.warpCooldownTicks ?? 3;
          return { action: 'move', position: dest, priority: 9 };
        }
        return { action: 'wait', priority: 1 };
      }
    }
  }

  /** 目標（敵 or 追従対象）を決定 */
  private resolvePatternTarget(entity: GameEntity, pattern: MovementPattern): GameEntity | null {
    // Companion の keep-distance はプレイヤーを基準にする
    if (pattern === 'keep-distance' && entity instanceof CompanionEntity) {
      return this.findPlayer();
    }
    // 敵（Monster）はプレイヤー/味方を敵視
    if (pattern === 'approach' || pattern === 'escape' || pattern === 'keep-distance') {
      const target = this.findNearestEnemy(entity, 20) || null;
      return target;
    }
    return null;
  }

  /** パス探索で次の1歩を返す（なければ null） */
  private getNextStepByPathfind(from: Position, to: Position): Position | null {
    const path = this.dungeonManager.findPath(from, to);
    if (path && path.length > 0) return path[0];
    return null;
  }

  /** ワープ先のランダム選定（範囲内・歩行可能・非ブロッキング） */
  private selectRandomWarpPosition(from: Position, range: number): Position | null {
    const candidates: Position[] = [];
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const pos = { x: from.x + dx, y: from.y + dy };
        if (!this.dungeonManager.isValidPosition(pos)) continue;
        if (!this.dungeonManager.isWalkable(pos)) continue;
        const ents = this.dungeonManager.getEntitiesAt(pos);
        // アイテム以外がいない
        const blocking = ents.filter(e => !(e instanceof ItemEntity));
        if (blocking.length === 0) candidates.push(pos);
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /** エンティティから移動パターンを取得（aiType互換は廃止） */
  private getMovementPattern(entity: GameEntity): MovementPattern {
    const anyEnt = entity as any;
    if (anyEnt.movementPattern) return anyEnt.movementPattern as MovementPattern;

    // 旧 aiType は廃止。未設定なら 'approach'
    return 'approach';
  }

  /** エンティティからパターン設定を取得（無ければデフォルト） */
  private getMovementConfig(entity: GameEntity, pattern: MovementPattern): MovementPatternConfig {
    const anyEnt = entity as any;
    const base: MovementPatternConfig = anyEnt.movementConfig || {};
    // デフォルト値の補完
    switch (pattern) {
      case 'approach':
        return { desiredRange: 1, decisionCooldown: 100, ...base };
      case 'escape':
        return { safeDistance: 4, decisionCooldown: 100, ...base };
      case 'idle':
        return { decisionCooldown: 200, ...base };
      case 'keep-distance':
        return { minDistance: 2, maxDistance: 3, decisionCooldown: 120, ...base };
      case 'random':
        return { moveProbability: 0.6, decisionCooldown: 200, ...base };
      case 'patrol':
        return { loop: true, pauseTicks: 0, decisionCooldown: 150, ...base };
      case 'warp':
        return { warpRange: 6, warpCooldownTicks: 3, decisionCooldown: 120, ...base };
    }
  }

  // 旧 Aggressive AI 行動は削除

  // 旧 Defensive 行動は削除

  // 旧 Follow/Passive/Patrol 行動は削除

  // 旧 Guard/Flee/Random 行動は削除

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
    return entity instanceof MonsterEntity || entity instanceof CompanionEntity;
  }

  /**
   * Get AI type from entity
   */
  // 旧 API（aiType やビヘイビア設定）は削除

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
  // 旧デフォルトビヘイビアは削除

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
