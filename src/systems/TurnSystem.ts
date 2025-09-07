/**
 * Turn management system - 完全同期処理によるターン管理
 */

import { GameEntity } from '../types/entities';
import { MonsterEntity } from '../entities/Monster';
import { Position } from '../types/core';
import { 
  TurnManager, 
  TurnPhase, 
  TurnAction, 
  TurnActionType,
  TurnSystemConfig,
  TurnPhaseConfig,
  EntitySpeedState,
  SpeedState
} from '../types/movement';

export class TurnSystem {
  private turnManager: TurnManager;
  private turnListeners: Map<TurnPhase, ((entities: GameEntity[]) => void)[]>;
  private config: TurnSystemConfig;
  private dungeonManager: any; // DungeonManagerの参照
  private combatSystem: any; // CombatSystemの参照
  private hungerSystem: any; // HungerSystemの参照
  private statusSystem: any; // StatusSystemの参照
  private playerEntity: any; // プレイヤーエンティティの参照
  // 敵の再試行用（一時キュー; フェーズ内限定）
  private enemyRetryQueue: GameEntity[] = [];
  private enemyRetriedThisPhase: Set<string> = new Set();
  

  constructor(
    config: TurnSystemConfig,
    dungeonManager?: any,
    combatSystem?: any,
    hungerSystem?: any,
    statusSystem?: any,
    playerEntity?: any
  ) {
    // 設定取り込み
    this.config = config;
    this.dungeonManager = dungeonManager;
    this.combatSystem = combatSystem;
    this.hungerSystem = hungerSystem;
    this.statusSystem = statusSystem;
    this.playerEntity = playerEntity;

    this.turnManager = {
      currentTurn: 1,
      turnOrder: [],
      currentEntityIndex: 0,
      turnPhase: 'turn-start',
      currentPhaseIndex: 0,
      entitySpeedStates: new Map<string, EntitySpeedState>(),
      phaseEntityStates: new Map<string, {
        hasMovedThisPhase: boolean;
        hasActedThisPhase: boolean;
        trapTriggered: boolean;
      }>()
    };
    this.turnListeners = new Map();
  }

  /**
   * Set player entity reference
   */
  setPlayerEntity(playerEntity: any): void {
    this.playerEntity = playerEntity;
  }

  

  /**
   * Initialize turn system with entities
   */
  initializeTurnOrder(entities: GameEntity[]): void {
    this.turnManager.turnOrder = [...entities];
    this.turnManager.currentEntityIndex = 0;
    this.turnManager.turnPhase = 'turn-start';
    this.turnManager.currentPhaseIndex = 0;
    
    // Initialize speed states for all entities
    this.initializeEntitySpeedStates(entities);
    
    // Initialize phase states
    this.initializePhaseStates(entities);
    
    // Sort by initiative/speed if needed
    this.sortTurnOrder();
  }

  /**
   * Initialize speed states for all entities
   */
  private initializeEntitySpeedStates(entities: GameEntity[]): void {
    this.turnManager.entitySpeedStates.clear();
    
    entities.forEach(entity => {
      const speedState: EntitySpeedState = {
        entityId: entity.id,
        speedState: entity.speedState || 'normal',
        action1State: {
          canAct: true,
          hasActed: false,
          hasMoved: false,
          hasAttacked: false,
          hasUsedItem: false
        },
        action2State: {
          canAct: false,
          hasActed: false,
          hasMoved: false,
          hasAttacked: false,
          hasUsedItem: false,
          wasAdjacentAfterAction1: false
        },
        turnsUntilNextAction: 0,
        customRules: entity.customRules || undefined
      };
      
      // 速度に基づいて行動可能性を設定
      const speedConfig = this.config.speedSystem[speedState.speedState];
      if (!speedConfig) {
        console.warn(`[TurnSystem] 速度設定が見つかりません: ${speedState.speedState}`);
        // デフォルト設定を使用
        speedState.action1State.canAct = true;
        speedState.action2State.canAct = false;
      } else {
        speedState.action1State.canAct = speedConfig.action1.enabled;
        speedState.action2State.canAct = speedConfig.action2.enabled;
      }
      
      // 鈍足エンティティの場合、最初のターンは行動できない可能性がある
      if (speedState.speedState === 'slow') {
        speedState.turnsUntilNextAction = speedConfig.action1.skipTurns || 1;
        speedState.action1State.canAct = false;
      }
      
      // デバッグログ
      if (this.isEnemy(entity)) {
        // 敵は常に行動可能にする
        speedState.action1State.canAct = true;
        speedState.action2State.canAct = false; // 2回目行動は無効
      }
      
      this.turnManager.entitySpeedStates.set(entity.id, speedState);
    });
  }

  /**
   * Initialize phase states for all entities
   */
  private initializePhaseStates(entities: GameEntity[]): void {
    this.turnManager.phaseEntityStates.clear();
    
    entities.forEach(entity => {
      this.turnManager.phaseEntityStates.set(entity.id, {
        hasMovedThisPhase: false,
        hasActedThisPhase: false,
        trapTriggered: false
      });
    });
  }

  /**
   * エンティティが特定のアクション（1回目または2回目）で行動可能かチェック
   */
  private canEntityActInAction(entity: GameEntity, actionNumber: 1 | 2, actionType: 'move' | 'attack' | 'item'): boolean {
    const speedState = this.turnManager.entitySpeedStates.get(entity.id);
    if (!speedState) return false;

    const actionState = actionNumber === 1 ? speedState.action1State : speedState.action2State;
    if (!actionState.canAct) return false;

    // 鈍足エンティティの特別処理
    if (speedState.speedState === 'slow' && speedState.turnsUntilNextAction > 0) {
      return false;
    }

    // 速度設定に基づく行動可否チェック
    const speedConfig = this.config.speedSystem[speedState.speedState];
    const actionConfig = actionNumber === 1 ? speedConfig.action1 : speedConfig.action2;
    
    // カスタムルールがある場合は優先
    const customActionConfig = speedState.customRules?.[`action${actionNumber}`];
    
    switch (actionType) {
      case 'move':
        return customActionConfig?.canMove ?? actionConfig.canMove;
      case 'attack':
        return customActionConfig?.canAttack ?? actionConfig.canAttack;
      case 'item':
        return customActionConfig?.canUseItem ?? actionConfig.canUseItem;
      default:
        return false;
    }
  }

  /**
   * 隣接ルールによる2回目行動のスキップチェック
   */
  private shouldSkipAction2DueToAdjacency(entity: GameEntity): boolean {
    const speedState = this.turnManager.entitySpeedStates.get(entity.id);
    if (!speedState || !speedState.action2State.wasAdjacentAfterAction1) return false;

    const speedConfig = this.config.speedSystem[speedState.speedState];
    return speedConfig.action2.adjacentRule || false;
  }

  /**
   * メインのターン実行メソッド - 完全同期処理
   * ドキュメントに従った順序でターンを進行
   */
  executeTurn(): void {
    // console.log(`=== ターン ${this.turnManager.currentTurn} 開始 ===`);
    
    // フェーズ状態をリセット
    this.resetPhaseStates();
    
    // 各フェーズを順番に実行（完全同期）
    for (let phaseIndex = 0; phaseIndex < this.config.phases.length; phaseIndex++) {
      const phaseConfig = this.config.phases[phaseIndex];
      this.turnManager.currentPhaseIndex = phaseIndex;
      this.turnManager.turnPhase = phaseConfig.phase;
      
      // console.log(`--- フェーズ: ${phaseConfig.phase} ---`);
      
      // フェーズを実行
      this.executePhase(phaseConfig);
    }
    
    // ターン終了処理
    this.executeEndTurnProcessing();
    
    // 自然スポーンの判定（30ターンおき）
    this.checkNaturalSpawn();
    
    // 次のターンの準備
    this.prepareNextTurn();
    
    // console.log(`=== ターン ${this.turnManager.currentTurn - 1} 終了 ===\n`);
  }

  /**
   * 特定のフェーズを実行
   */
  private executePhase(phaseConfig: TurnPhaseConfig): void {
    let relevantEntities = this.getEntitiesForPhase(phaseConfig.phase);
    const isEnemyPhase = (phaseConfig.phase === 'enemy-action-1' || phaseConfig.phase === 'enemy-action-2');
    if (isEnemyPhase) {
      // フェーズ開始時に再試行キューを初期化
      this.enemyRetryQueue = [];
      this.enemyRetriedThisPhase.clear();
      // プレイヤーに近い順に処理（渋滞緩和）
      if (this.playerEntity) {
        const p = this.playerEntity.position;
        relevantEntities = [...relevantEntities].sort((a: any, b: any) => {
          const da = Math.abs(a.position.x - p.x) + Math.abs(a.position.y - p.y);
          const db = Math.abs(b.position.x - p.x) + Math.abs(b.position.y - p.y);
          return da - db;
        });
      }
    }
    
    for (const entity of relevantEntities) {
      // フェーズの実行条件をチェック
      if (!this.checkPhaseConditions(entity, phaseConfig)) {
        // console.log(`  ${entity.id}: 条件により ${phaseConfig.phase} をスキップ`);
        continue;
      }
      
      // 速度システムによる行動制限をチェック
      // エンティティがこのフェーズで行動可能かチェック
      if (!this.checkPhaseConditions(entity, phaseConfig)) {
        // console.log(`  ${entity.id}: 速度制限により ${phaseConfig.phase} をスキップ`);
        continue;
      }
      
      // フェーズ固有の処理を実行
      this.executeEntityPhaseAction(entity, phaseConfig.phase);
      
      // 敵の行動状況をログ出力（デバッグ用）
      if (this.isEnemy(entity)) {
        const speedState = this.turnManager.entitySpeedStates.get(entity.id);
        if (speedState) {
          console.log(`[TurnSystem] 敵${entity.id}の行動状況: 移動=${speedState.action1State.hasMoved}, 攻撃=${speedState.action1State.hasAttacked}, 行動済み=${speedState.action1State.hasActed}`);
        }
      }
    }

    // 敵フェーズのみ：移動失敗者を一回だけ再試行
    if (isEnemyPhase && this.enemyRetryQueue.length > 0) {
      const retryList = [...this.enemyRetryQueue];
      this.enemyRetryQueue = [];
      for (const entity of retryList) {
        if (!this.turnManager.entitySpeedStates.get(entity.id)) continue; // 既にいない
        this.executeEnemyAction(entity, phaseConfig.phase === 'enemy-action-1' ? 1 : 2);
      }
    }
  }

  /**
   * エンティティの特定フェーズでの行動を実行
   */
  private executeEntityPhaseAction(entity: GameEntity, phase: TurnPhase): void {
    const speedState = this.turnManager.entitySpeedStates.get(entity.id);
    const phaseState = this.turnManager.phaseEntityStates.get(entity.id);
    
    if (!speedState || !phaseState) return;
    
    switch (phase) {
      case 'turn-start':
        this.executeTurnStart(entity);
        break;
      case 'player-action-1':
        this.executePlayerAction(entity, 1);
        break;
      case 'player-action-2':
        this.executePlayerAction(entity, 2);
        break;
      case 'enemy-action-1':
        this.executeEnemyAction(entity, 1);
        break;
      case 'enemy-action-2':
        this.executeEnemyAction(entity, 2);
        break;
      case 'ally-action-1':
        this.executeAllyAction(entity, 1);
        break;
      case 'ally-action-2':
        this.executeAllyAction(entity, 2);
        break;
      case 'trap-processing-1':
        this.executeTrapProcessing(entity, 1);
        break;
      case 'trap-processing-2':
        this.executeTrapProcessing(entity, 2);
        break;
      case 'end-turn-recovery':
        this.executeEndTurnRecovery(entity);
        break;
    }
  }

  /**
   * ターン開始処理
   */
  private executeTurnStart(entity: GameEntity): void {
    // ターン開始時の処理（新規敵出現など）
    // console.log(`  ターン開始処理: ${entity.id}`);
    
    // 敵の場合、プレイヤーに対する方向を更新
    if (this.isEnemy(entity) && this.playerEntity && (entity as any).updateDirection) {
      (entity as any).updateDirection(this.playerEntity.position);
      // console.log(`  ${entity.id}: 方向更新 - ${(entity as any).currentDirection}`);
    }

    // プレイヤーの残り香を記録
    if (this.isPlayer(entity) && this.dungeonManager) {
      try {
        this.dungeonManager.setPlayerScent(entity.position, this.getCurrentTurn());
      } catch {}
    }

    // 敵AIの基本行動（approach/patrol）をターン開始時に決定
    if (this.isEnemy(entity) && this.dungeonManager?.aiSystem) {
      try {
        this.dungeonManager.aiSystem.decidePatternForTurn(entity);
      } catch (e) {
        console.warn(`[TurnSystem] decidePatternForTurn でエラー:`, e);
      }
    }
  }

  /**
   * プレイヤー行動フェーズ
   */
  private executePlayerAction(entity: GameEntity, actionNumber: 1 | 2): void {
    if (!this.isPlayer(entity)) return;
    
    const speedState = this.turnManager.entitySpeedStates.get(entity.id);
    if (!speedState) return;
    
    const actionState = actionNumber === 1 ? speedState.action1State : speedState.action2State;
    
    // 行動可能かチェック
    if (!actionState.canAct) {
      // console.log(`  ${entity.id}: プレイヤー${actionNumber}回目行動 - 行動不可`);
      return;
    }
    
    // 隣接ルールチェック（2回目行動のみ）
    if (actionNumber === 2 && this.shouldSkipAction2DueToAdjacency(entity)) {
      // console.log(`  ${entity.id}: プレイヤー2回目行動 - 隣接によりスキップ`);
      return;
    }
    
    // console.log(`  ${entity.id}: プレイヤー${actionNumber}回目行動実行`);
    // プレイヤー行動は外部から制御されるため、ここでは状態更新のみ
    actionState.hasActed = true;
  }

  /**
   * 敵行動フェーズ
   */
  private executeEnemyAction(entity: GameEntity, actionNumber: 1 | 2): void {
    if (!this.isEnemy(entity)) return;
    
    const speedState = this.turnManager.entitySpeedStates.get(entity.id);
    if (!speedState) return;
    
    const actionState = actionNumber === 1 ? speedState.action1State : speedState.action2State;
    
    // 行動可能かチェック
    if (!actionState.canAct) {
      // console.log(`  ${entity.id}: 敵${actionNumber}回目行動 - 行動不可`);
      return;
    }
    
    // 隣接ルールチェック（2回目行動のみ）
    if (actionNumber === 2 && this.shouldSkipAction2DueToAdjacency(entity)) {
      // console.log(`  ${entity.id}: 敵2回目行動 - 隣接によりスキップ`);
      return;
    }
    
    // ターン開始時に方向を更新（その場での方向転換）
    if (entity instanceof MonsterEntity && this.dungeonManager?.aiSystem) {
      this.dungeonManager.aiSystem.updateMonsterDirectionForPlayer(entity);
    }
    
    // console.log(`  ${entity.id}: 敵${actionNumber}回目行動処理`);
    
    // AI による行動処理
    if (this.dungeonManager && this.dungeonManager.aiSystem) {
      console.log(`[TurnSystem] 敵${actionNumber}回目行動: ${entity.id} - 移動可能=${this.canEntityActInAction(entity, actionNumber, 'move')}, 攻撃可能=${this.canEntityActInAction(entity, actionNumber, 'attack')}`);
      
      // AI決定を1回だけ取得
      const aiDecision = this.dungeonManager.aiSystem.processAI(entity);
      console.log(`[TurnSystem] 敵のAI決定: ${entity.id} - ${JSON.stringify(aiDecision)}`);
      
      if (aiDecision) {
        // 移動可能かチェック
        if (aiDecision.action === 'move' && aiDecision.position && this.canEntityActInAction(entity, actionNumber, 'move')) {
          console.log(`[TurnSystem] 敵の移動処理開始: ${entity.id}`);
          const moveResult = this.dungeonManager.aiSystem.processEntityMovementWithDecision(entity, aiDecision);
          console.log(`[TurnSystem] 敵の移動結果: ${entity.id} - ${JSON.stringify(moveResult)}`);
          if (moveResult?.moved) {
            actionState.hasMoved = true;
            // 1回目行動後の隣接チェック
            if (actionNumber === 1) {
              speedState.action2State.wasAdjacentAfterAction1 = this.isAdjacentToPlayerOrAlly(entity);
            }
          } else {
            // 移動失敗 → 同一フェーズ内で1回だけ再試行
            if (this.enemyRetryQueue && !this.enemyRetriedThisPhase.has(entity.id)) {
              this.enemyRetryQueue.push(entity);
              this.enemyRetriedThisPhase.add(entity.id);
            }
          }
        } else if (aiDecision.action === 'attack' && aiDecision.target && !actionState.hasMoved && this.canEntityActInAction(entity, actionNumber, 'attack')) {
          // 攻撃可能かチェック（移動していない場合のみ）
          console.log(`[TurnSystem] 敵の攻撃処理開始: ${entity.id}`);
          const attackResult = this.dungeonManager.aiSystem.processEntityAttackWithDecision(entity, aiDecision);
          console.log(`[TurnSystem] 敵の攻撃結果: ${entity.id} - ${JSON.stringify(attackResult)}`);
          if (attackResult?.attacked) {
            actionState.hasAttacked = true;
          }
        } else {
          console.log(`[TurnSystem] 敵の行動が無効: ${entity.id} - AI決定=${aiDecision.action}, 移動済み=${actionState.hasMoved}, 移動可能=${this.canEntityActInAction(entity, actionNumber, 'move')}, 攻撃可能=${this.canEntityActInAction(entity, actionNumber, 'attack')}`);
        }
      } else {
        console.log(`[TurnSystem] AI決定なし: ${entity.id}`);
      }
    } else {
      console.log(`[TurnSystem] AIシステムが利用できません: ${entity.id} - dungeonManager=${!!this.dungeonManager}, aiSystem=${!!this.dungeonManager?.aiSystem}`);
    }
    
    actionState.hasActed = true;
  }

  /**
   * 味方行動フェーズ
   */
  private executeAllyAction(entity: GameEntity, actionNumber: 1 | 2): void {
    if (!this.isAlly(entity)) return;
    
    const speedState = this.turnManager.entitySpeedStates.get(entity.id);
    if (!speedState) return;
    
    const actionState = actionNumber === 1 ? speedState.action1State : speedState.action2State;
    
    // 行動可能かチェック
    if (!actionState.canAct) {
      // console.log(`  ${entity.id}: 味方${actionNumber}回目行動 - 行動不可`);
      return;
    }
    
    // 隣接ルールチェック（2回目行動のみ）
    if (actionNumber === 2 && this.shouldSkipAction2DueToAdjacency(entity)) {
      // console.log(`  ${entity.id}: 味方2回目行動 - 隣接によりスキップ`);
      return;
    }
    
    // console.log(`  ${entity.id}: 味方${actionNumber}回目行動処理`);
    
    // AI による行動処理
    if (this.dungeonManager && this.dungeonManager.aiSystem) {
      // 移動可能かチェック
      if (this.canEntityActInAction(entity, actionNumber, 'move')) {
        const moveResult = this.dungeonManager.aiSystem.processEntityMovement(entity);
        if (moveResult?.moved) {
          actionState.hasMoved = true;
          // 1回目行動後の隣接チェック
          if (actionNumber === 1) {
            speedState.action2State.wasAdjacentAfterAction1 = this.isAdjacentToEnemy(entity);
          }
        }
      }
      
      // 攻撃可能かチェック（移動していない場合のみ）
      if (!actionState.hasMoved && this.canEntityActInAction(entity, actionNumber, 'attack')) {
        const attackResult = this.dungeonManager.aiSystem.processEntityAttack(entity);
        if (attackResult?.attacked) {
          actionState.hasAttacked = true;
        }
      }
    }
    
    actionState.hasActed = true;
  }

  /**
   * 罠処理フェーズ
   */
  private executeTrapProcessing(entity: GameEntity, actionNumber: 1 | 2): void {
    const speedState = this.turnManager.entitySpeedStates.get(entity.id);
    if (!speedState) return;
    
    const actionState = actionNumber === 1 ? speedState.action1State : speedState.action2State;
    
    // 該当するアクションで移動していた場合のみ罠チェック
    if (actionState.hasMoved) {
      console.log(`  ${entity.id}: ${actionNumber}回目行動後の罠チェック`);
      // 罠処理
      if (this.dungeonManager && typeof this.dungeonManager.checkTrapsAt === 'function') {
        try {
          const trapResult = this.dungeonManager.checkTrapsAt(entity.position);
          if (trapResult?.triggered) {
            const phaseState = this.turnManager.phaseEntityStates.get(entity.id);
            if (phaseState) {
              phaseState.trapTriggered = true;
            }
            console.log(`  ${entity.id}: 罠発動 - ${trapResult.trapType}`);
          }
        } catch (error) {
          console.warn(`  ${entity.id}: 罠チェック中にエラーが発生:`, error);
        }
      } else {
        console.log(`  ${entity.id}: 罠システムが利用できません（checkTrapsAtメソッドなし）`);
      }
    }
  }

  /**
   * ターン終了時回復処理
   */
  private executeEndTurnRecovery(entity: GameEntity): void {
    console.log(`  ${entity.id}: ターン終了時回復処理`);
    // プレイヤーのみ自然回復を適用
    if (!this.isPlayer(entity)) return;

    const stats = entity.stats as any;
    if (!stats || typeof stats.hp !== 'number' || typeof stats.maxHp !== 'number') return;

    // 戦闘不能や満タン時は何もしない
    if (stats.hp <= 0 || stats.hp >= stats.maxHp) return;

    // 満腹度が0のときは回復しない
    const playerLike = entity as any;
    if (typeof playerLike.hunger === 'number' && typeof playerLike.maxHunger === 'number') {
      if (playerLike.hunger <= 0) {
        // 進捗は維持（空腹が解消された後に再開）
        return;
      }
    }

    // 仕様:
    // - 1回復に必要な歩数 = 150 / 現在の最大HP
    // - 1歩あたりの回復量 = 現在の最大HP / 150
    // - 1歩あたりの回復上限 = 5
    const perStepRecovery = Math.min(5, stats.maxHp / 150);
    if (perStepRecovery <= 0) return;

    // 端数を蓄積して繰り上げ回復する
    const progressKey = 'hpRegenProgress';
    const currentProgress: number = typeof stats[progressKey] === 'number' ? stats[progressKey] : 0;
    let progress = currentProgress + perStepRecovery;

    const wholeHeal = Math.floor(progress);
    if (wholeHeal > 0) {
      const actualHeal = Math.min(wholeHeal, stats.maxHp - stats.hp);
      stats.hp = Math.min(stats.maxHp, stats.hp + actualHeal);
      progress -= wholeHeal; // 使った分の端数を差し引き
      console.log(`    自然回復: +${actualHeal} (進捗=${progress.toFixed(2)})`);
    }

    stats[progressKey] = progress;
  }

  /**
   * フェーズ条件をチェック
   */
  private checkPhaseConditions(entity: GameEntity, phaseConfig: TurnPhaseConfig): boolean {
    for (const condition of phaseConfig.conditions) {
      switch (condition) {
        case 'fast-entities-only':
          const speedState = this.turnManager.entitySpeedStates.get(entity.id);
          if (!speedState || speedState.speedState !== 'fast') return false;
          break;
        case 'player-is-fast':
          if (!this.isPlayer(entity)) return false;
          const playerSpeedState = this.turnManager.entitySpeedStates.get(entity.id);
          if (!playerSpeedState || playerSpeedState.speedState !== 'fast') return false;
          break;
        case 'enemy-is-fast':
          if (!this.isEnemy(entity)) return false;
          const enemySpeedState = this.turnManager.entitySpeedStates.get(entity.id);
          if (!enemySpeedState || enemySpeedState.speedState !== 'fast') return false;
          break;
        case 'ally-is-fast':
          if (!this.isAlly(entity)) return false;
          const allySpeedState = this.turnManager.entitySpeedStates.get(entity.id);
          if (!allySpeedState || allySpeedState.speedState !== 'fast') return false;
          break;
      }
    }
    return true;
  }



  /**
   * エンティティタイプ判定メソッド
   */
  private isPlayer(entity: GameEntity): boolean {
    return entity.constructor.name === 'PlayerEntity' || entity.id.startsWith('player');
  }

  private isAlly(entity: GameEntity): boolean {
    return entity.constructor.name === 'CompanionEntity' || entity.id.startsWith('ally');
  }

  private isEnemy(entity: GameEntity): boolean {
    return entity.constructor.name === 'MonsterEntity' || entity.id.startsWith('enemy');
  }

  /**
   * 隣接チェックメソッド
   */
  private isAdjacentToEnemy(entity: GameEntity): boolean {
    if (!this.dungeonManager) return false;
    
    const adjacentPositions = this.getAdjacentPositions(entity.position);
    for (const pos of adjacentPositions) {
      const entitiesAtPos = this.dungeonManager.getEntitiesAt(pos);
      if (entitiesAtPos.some((e: GameEntity) => this.isEnemy(e))) {
        return true;
      }
    }
    return false;
  }

  private isAdjacentToPlayerOrAlly(entity: GameEntity): boolean {
    if (!this.dungeonManager) return false;
    
    const adjacentPositions = this.getAdjacentPositions(entity.position);
    for (const pos of adjacentPositions) {
      const entitiesAtPos = this.dungeonManager.getEntitiesAt(pos);
      if (entitiesAtPos.some((e: GameEntity) => this.isPlayer(e) || this.isAlly(e))) {
        return true;
      }
    }
    return false;
  }

  private playerMovedOntoTrap(): boolean {
    const playerEntity = this.turnManager.turnOrder.find(e => this.isPlayer(e));
    if (!playerEntity) return false;
    
    const phaseState = this.turnManager.phaseEntityStates.get(playerEntity.id);
    return phaseState?.hasMovedThisPhase || false;
  }

  private getAdjacentPositions(pos: { x: number; y: number }): { x: number; y: number }[] {
    return [
      { x: pos.x - 1, y: pos.y },     // 左
      { x: pos.x + 1, y: pos.y },     // 右
      { x: pos.x, y: pos.y - 1 },     // 上
      { x: pos.x, y: pos.y + 1 }      // 下
    ];
  }

  /**
   * Get current active entity
   */
  getCurrentEntity(): GameEntity | null {
    if (this.turnManager.turnOrder.length === 0) return null;
    
    const index = this.turnManager.currentEntityIndex;
    return this.turnManager.turnOrder[index] || null;
  }

  /**
   * Get current turn number
   */
  getCurrentTurn(): number {
    return this.turnManager.currentTurn;
  }

  /**
   * Get current turn phase
   */
  getCurrentPhase(): TurnPhase {
    return this.turnManager.turnPhase;
  }

  /**
   * Process a turn action
   */
  processTurnAction(action: TurnAction): boolean {
    const currentEntity = this.getCurrentEntity();
    
    if (!currentEntity || currentEntity !== action.entity) {
      return false; // Not this entity's turn
    }

    // Validate action based on current phase
    if (!this.isActionValidForPhase(action, this.turnManager.turnPhase)) {
      return false;
    }

    // Process the action
    this.executeAction(action);

    // Advance turn if action consumed full turn
    if (action.cost >= 1.0) {
      this.advanceTurn();
    }

    return true;
  }

  /**
   * Advance to next entity/phase
   */
  advanceTurn(): void {
    this.turnManager.currentEntityIndex++;
    
    // Check if we've gone through all entities
    if (this.turnManager.currentEntityIndex >= this.turnManager.turnOrder.length) {
      this.advancePhase();
    }
  }

  /**
   * Advance to next phase
   */
  private advancePhase(): void {
    const phases: TurnPhase[] = [
      'turn-start',
      'player-action-1',
      'enemy-action-1',
      'ally-action-1',
      'trap-processing-1',
      'player-action-2',
      'enemy-action-2',
      'ally-action-2',
      'trap-processing-2',
      'end-turn-recovery',
      'end-turn'
    ];

    const currentPhaseIndex = phases.indexOf(this.turnManager.turnPhase);
    const nextPhaseIndex = (currentPhaseIndex + 1) % phases.length;
    
    this.turnManager.turnPhase = phases[nextPhaseIndex];
    this.turnManager.currentEntityIndex = 0;

    // If we're back to turn-start, increment turn counter
    if (this.turnManager.turnPhase === 'turn-start') {
      this.turnManager.currentTurn++;
    }

    // Notify listeners
    this.notifyPhaseListeners(this.turnManager.turnPhase);
  }

  /**
   * Skip current entity's turn
   */
  skipTurn(): void {
    this.advanceTurn();
  }

  /**
   * Force advance to specific phase
   */
  setPhase(phase: TurnPhase): void {
    this.turnManager.turnPhase = phase;
    this.turnManager.currentEntityIndex = 0;
    this.notifyPhaseListeners(phase);
  }

  /**
   * Check if action is valid for current phase
   */
  private isActionValidForPhase(action: TurnAction, phase: TurnPhase): boolean {
    switch (phase) {
      case 'player-action-1':
      case 'player-action-2':
        return true; // Player can do any action during their phase
      case 'ally-action-1':
      case 'ally-action-2':
        return action.type === 'move' || action.type === 'wait';
      case 'enemy-action-1':
      case 'enemy-action-2':
        return action.type === 'move' || action.type === 'wait';
      default:
        return false; // No actions allowed during other phases
    }
  }

  /**
   * Execute a turn action
   */
  private executeAction(action: TurnAction): void {
    // This is a placeholder - actual action execution would be handled
    // by other systems (MovementSystem, CombatSystem, etc.)
    console.log(`Executing ${action.type} action for entity ${action.entity.id}`);
  }



  /**
   * Add listener for phase changes
   */
  addPhaseListener(phase: TurnPhase, callback: (entities: GameEntity[]) => void): void {
    if (!this.turnListeners.has(phase)) {
      this.turnListeners.set(phase, []);
    }
    this.turnListeners.get(phase)!.push(callback);
  }

  /**
   * Remove phase listener
   */
  removePhaseListener(phase: TurnPhase, callback: (entities: GameEntity[]) => void): void {
    const listeners = this.turnListeners.get(phase);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Notify phase listeners
   */
  private notifyPhaseListeners(phase: TurnPhase): void {
    const listeners = this.turnListeners.get(phase);
    if (listeners) {
      const relevantEntities = this.getEntitiesForPhase(phase);
      listeners.forEach(callback => callback(relevantEntities));
    }
  }



  /**
   * Create a turn action
   */
  createAction(
    type: TurnActionType, 
    entity: GameEntity, 
    data?: any, 
    cost: number = 1.0
  ): TurnAction {
    return {
      type,
      entity,
      data,
      cost
    };
  }

  /**
   * Check if it's a specific entity's turn
   */
  isEntityTurn(entity: GameEntity): boolean {
    return this.getCurrentEntity() === entity;
  }

  /**
   * ターン終了処理を実行
   */
  private executeEndTurnProcessing(): void {
    console.log('--- ターン終了処理 ---');
    
    // 設定された順序で処理を実行
    for (const process of this.config.endTurnProcessing) {
      switch (process.process) {
        case 'death-check':
          this.processDeathCheck();
          break;
        case 'status-recovery':
          this.processStatusRecovery();
          break;
        case 'slip-damage':
          this.processSlipDamage();
          break;
        case 'hunger-decrease':
          this.processHungerDecrease();
          break;
      }
    }
  }

  /**
   * 状態異常回復処理
   */
  private processStatusRecovery(): void {
    for (const entity of this.turnManager.turnOrder) {
      if (this.statusSystem) {
        this.statusSystem.processStatusRecovery(entity);
      }
    }
  }

  /**
   * スリップダメージ処理
   */
  private processSlipDamage(): void {
    for (const entity of this.turnManager.turnOrder) {
      if (this.statusSystem) {
        this.statusSystem.processSlipDamage(entity);
      }
    }
  }

  /**
   * 満腹度減少処理
   */
  private processHungerDecrease(): void {
    for (const entity of this.turnManager.turnOrder) {
      if (this.hungerSystem) {
        this.hungerSystem.processHunger(entity);
      }
    }
  }

  /**
   * 次のターンの準備
   */
  private prepareNextTurn(): void {
    // ターン番号を増加
    this.turnManager.currentTurn++;
    
    // 速度状態を更新
    this.updateEntitySpeedStates();
    
    // フェーズ状態をリセット
    this.resetPhaseStates();
    
    // フェーズを最初に戻す
    this.turnManager.currentPhaseIndex = 0;
    this.turnManager.turnPhase = this.config.phases[0].phase;
  }

  /**
   * エンティティの速度状態を更新
   */
  private updateEntitySpeedStates(): void {
    for (const [entityId, speedState] of this.turnManager.entitySpeedStates) {
      // 鈍足エンティティのターンカウンタを減少
      if (speedState.speedState === 'slow' && speedState.turnsUntilNextAction > 0) {
        speedState.turnsUntilNextAction--;
      }
      
      // 速度設定に基づいて行動可能性を再設定
      const speedConfig = this.config.speedSystem[speedState.speedState];
      
      // 1回目行動状態をリセット
      speedState.action1State = {
        canAct: speedConfig.action1.enabled && (speedState.speedState !== 'slow' || speedState.turnsUntilNextAction === 0),
        hasActed: false,
        hasMoved: false,
        hasAttacked: false,
        hasUsedItem: false
      };
      
      // 2回目行動状態をリセット
      speedState.action2State = {
        canAct: speedConfig.action2.enabled,
        hasActed: false,
        hasMoved: false,
        hasAttacked: false,
        hasUsedItem: false,
        wasAdjacentAfterAction1: false
      };
    }
  }

  /**
   * フェーズ状態をリセット
   */
  private resetPhaseStates(): void {
    for (const [entityId, phaseState] of this.turnManager.phaseEntityStates) {
      phaseState.hasMovedThisPhase = false;
      phaseState.hasActedThisPhase = false;
      phaseState.trapTriggered = false;
    }
  }

  /**
   * フェーズに関連するエンティティを取得
   */
  private getEntitiesForPhase(phase: TurnPhase): GameEntity[] {
    switch (phase) {
      case 'turn-start':
        return this.turnManager.turnOrder; // 全エンティティ
      case 'player-action-1':
      case 'player-action-2':
        return this.turnManager.turnOrder.filter(entity => this.isPlayer(entity));
      case 'enemy-action-1':
      case 'enemy-action-2':
        return this.turnManager.turnOrder.filter(entity => this.isEnemy(entity));
      case 'ally-action-1':
      case 'ally-action-2':
        return this.turnManager.turnOrder.filter(entity => this.isAlly(entity));
      case 'trap-processing-1':
      case 'trap-processing-2':
      case 'end-turn-recovery':
        return this.turnManager.turnOrder; // 全エンティティ
      default:
        return this.turnManager.turnOrder;
    }
  }

  /**
   * エンティティを追加
   */
  addEntity(entity: GameEntity): void {
    if (!this.turnManager.turnOrder.includes(entity)) {
      this.turnManager.turnOrder.push(entity);
      
      // 速度状態を初期化
      const speedState: EntitySpeedState = {
        entityId: entity.id,
        speedState: entity.speedState || 'normal',
        action1State: {
          canAct: true,
          hasActed: false,
          hasMoved: false,
          hasAttacked: false,
          hasUsedItem: false
        },
        action2State: {
          canAct: false,
          hasActed: false,
          hasMoved: false,
          hasAttacked: false,
          hasUsedItem: false,
          wasAdjacentAfterAction1: false
        },
        turnsUntilNextAction: 0,
        customRules: entity.customRules || undefined
      };
      
      // 速度に基づいて行動可能性を設定
      const speedConfig = this.config.speedSystem[speedState.speedState];
      speedState.action1State.canAct = speedConfig.action1.enabled;
      speedState.action2State.canAct = speedConfig.action2.enabled;
      
      this.turnManager.entitySpeedStates.set(entity.id, speedState);
      
      // フェーズ状態を初期化
      this.turnManager.phaseEntityStates.set(entity.id, {
        hasMovedThisPhase: false,
        hasActedThisPhase: false,
        trapTriggered: false
      });
      
      this.sortTurnOrder();
    }
  }



  /**
   * プレイヤー行動を記録（外部から呼び出される）
   */
  recordPlayerAction(entity: GameEntity, actionType: 'move' | 'attack' | 'item', moved: boolean = false): void {
    const speedState = this.turnManager.entitySpeedStates.get(entity.id);
    const phaseState = this.turnManager.phaseEntityStates.get(entity.id);
    
    if (speedState && phaseState) {
      // 現在のフェーズに基づいて、1回目か2回目の行動かを判定
      const currentPhase = this.turnManager.turnPhase;
      const actionNumber = currentPhase === 'player-action-2' ? 2 : 1;
      const actionState = actionNumber === 1 ? speedState.action1State : speedState.action2State;
      
      // 行動タイプに基づいて状態を更新
      switch (actionType) {
        case 'move':
          actionState.hasMoved = true;
          phaseState.hasMovedThisPhase = true;
          
          // 1回目行動後の隣接チェック
          if (actionNumber === 1) {
            speedState.action2State.wasAdjacentAfterAction1 = this.isAdjacentToPlayerOrAlly(entity);
          }
          break;
        case 'attack':
          actionState.hasAttacked = true;
          break;
        case 'item':
          actionState.hasUsedItem = true;
          break;
      }
      
      actionState.hasActed = true;
      phaseState.hasActedThisPhase = true;
      console.log(`プレイヤー${actionNumber}回目行動記録: ${actionType}`);
    }
  }

  /**
   * Get turn statistics
   */
  getTurnStats(): {
    currentTurn: number;
    currentPhase: TurnPhase;
    currentEntity: string | null;
    totalEntities: number;
    entityIndex: number;
  } {
    const currentEntity = this.getCurrentEntity();
    
    return {
      currentTurn: this.turnManager.currentTurn,
      currentPhase: this.turnManager.turnPhase,
      currentEntity: currentEntity ? currentEntity.id : null,
      totalEntities: this.turnManager.turnOrder.length,
      entityIndex: this.turnManager.currentEntityIndex
    };
  }

  /**
   * Sort turn order by initiative/speed
   */
  private sortTurnOrder(): void {
    // プレイヤーを最初に、その後は敵・味方の順
    this.turnManager.turnOrder.sort((a, b) => {
      if (this.isPlayer(a)) return -1;
      if (this.isPlayer(b)) return 1;
      if (this.isAlly(a) && this.isEnemy(b)) return -1;
      if (this.isEnemy(a) && this.isAlly(b)) return 1;
      return 0;
    });
  }

  /**
   * Remove entity from turn system
   */
  removeEntity(entity: GameEntity): void {
    // ターン順序から削除
    this.turnManager.turnOrder = this.turnManager.turnOrder.filter(e => e.id !== entity.id);
    
    // 速度状態から削除
    this.turnManager.entitySpeedStates.delete(entity.id);
    
    // フェーズ状態から削除
    this.turnManager.phaseEntityStates.delete(entity.id);
    
    // 現在のエンティティインデックスを調整
    if (this.turnManager.currentEntityIndex >= this.turnManager.turnOrder.length) {
      this.turnManager.currentEntityIndex = Math.max(0, this.turnManager.turnOrder.length - 1);
    }
    
    console.log(`[TurnSystem] エンティティを削除: ${entity.id}`);
  }

  /**
   * Reset turn system
   */
  reset(): void {
    this.turnManager = {
      currentTurn: 1,
      turnOrder: [],
      currentEntityIndex: 0,
      turnPhase: 'turn-start',
      currentPhaseIndex: 0,
      entitySpeedStates: new Map<string, EntitySpeedState>(),
      phaseEntityStates: new Map<string, {
        hasMovedThisPhase: boolean;
        hasActedThisPhase: boolean;
        trapTriggered: boolean;
      }>()
    };
  }

  /**
   * 自然スポーンの判定（30ターンおき）
   */
  private checkNaturalSpawn(): void {
    // 30ターンおきに判定
    if (this.turnManager.currentTurn % 30 !== 0) {
      return;
    }

    // フロア内の敵の数をカウント
    const enemyCount = this.countEnemiesOnFloor();
    console.log(`[TurnSystem] 自然スポーン判定: ターン${this.turnManager.currentTurn}, 現在の敵数: ${enemyCount}`);

    // 敵の数が20未満の場合、自然スポーンを実行
    if (enemyCount < 20) {
      this.executeNaturalSpawn();
    }
  }

  /**
   * フロア内の敵の数をカウント
   */
  private countEnemiesOnFloor(): number {
    if (!this.dungeonManager) return 0;
    
    const allEntities = this.dungeonManager.getAllEntities();
    return allEntities.filter((entity: GameEntity) => this.isEnemy(entity)).length;
  }

  /**
   * 自然スポーンを実行
   */
  private executeNaturalSpawn(): void {
    if (!this.dungeonManager) return;

    // プレイヤーが居る部屋を取得（通路に居る場合はnull）
    const playerRoom = this.getPlayerRoom();
    
    // 利用可能な部屋を取得（プレイヤーが部屋に居る場合はその部屋以外、通路に居る場合は全部屋）
    const availableRooms = this.getAvailableRoomsForSpawn(playerRoom);
    if (availableRooms.length === 0) return;

    // スポーン数を決定（0〜2体）
    const spawnCount = Math.floor(Math.random() * 3);
    console.log(`[TurnSystem] 自然スポーン実行: ${spawnCount}体を${availableRooms.length}個の部屋に配置`);

    // 各部屋にランダムにスポーン
    for (let i = 0; i < spawnCount; i++) {
      const randomRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
      const spawnPosition = this.getRandomPositionInRoom(randomRoom);
      
      if (spawnPosition) {
        this.spawnMonsterAtPosition(spawnPosition);
      }
    }
  }

  /**
   * プレイヤーが居る部屋を取得
   */
  private getPlayerRoom(): any {
    if (!this.dungeonManager || !this.playerEntity) return null;
    
    const playerPos = this.playerEntity.position;
    const cell = this.dungeonManager.getCellAt(playerPos);
    
    // 部屋の情報を取得（ダンジョンマネージャーから部屋のリストを取得）
    if (this.dungeonManager.currentDungeon?.rooms) {
      for (const room of this.dungeonManager.currentDungeon.rooms) {
        if (this.isPositionInRoom(playerPos, room)) {
          return room;
        }
      }
    }
    
    return null;
  }

  /**
   * 位置が部屋内かどうかを判定
   */
  private isPositionInRoom(position: Position, room: any): boolean {
    return position.x >= room.x && 
           position.x < room.x + room.width &&
           position.y >= room.y && 
           position.y < room.y + room.height;
  }

  /**
   * スポーン可能な部屋のリストを取得（プレイヤーが居る部屋以外、通路に居る場合は全部屋）
   */
  private getAvailableRoomsForSpawn(excludeRoom: any): any[] {
    if (!this.dungeonManager?.currentDungeon?.rooms) return [];
    
    // プレイヤーが通路に居る場合（excludeRoomがnull）は全部屋を対象
    if (!excludeRoom) {
      return this.dungeonManager.currentDungeon.rooms.filter((room: any) => 
        this.isRoomSuitableForSpawn(room)
      );
    }
    
    // プレイヤーが部屋に居る場合はその部屋以外
    return this.dungeonManager.currentDungeon.rooms.filter((room: any) => 
      room !== excludeRoom && 
      this.isRoomSuitableForSpawn(room)
    );
  }

  /**
   * 部屋がスポーンに適しているかチェック
   */
  private isRoomSuitableForSpawn(room: any): boolean {
    // 部屋のサイズが適切かチェック
    if (room.width < 3 || room.height < 3) return false;
    
    // 部屋内に既に多くの敵がいないかチェック
    const enemyCountInRoom = this.countEnemiesInRoom(room);
    return enemyCountInRoom < 5; // 1部屋あたり最大5体まで
  }

  /**
   * 部屋内の敵の数をカウント
   */
  private countEnemiesInRoom(room: any): number {
    if (!this.dungeonManager) return 0;
    
    let count = 0;
    for (let x = room.x; x < room.x + room.width; x++) {
      for (let y = room.y; y < room.y + room.height; y++) {
        const entities = this.dungeonManager.getEntitiesAt({ x, y });
        count += entities.filter((entity: GameEntity) => this.isEnemy(entity)).length;
      }
    }
    return count;
  }

  /**
   * 部屋内のランダムな位置を取得
   */
  private getRandomPositionInRoom(room: any): Position | null {
    const maxAttempts = 10;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = room.x + Math.floor(Math.random() * room.width);
      const y = room.y + Math.floor(Math.random() * room.height);
      const position = { x, y };
      
      // 位置が有効かチェック
      if (this.isValidSpawnPosition(position)) {
        return position;
      }
    }
    
    return null;
  }

  /**
   * スポーン位置が有効かチェック
   */
  private isValidSpawnPosition(position: Position): boolean {
    if (!this.dungeonManager) return false;
    
    // 歩行可能かチェック
    if (!this.dungeonManager.isWalkable(position)) return false;
    
    // 部屋内かチェック
    const cell = this.dungeonManager.getCellAt(position);
    if (!cell || cell.type !== 'room') return false;
    
    // 他のエンティティと重ならないかチェック
    const entities = this.dungeonManager.getEntitiesAt(position);
    return entities.length === 0;
  }

  /**
   * 指定位置にモンスターをスポーン
   */
  private spawnMonsterAtPosition(position: Position): void {
    if (!this.dungeonManager) return;
    
    // モンスターテンプレートを取得（設定から）
    const monsterTemplate = this.getMonsterTemplate();
    if (!monsterTemplate) return;
    
    // モンスターを作成
    const monster = new MonsterEntity(
      `${monsterTemplate.id}-natural-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      monsterTemplate.name,
      monsterTemplate.monsterType,
      position,
      monsterTemplate.stats ? { ...monsterTemplate.stats } : { hp: 20, maxHp: 20, attack: 5, defense: 2, evasionRate: 0.05 },
      undefined, // attributes
      monsterTemplate.movementPattern || 'approach',
      monsterTemplate.movementConfig,
      monsterTemplate.spriteId
    );
    
    // 初期方向を設定
    monster.currentDirection = 'front';
    
    // ダンジョンに追加
    this.dungeonManager.addEntity(monster as any, position);
    
    console.log(`[TurnSystem] 自然スポーン完了: ${monster.name} at (${position.x}, ${position.y})`);
  }

  /**
   * モンスターテンプレートを取得
   */
  private getMonsterTemplate(): any {
    // 設定からモンスターテンプレートを取得
    // 現在はハードコード、後で設定ローダーから取得するように改善
    return {
      id: 'simple-enemy',
      name: 'Simple Enemy',
      monsterType: 'basic',
      spriteId: 'enemy-1-0',
      stats: { hp: 20, maxHp: 20, attack: 5, defense: 2, evasionRate: 0.05 },
      movementPattern: 'approach'
    };
  }

  /**
   * 死亡エンティティのチェックと削除
   */
  private processDeathCheck(): void {
    // 現在のターン順序から死亡したエンティティを削除
    const entitiesToRemove: GameEntity[] = [];
    
    console.log(`[TurnSystem] 死亡チェック開始: ターン順序内のエンティティ数: ${this.turnManager.turnOrder.length}`);
    
    for (const entity of this.turnManager.turnOrder) {
      const hp = entity.stats?.hp;
      const maxHp = entity.stats?.maxHp;
      const isDead = this.isEntityDead(entity);
      
      console.log(`[TurnSystem] エンティティ${entity.id}: HP=${hp}/${maxHp}, 死亡判定=${isDead}`);
      
      if (isDead) {
        entitiesToRemove.push(entity);
        console.log(`[TurnSystem] 死亡エンティティを検出: ${entity.id}`);
      }
    }
    
    console.log(`[TurnSystem] 削除対象エンティティ数: ${entitiesToRemove.length}`);
    
    // 死亡したエンティティをターンシステムから削除
    for (const deadEntity of entitiesToRemove) {
      this.removeEntity(deadEntity);
      console.log(`[TurnSystem] 死亡エンティティをターンシステムから削除: ${deadEntity.id}`);
    }
  }

  /**
   * エンティティが死亡しているかチェック
   */
  private isEntityDead(entity: GameEntity): boolean {
    // プレイヤーとモンスターのHPチェック
    if (entity.stats && entity.stats.hp !== undefined) {
      return entity.stats.hp <= 0;
    }
    
    // アイテムの場合はHPが1以下で削除対象
    if (entity.stats && entity.stats.hp !== undefined && entity.stats.hp <= 1) {
      return true;
    }
    
    return false;
  }
}
