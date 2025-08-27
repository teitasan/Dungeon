/**
 * Turn management system - 完全同期処理によるターン管理
 */

import { GameEntity } from '../types/entities';
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

  constructor(
    config: TurnSystemConfig,
    dungeonManager?: any,
    combatSystem?: any,
    hungerSystem?: any,
    statusSystem?: any
  ) {
    this.config = config;
    this.dungeonManager = dungeonManager;
    this.combatSystem = combatSystem;
    this.hungerSystem = hungerSystem;
    this.statusSystem = statusSystem;

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
      speedState.action1State.canAct = speedConfig.action1.enabled;
      speedState.action2State.canAct = speedConfig.action2.enabled;
      
      // 鈍足エンティティの場合、最初のターンは行動できない可能性がある
      if (speedState.speedState === 'slow') {
        speedState.turnsUntilNextAction = speedConfig.action1.skipTurns || 1;
        speedState.action1State.canAct = false;
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
    console.log(`=== ターン ${this.turnManager.currentTurn} 開始 ===`);
    
    // フェーズ状態をリセット
    this.resetPhaseStates();
    
    // 各フェーズを順番に実行（完全同期）
    for (let phaseIndex = 0; phaseIndex < this.config.phases.length; phaseIndex++) {
      const phaseConfig = this.config.phases[phaseIndex];
      this.turnManager.currentPhaseIndex = phaseIndex;
      this.turnManager.turnPhase = phaseConfig.phase;
      
      console.log(`--- フェーズ: ${phaseConfig.phase} ---`);
      
      // フェーズを実行
      this.executePhase(phaseConfig);
    }
    
    // ターン終了処理
    this.executeEndTurnProcessing();
    
    // 次のターンの準備
    this.prepareNextTurn();
    
    console.log(`=== ターン ${this.turnManager.currentTurn - 1} 終了 ===\n`);
  }

  /**
   * 特定のフェーズを実行
   */
  private executePhase(phaseConfig: TurnPhaseConfig): void {
    const relevantEntities = this.getEntitiesForPhase(phaseConfig.phase);
    
    for (const entity of relevantEntities) {
      // フェーズの実行条件をチェック
      if (!this.checkPhaseConditions(entity, phaseConfig)) {
        console.log(`  ${entity.id}: 条件により ${phaseConfig.phase} をスキップ`);
        continue;
      }
      
      // 速度システムによる行動制限をチェック
      // エンティティがこのフェーズで行動可能かチェック
      if (!this.checkPhaseConditions(entity, phaseConfig)) {
        console.log(`  ${entity.id}: 速度制限により ${phaseConfig.phase} をスキップ`);
        continue;
      }
      
      // フェーズ固有の処理を実行
      this.executeEntityPhaseAction(entity, phaseConfig.phase);
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
      case 'mid-turn-recovery':
        this.executeMidTurnRecovery(entity);
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
    console.log(`  ターン開始処理: ${entity.id}`);
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
      console.log(`  ${entity.id}: プレイヤー${actionNumber}回目行動 - 行動不可`);
      return;
    }
    
    // 隣接ルールチェック（2回目行動のみ）
    if (actionNumber === 2 && this.shouldSkipAction2DueToAdjacency(entity)) {
      console.log(`  ${entity.id}: プレイヤー2回目行動 - 隣接によりスキップ`);
      return;
    }
    
    console.log(`  ${entity.id}: プレイヤー${actionNumber}回目行動実行`);
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
      console.log(`  ${entity.id}: 敵${actionNumber}回目行動 - 行動不可`);
      return;
    }
    
    // 隣接ルールチェック（2回目行動のみ）
    if (actionNumber === 2 && this.shouldSkipAction2DueToAdjacency(entity)) {
      console.log(`  ${entity.id}: 敵2回目行動 - 隣接によりスキップ`);
      return;
    }
    
    console.log(`  ${entity.id}: 敵${actionNumber}回目行動処理`);
    
    // AI による行動処理
    if (this.dungeonManager && this.dungeonManager.aiSystem) {
      // 移動可能かチェック
      if (this.canEntityActInAction(entity, actionNumber, 'move')) {
        const moveResult = this.dungeonManager.aiSystem.processEntityMovement(entity);
        if (moveResult?.moved) {
          actionState.hasMoved = true;
          // 1回目行動後の隣接チェック
          if (actionNumber === 1) {
            speedState.action2State.wasAdjacentAfterAction1 = this.isAdjacentToPlayerOrAlly(entity);
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
   * 味方行動フェーズ
   */
  private executeAllyAction(entity: GameEntity, actionNumber: 1 | 2): void {
    if (!this.isAlly(entity)) return;
    
    const speedState = this.turnManager.entitySpeedStates.get(entity.id);
    if (!speedState) return;
    
    const actionState = actionNumber === 1 ? speedState.action1State : speedState.action2State;
    
    // 行動可能かチェック
    if (!actionState.canAct) {
      console.log(`  ${entity.id}: 味方${actionNumber}回目行動 - 行動不可`);
      return;
    }
    
    // 隣接ルールチェック（2回目行動のみ）
    if (actionNumber === 2 && this.shouldSkipAction2DueToAdjacency(entity)) {
      console.log(`  ${entity.id}: 味方2回目行動 - 隣接によりスキップ`);
      return;
    }
    
    console.log(`  ${entity.id}: 味方${actionNumber}回目行動処理`);
    
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
   * 中間回復処理（倍速者のみ）
   */
  private executeMidTurnRecovery(entity: GameEntity): void {
    const speedState = this.turnManager.entitySpeedStates.get(entity.id);
    if (!speedState || speedState.speedState !== 'fast') return;
    
    console.log(`  ${entity.id}: 中間回復処理（倍速者）`);
    // HP自然回復などの処理（設定に基づく）
    // 実装は後で追加
  }

  /**
   * ターン終了時回復処理
   */
  private executeEndTurnRecovery(entity: GameEntity): void {
    console.log(`  ${entity.id}: ターン終了時回復処理`);
    // HP自然回復などの処理（設定に基づく）
    // 実装は後で追加
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
      'mid-turn-recovery',
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
    
    // 設定に基づいて順序通りに処理
    const sortedProcesses = [...this.config.endTurnProcessing].sort((a, b) => a.order - b.order);
    
    for (const process of sortedProcesses) {
      console.log(`  ${process.process}: ${process.description}`);
      
      switch (process.process) {
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
      case 'mid-turn-recovery':
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
   * エンティティを削除
   */
  removeEntity(entity: GameEntity): void {
    const index = this.turnManager.turnOrder.indexOf(entity);
    if (index !== -1) {
      this.turnManager.turnOrder.splice(index, 1);
      this.turnManager.entitySpeedStates.delete(entity.id);
      this.turnManager.phaseEntityStates.delete(entity.id);
      
      // Adjust current index if necessary
      if (this.turnManager.currentEntityIndex >= index) {
        this.turnManager.currentEntityIndex = Math.max(0, this.turnManager.currentEntityIndex - 1);
      }
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
}