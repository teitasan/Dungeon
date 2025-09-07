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
  patternForTurn?: MovementPattern; // 当該ターンの基本行動（approach/patrolなど）
  patternTurn?: number; // 行動パターンを決めたターン番号
  patrolDir?: { dx: number; dy: number };
  patrolTargetDoor?: Position;
  // 直近に“部屋へ入った”ときに通過した出口（部屋外周セル）
  patrolLastRoomExit?: Position;
  // 連続待機カウント（デッドロック緩和用）
  waitStreak?: number;
  // 残り香追跡
  scentTarget?: Position;
  lastScentTurn?: number;
}

export class AISystem {
  private dungeonManager: DungeonManager;
  private movementSystem: MovementSystem;
  private combatSystem: CombatSystem;
  private turnSystem: TurnSystem;
  private aiStates: Map<string, AIState> = new Map();
  private scentHorizon = 12; // 残り香の有効ターン

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
    // 当該ターンで決定済みのパターンを優先
    const currentTurn = this.getCurrentTurn();
    const patternFromState = (state.patternTurn === currentTurn) ? state.patternForTurn : undefined;
    const pattern = patternFromState || this.getMovementPattern(entity);
    const patternConfig = this.getMovementConfig(entity, pattern);

    let decision = this.makePatternDecision(entity, state, pattern, patternConfig);

    // 連続待機が一定回数に達したら、ランダム移動でほぐす（端から解消）
    if (decision.action === 'wait') {
      state.waitStreak = (state.waitStreak || 0) + 1;
      if (state.waitStreak >= 2) {
        const step = this.getRandomUsableAdjacentStep(entity.position);
        if (step) {
          decision = { action: 'move', position: step, priority: Math.max(3, decision.priority) };
          state.waitStreak = 0; // リセット
        }
      }
    } else {
      state.waitStreak = 0;
    }
    
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
        // 角を挟んだ隣接など「隣接だが攻撃不可」のケースでは、攻撃可能タイルへ回り込む
        let next: Position | null = null;
        const dx = Math.abs(entity.position.x - target.position.x);
        const dy = Math.abs(entity.position.y - target.position.y);
        const adjacent = dx <= 1 && dy <= 1 && (dx + dy > 0);
        const attackPossible = this.isInAttackRange(entity, target) && this.combatSystem.canAttack(entity, target);
        if (adjacent && !attackPossible) {
          next = this.getStepTowardsAnyAttackableTile(entity, target);
        }
        if (!next) {
          // 残り香ターゲットがある場合はそちらを優先
          const st = this.getOrCreateAIState(entity);
          const currentTurn = this.getCurrentTurn();
          const hasFreshScent = st.scentTarget && this.dungeonManager.isScentFresh(st.scentTarget, currentTurn, this.scentHorizon);
          if (st.scentTarget && hasFreshScent) {
            next = this.getNextStepByPathfind(entity.position, st.scentTarget) || this.getNextMoveTowards(entity.position, st.scentTarget);
            // 到達したらクリア
            if (next && next.x === st.scentTarget.x && next.y === st.scentTarget.y) {
              st.scentTarget = undefined;
              st.lastScentTurn = undefined;
            }
          }
        }
        if (!next) {
          next = this.getNextStepByPathfind(entity.position, target.position) || this.getNextMoveTowards(entity.position, target.position);
        }
        // 経路上の一歩が塞がれている/角抜け不可などで無効な場合、前・左・右・後退の順で一歩の代替を試す
        if (!next || !this.isStepUsable(entity.position, next)) {
          // 1) 狭い通路での対面衝突なら、優先度の低い側が後退（ゆずり）
          const yieldStep = this.getCorridorYieldStep(entity, target);
          if (yieldStep) next = yieldStep;
        }
        if (!next || !this.isStepUsable(entity.position, next)) {
          const fallback = this.getDirectionalFallbackStep(entity.position, target.position);
          if (fallback) next = fallback;
        }
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
        const cell = this.dungeonManager.getCellAt(entity.position);
        if (!cell) return { action: 'wait', priority: 1 };
        if (cell.type === 'room') {
          // 部屋内: ランダムな出口（部屋外周で通路に隣接するセル）を選び、そこへ向かう
          const room = this.dungeonManager.getRoomAt(entity.position);
          if (room) {
            if (!state.patrolTargetDoor) {
              const exits = this.dungeonManager.getRoomExitPositions(room);
              if (exits.length > 0) {
                // 入ってきた出口以外からランダムに選ぶ（無ければ入ってきた出口を使う）
                const notFrom = exits.filter(p => !state.patrolLastRoomExit || !(p.x === state.patrolLastRoomExit.x && p.y === state.patrolLastRoomExit.y));
                if (notFrom.length > 0) {
                  state.patrolTargetDoor = notFrom[Math.floor(Math.random() * notFrom.length)];
                } else {
                  state.patrolTargetDoor = exits[0];
                }
              } else {
                // 出口が見つからない場合は部屋内でランダム移動
                const pos = this.getRandomAdjacentPosition(entity.position);
                if (pos) return { action: 'move', position: pos, priority: 4 };
                return { action: 'wait', priority: 1 };
              }
            }
            if (state.patrolTargetDoor) {
              // 既に出口セルに居るなら、通路側へ一歩踏み出す
              if (entity.position.x === state.patrolTargetDoor.x && entity.position.y === state.patrolTargetDoor.y) {
                const candidates = [
                  { x: entity.position.x, y: entity.position.y - 1 }, // N
                  { x: entity.position.x + 1, y: entity.position.y }, // E
                  { x: entity.position.x, y: entity.position.y + 1 }, // S
                  { x: entity.position.x - 1, y: entity.position.y }  // W
                ];
                const corridorNeighbors = candidates.filter(p => {
                  const c = this.dungeonManager.getCellAt(p);
                  return !!c && c.type === 'corridor' && this.dungeonManager.isWalkable(p) && this.isPositionAvailableForMovement(p);
                });
                if (corridorNeighbors.length > 0) {
                  const next = corridorNeighbors[0];
                  state.patrolDir = { dx: Math.sign(next.x - entity.position.x), dy: Math.sign(next.y - entity.position.y) };
                  state.patrolTargetDoor = undefined; // 通路に出るのでリセット
                  return { action: 'move', position: next, priority: 6 };
                }
                // 通路が埋まっているなどで進めない場合は待機
                return { action: 'wait', priority: 1 };
              }
              // 出口へパス移動
              const step = this.getNextStepByPathfind(entity.position, state.patrolTargetDoor) || this.getNextMoveTowards(entity.position, state.patrolTargetDoor);
              if (step && !(step.x === entity.position.x && step.y === entity.position.y)) {
                // 進行方向を記憶（次の通路で使用）
                state.patrolDir = { dx: Math.sign(step.x - entity.position.x), dy: Math.sign(step.y - entity.position.y) };
                return { action: 'move', position: step, priority: 5 };
              } else {
                // パスが引けない/進行できない場合はリセット
                state.patrolTargetDoor = undefined;
              }
            }
          }
          // フォールバック
          const pos = this.getRandomAdjacentPosition(entity.position);
          if (pos) return { action: 'move', position: pos, priority: 3 };
          return { action: 'wait', priority: 1 };
        } else {
          // 通路（およびドア）: 直進優先 → 左 → 右 → 後退
          const next = this.getCorridorNextStep(entity.position, state);
          if (next) {
            state.patrolDir = { dx: Math.sign(next.x - entity.position.x), dy: Math.sign(next.y - entity.position.y) };
            // 通路上に出たので出口ターゲットは不要
            state.patrolTargetDoor = undefined;
            return { action: 'move', position: next, priority: 5 };
          }
          return { action: 'wait', priority: 1 };
        }
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

  /** 失敗時のパターン指向フォールバック（左折法/方向フォールバック/ゆずり） */
  private getFailureFallbackStep(entity: GameEntity): Position | null {
    const state = this.getOrCreateAIState(entity);
    const pattern = (state.patternTurn === this.getCurrentTurn() && state.patternForTurn)
      ? state.patternForTurn
      : this.getMovementPattern(entity);

    // パトロール: 通路は左折法、部屋は出口へ一歩
    if (pattern === 'patrol') {
      const cell = this.dungeonManager.getCellAt(entity.position);
      if (cell?.type === 'corridor') {
        const step = this.getCorridorNextStep(entity.position, state);
        if (step && this.isStepUsable(entity.position, step)) return step;
      } else if (cell?.type === 'room') {
        const room = this.dungeonManager.getRoomAt(entity.position);
        if (room) {
          // 既に出口ターゲットがあるならその方向へ、無ければ選定
          if (!state.patrolTargetDoor) {
            const exits = this.dungeonManager.getRoomExitPositions(room);
            if (exits.length > 0) {
              const notFrom = exits.filter(p => !state.patrolLastRoomExit || !(p.x === state.patrolLastRoomExit.x && p.y === state.patrolLastRoomExit.y));
              state.patrolTargetDoor = (notFrom.length > 0 ? notFrom : exits)[0];
            }
          }
          if (state.patrolTargetDoor) {
            const step = this.getNextStepByPathfind(entity.position, state.patrolTargetDoor) || this.getNextMoveTowards(entity.position, state.patrolTargetDoor);
            if (step && this.isStepUsable(entity.position, step)) return step;
          }
        }
      }
      // 最後に周囲ランダム
      const rnd = this.getRandomUsableAdjacentStep(entity.position);
      if (rnd) return rnd;
      return null;
    }

    // approach/keep-distance/escape/random/guard等: 方向フォールバック＋通路の譲り
    const target = this.resolvePatternTarget(entity, 'approach');
    if (target) {
      const yieldStep = this.getCorridorYieldStep(entity, target);
      if (yieldStep && this.isStepUsable(entity.position, yieldStep)) return yieldStep;
      const dirStep = this.getDirectionalFallbackStep(entity.position, target.position);
      if (dirStep && this.isStepUsable(entity.position, dirStep)) return dirStep;
    }
    // 最後にランダム
    return this.getRandomUsableAdjacentStep(entity.position);
  }

  /** ランダムな隣接（斜め含む）で一歩可能な位置を返す */
  private getRandomUsableAdjacentStep(from: Position): Position | null {
    const adj = this.dungeonManager.getAdjacentPositions(from, true);
    // シャッフル
    for (let i = adj.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [adj[i], adj[j]] = [adj[j], adj[i]];
    }
    for (const p of adj) {
      if (this.isStepUsable(from, p)) return p;
    }
    return null;
  }

  /** 一歩候補が「歩ける・空いている・角抜けしない」か */
  private isStepUsable(from: Position, to: Position): boolean {
    if (!this.dungeonManager.isValidPosition(to)) return false;
    if (!this.dungeonManager.isWalkable(to)) return false;
    if (this.isDiagonalMoveBlocked(from, to)) return false;
    const ents = this.dungeonManager.getEntitiesAt(to);
    const blocking = ents.filter(e => !(e instanceof ItemEntity));
    return blocking.length === 0;
  }

  /** 前・左・右・後退の順で簡易に一歩を選ぶ（approach用フォールバック） */
  private getDirectionalFallbackStep(from: Position, to: Position): Position | null {
    // 目標への主方向（カーディナル）を計算
    const vx = to.x - from.x;
    const vy = to.y - from.y;
    let forward: { dx: number; dy: number };
    if (Math.abs(vx) >= Math.abs(vy)) {
      forward = { dx: Math.sign(vx), dy: 0 };
    } else {
      forward = { dx: 0, dy: Math.sign(vy) };
    }
    const left = { dx: -forward.dy, dy: forward.dx };
    const right = { dx: forward.dy, dy: -forward.dx };
    const back = { dx: -forward.dx, dy: -forward.dy };
    const order = [forward, left, right, back];
    for (const d of order) {
      const np = { x: from.x + d.dx, y: from.y + d.dy };
      if (this.isStepUsable(from, np)) return np;
    }
    return null;
  }

  /**
   * 狭い通路で正面衝突した場合のゆずりロジック。
   * 条件: 現在位置と前方がいずれも corridor、左右が使えない（幅1通路）、前方が敵で塞がれている。
   * ルール: プレイヤーからの距離が遠い側（またはIDが大きい側）が一歩後退可能なら後退する。
   */
  private getCorridorYieldStep(entity: GameEntity, target: GameEntity): Position | null {
    const hereCell = this.dungeonManager.getCellAt(entity.position);
    if (!hereCell || hereCell.type !== 'corridor') return null;
    // 前方ベクトル（主軸方向）
    const vx = target.position.x - entity.position.x;
    const vy = target.position.y - entity.position.y;
    const forward = (Math.abs(vx) >= Math.abs(vy)) ? { dx: Math.sign(vx), dy: 0 } : { dx: 0, dy: Math.sign(vy) };
    const left = { dx: -forward.dy, dy: forward.dx };
    const right = { dx: forward.dy, dy: -forward.dx };
    const ahead = { x: entity.position.x + forward.dx, y: entity.position.y + forward.dy };
    const aheadCell = this.dungeonManager.getCellAt(ahead);
    if (!aheadCell || aheadCell.type !== 'corridor') return null;
    // 幅1通路（左右が使えない）
    const leftPos = { x: entity.position.x + left.dx, y: entity.position.y + left.dy };
    const rightPos = { x: entity.position.x + right.dx, y: entity.position.y + right.dy };
    const leftUsable = this.isStepUsable(entity.position, leftPos);
    const rightUsable = this.isStepUsable(entity.position, rightPos);
    if (leftUsable || rightUsable) return null;
    // 前方が敵で塞がれているか
    const ents = this.dungeonManager.getEntitiesAt(ahead);
    const blocker = ents.find(e => (e as any) instanceof MonsterEntity);
    if (!blocker) return null;
    // どちらが後退するか判定
    const player = this.findPlayer();
    let yieldThis = true;
    if (player) {
      const dThis = Math.abs(entity.position.x - player.position.x) + Math.abs(entity.position.y - player.position.y);
      const dOther = Math.abs((blocker as any).position.x - player.position.x) + Math.abs((blocker as any).position.y - player.position.y);
      // 自分の方が遠ければ後退、近ければ譲らない
      yieldThis = dThis >= dOther;
    } else {
      // プレイヤーが不明ならIDで安定化
      yieldThis = entity.id > (blocker as any).id;
    }
    if (!yieldThis) return null;
    // 後退先
    const back = { x: entity.position.x - forward.dx, y: entity.position.y - forward.dy };
    if (this.isStepUsable(entity.position, back)) return back;
    return null;
  }

  /** 攻撃可能な隣接タイル群（角抜け不可ルール込み）へ回り込むための次の一歩を返す */
  private getStepTowardsAnyAttackableTile(entity: GameEntity, target: GameEntity): Position | null {
    const neighbors: Position[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const p = { x: target.position.x + dx, y: target.position.y + dy };
        if (!this.dungeonManager.isValidPosition(p)) continue;
        if (!this.dungeonManager.isWalkable(p)) continue;
        // 角抜け不可: 対角の場合は両サイドが壁のときは候補にしない
        const diag = dx !== 0 && dy !== 0;
        if (diag) {
          const side1 = { x: p.x, y: target.position.y };
          const side2 = { x: target.position.x, y: p.y };
          if (!this.dungeonManager.isWalkable(side1) && !this.dungeonManager.isWalkable(side2)) continue;
        }
        neighbors.push(p);
      }
    }
    if (neighbors.length === 0) return null;

    // 近い順にパス探索
    const withDist = neighbors
      .filter(p => !(p.x === entity.position.x && p.y === entity.position.y))
      .map(p => ({ p, d: this.getDistance(entity.position, p) }))
      .sort((a, b) => a.d - b.d);

    for (const cand of withDist) {
      const path = this.dungeonManager.findPath(entity.position, cand.p);
      if (path && path.length > 0) {
        // 最初の一歩
        const step = path[0];
        // 角抜け実行の直前チェック
        if (this.isDiagonalMoveBlocked(entity.position, step)) continue;
        // 目的地が現在他者で埋まっていても、まずは一歩進む
        return step;
      }
    }
    return null;
  }

  /** 通路上の次の一歩（直進→左→右→後退）。通路のみを許可 */
  private getCorridorNextStep(from: Position, state: AIState): Position | null {
    const cell = this.dungeonManager.getCellAt(from);
    if (!cell) return null;

    const isCorrLike = (pos: Position): boolean => {
      const c = this.dungeonManager.getCellAt(pos);
      return !!c && c.type === 'corridor';
    };
    const isRoom = (pos: Position): boolean => {
      const c = this.dungeonManager.getCellAt(pos);
      return !!c && c.type === 'room';
    };

    // 初期進行方向が無ければ推定（優先: 通路隣接の方向）
    if (!state.patrolDir) {
      const dirs = [
        { dx: 0, dy: -1 }, // N
        { dx: 1, dy: 0 },  // E
        { dx: 0, dy: 1 },  // S
        { dx: -1, dy: 0 }  // W
      ];
    for (const d of dirs) {
      const np = { x: from.x + d.dx, y: from.y + d.dy };
      if (isCorrLike(np) && this.isStepUsable(from, np)) {
        state.patrolDir = d;
        break;
      }
    }
      if (!state.patrolDir) return null;
    }

    const forward = state.patrolDir;
    const left = { dx: -forward.dy, dy: forward.dx };  // 90°左回転
    const right = { dx: forward.dy, dy: -forward.dx }; // 90°右回転
    const back = { dx: -forward.dx, dy: -forward.dy };

    // 1) 通路（前・左・右）を優先
    for (const d of [forward, left, right]) {
      const np = { x: from.x + d.dx, y: from.y + d.dy };
      if (!this.dungeonManager.isValidPosition(np)) continue;
      if (!this.dungeonManager.isWalkable(np)) continue;
      if (!isCorrLike(np)) continue;
      return np;
    }
    // 2) 通路が無ければ、部屋（前・左・右）に入る
    for (const d of [forward, left, right]) {
      const np = { x: from.x + d.dx, y: from.y + d.dy };
      if (!this.dungeonManager.isValidPosition(np)) continue;
      if (!this.dungeonManager.isWalkable(np)) continue;
      if (!isRoom(np)) continue;
      if (!this.isPositionAvailableForMovement(np)) continue;
      // この一歩で部屋に入る＝今いる通路に隣接する“部屋外周セル”を通過する
      // 次ターンの出口選択で「入ってきた出口を除外」するため記憶しておく
      const room = this.dungeonManager.getRoomAt(np);
      if (room) {
        // npがその部屋の外周かどうかに関わらず、出口候補として保持
        state.patrolLastRoomExit = { ...np };
      }
      return np;
    }
    // 3) 最後の手段として後退（通路があれば）
    {
      const np = { x: from.x + back.dx, y: from.y + back.dy };
      if (this.dungeonManager.isValidPosition(np) && this.dungeonManager.isWalkable(np) && isCorrLike(np)) {
        return np;
      }
    }
    // 4) それでも無理なら後退して部屋に入る（レアケース）
    {
      const np = { x: from.x + back.dx, y: from.y + back.dy };
      if (this.dungeonManager.isValidPosition(np) && this.dungeonManager.isWalkable(np) && isRoom(np) && this.isPositionAvailableForMovement(np)) {
        return np;
      }
    }
    return null;
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

  /**
   * 敵の基本行動パターン（approach or patrol）をターン開始時に決定
   * 視界判定: プレイヤー視界と同一（同じ部屋に居る or 周囲1マス）
   */
  decidePatternForTurn(entity: GameEntity): void {
    if (!(entity instanceof MonsterEntity)) return;
    const state = this.getOrCreateAIState(entity);
    const currentTurn = this.getCurrentTurn();
    // プレイヤーの視界を共有し、敵がその視界内にいるかで判定
    const player = this.findPlayer();
    if (player) {
      this.dungeonManager.ensurePlayerVisionForTurn(player.position, currentTurn);
      if (this.dungeonManager.isInPlayerVision(entity.position)) {
        state.patternForTurn = 'approach';
        // ターゲット候補を更新（最も近い敵対者＝通常はプレイヤー）
        const target = this.findNearestEnemy(entity, 20);
        if (target) {
          state.target = target;
          state.lastKnownTargetPosition = target.position;
        }
        // プレイヤーを視認できるなら残り香はリセット
        state.scentTarget = undefined;
        state.lastScentTurn = undefined;
      } else {
        // 視界外：残り香を追跡（新鮮なものがあれば）
        const freshest = this.dungeonManager.getFreshestScentPosition(currentTurn, this.scentHorizon);
        if (freshest) {
          state.scentTarget = freshest;
          state.lastScentTurn = this.dungeonManager.getScentTurn(freshest);
          state.patternForTurn = 'approach'; // 残り香に向かう
        } else {
          state.patternForTurn = 'patrol';
        }
      }
    } else {
      state.patternForTurn = 'patrol';
    }
    state.patternTurn = currentTurn;
  }

  /**
   * プレイヤー視界と同じ可視判定: 同じ部屋 or 周囲1マス
   */
  private isVisibleLikePlayerVision(observerPos: Position, targetPos: Position): boolean {
    // 周囲1マス（斜め含む）
    const dx = Math.abs(observerPos.x - targetPos.x);
    const dy = Math.abs(observerPos.y - targetPos.y);
    if ((dx <= 1 && dy <= 1) && (dx + dy > 0)) return true;
    // 同室
    if (this.dungeonManager.isSameRoom(observerPos, targetPos)) return true;
    return false;
  }

  /** 視界内の敵対者を1体返す（優先: 最も近い） */
  private findVisibleHostileForEntity(entity: GameEntity): GameEntity | null {
    const all = this.dungeonManager.getAllEntities();
    const candidates: GameEntity[] = [];
    for (const other of all) {
      if (!this.isEnemy(entity, other)) continue;
      if (this.isVisibleLikePlayerVision(entity.position, other.position)) {
        candidates.push(other);
      }
    }
    if (candidates.length === 0) return null;
    // 最短距離優先
    return candidates.reduce((best, e) => {
      const bd = this.getDistance(entity.position, (best as GameEntity).position);
      const ed = this.getDistance(entity.position, e.position);
      return ed < bd ? e : best;
    });
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
    // 本番ビルドのminify対策として instanceof を使用
    if ((entity1 as any) instanceof MonsterEntity) {
      return (entity2 as any) instanceof PlayerEntity || (entity2 as any) instanceof CompanionEntity;
    }
    if ((entity1 as any) instanceof PlayerEntity || (entity1 as any) instanceof CompanionEntity) {
      return (entity2 as any) instanceof MonsterEntity;
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

  /** 斜め移動が壁の角抜けになるか簡易チェック（両サイドが非歩行ならブロック） */
  private isDiagonalMoveBlocked(from: Position, to: Position): boolean {
    const diag = (to.x !== from.x) && (to.y !== from.y);
    if (!diag) return false;
    const side1 = { x: from.x, y: to.y };
    const side2 = { x: to.x, y: from.y };
    // 片側でも非歩行なら斜めは禁止（角抜け禁止を厳密化）
    return !this.dungeonManager.isWalkable(side1) || !this.dungeonManager.isWalkable(side2);
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
    // 移動方向で向きを決定（プレイヤー相対ではなく、実際の一歩に合わせる）
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    if (deltaX === 0 && deltaY === 0) return; // その場の場合は変更なし

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
      const st0 = this.getOrCreateAIState(entity);
      st0.waitStreak = (st0.waitStreak || 0) + 1;
      return { moved: false };
    }

    // 移動先が有効かチェック
    if (!this.dungeonManager.isWalkable(decision.position)) {
      // フォールバック: 左折法/方向フォールバック優先 → それでも無理ならランダム
      const st1 = this.getOrCreateAIState(entity);
      const alt1 = this.getFailureFallbackStep(entity) || this.getRandomUsableAdjacentStep(entity.position);
      if (alt1) {
        return this.forceMoveEntity(entity, alt1);
      }
      st1.waitStreak = (st1.waitStreak || 0) + 1;
      return { moved: false };
    }
    
    // アイテム以外のエンティティがいる場合は移動不可
    const entitiesAtTarget = this.dungeonManager.getEntitiesAt(decision.position);
    const blockingEntities = entitiesAtTarget.filter(e => !(e instanceof ItemEntity));
    if (blockingEntities.length > 0) {
      const st2 = this.getOrCreateAIState(entity);
      const alt2 = this.getFailureFallbackStep(entity) || this.getRandomUsableAdjacentStep(entity.position);
      if (alt2) {
        return this.forceMoveEntity(entity, alt2);
      }
      st2.waitStreak = (st2.waitStreak || 0) + 1;
      return { moved: false };
    }

    // 斜め移動の角抜けを防止
    if (this.isDiagonalMoveBlocked(entity.position, decision.position)) {
      const st3 = this.getOrCreateAIState(entity);
      const alt3 = this.getFailureFallbackStep(entity) || this.getRandomUsableAdjacentStep(entity.position);
      if (alt3) {
        return this.forceMoveEntity(entity, alt3);
      }
      st3.waitStreak = (st3.waitStreak || 0) + 1;
      return { moved: false };
    }

    // 現在位置から移動先への移動を実行
    const oldPosition = { ...entity.position };
    entity.position.x = decision.position.x;
    entity.position.y = decision.position.y;

    // 進行ベクトルに基づきパトロール方向を更新（フォールバック時の振る舞い安定化）
    if (entity instanceof MonsterEntity) {
      const st = this.getOrCreateAIState(entity);
      const dx = decision.position.x - oldPosition.x;
      const dy = decision.position.y - oldPosition.y;
      st.patrolDir = { dx: Math.sign(dx), dy: Math.sign(dy) };
      const cellNow = this.dungeonManager.getCellAt(decision.position);
      if (cellNow?.type === 'corridor') st.patrolTargetDoor = undefined;
    }

    // ダンジョンマネージャーでエンティティの位置を更新
    this.dungeonManager.removeEntityFromPosition(entity, oldPosition);
    this.dungeonManager.addEntity(entity, decision.position);

    console.log(`[AI] ${entity.id} moved from (${oldPosition.x}, ${oldPosition.y}) to (${decision.position.x}, ${decision.position.y})`);
    const st4 = this.getOrCreateAIState(entity);
    st4.waitStreak = 0;
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
      const st0 = this.getOrCreateAIState(entity);
      st0.waitStreak = (st0.waitStreak || 0) + 1;
      return { moved: false };
    }

    // 移動先が有効かチェック
    if (!this.dungeonManager.isWalkable(decision.position)) {
      const st1 = this.getOrCreateAIState(entity);
      const alt1 = this.getFailureFallbackStep(entity) || this.getRandomUsableAdjacentStep(entity.position);
      if (alt1) {
        return this.forceMoveEntity(entity, alt1);
      }
      st1.waitStreak = (st1.waitStreak || 0) + 1;
      return { moved: false };
    }
    
    // アイテム以外のエンティティがいる場合は移動不可
    const entitiesAtTarget = this.dungeonManager.getEntitiesAt(decision.position);
    const blockingEntities = entitiesAtTarget.filter(e => !(e instanceof ItemEntity));
    if (blockingEntities.length > 0) {
      const st2 = this.getOrCreateAIState(entity);
      const alt2 = this.getFailureFallbackStep(entity) || this.getRandomUsableAdjacentStep(entity.position);
      if (alt2) {
        return this.forceMoveEntity(entity, alt2);
      }
      st2.waitStreak = (st2.waitStreak || 0) + 1;
      return { moved: false };
    }

    // 斜め移動の角抜けを防止
    if (this.isDiagonalMoveBlocked(entity.position, decision.position)) {
      const st3 = this.getOrCreateAIState(entity);
      const alt3 = this.getFailureFallbackStep(entity) || this.getRandomUsableAdjacentStep(entity.position);
      if (alt3) {
        return this.forceMoveEntity(entity, alt3);
      }
      st3.waitStreak = (st3.waitStreak || 0) + 1;
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
    const st4 = this.getOrCreateAIState(entity);
    st4.waitStreak = 0;
    return { moved: true };
  }

  /** 強制一歩移動（フォールバック用） */
  private forceMoveEntity(entity: GameEntity, dest: Position): { moved: boolean } {
    const old = { ...entity.position };
    entity.position.x = dest.x;
    entity.position.y = dest.y;
    if (entity instanceof MonsterEntity) {
      this.updateMonsterDirection(entity, old, dest);
      const st = this.getOrCreateAIState(entity);
      const dx = dest.x - old.x;
      const dy = dest.y - old.y;
      st.patrolDir = { dx: Math.sign(dx), dy: Math.sign(dy) };
      const cellNow = this.dungeonManager.getCellAt(dest);
      if (cellNow?.type === 'corridor') st.patrolTargetDoor = undefined;
    }
    this.dungeonManager.removeEntityFromPosition(entity, old);
    this.dungeonManager.addEntity(entity, dest);
    console.log(`[AI] ${entity.id} fallback-moved from (${old.x}, ${old.y}) to (${dest.x}, ${dest.y})`);
    const st = this.getOrCreateAIState(entity);
    st.waitStreak = 0;
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
