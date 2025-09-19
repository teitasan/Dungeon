/**
 * Combat system implementation
 * Handles damage calculation, critical hits, and combat resolution
 */

import { GameEntity } from '../types/entities';
import { CharacterStats } from '../types/character-info';
import { DungeonManager } from '../dungeon/DungeonManager.js';
import { ItemEntity } from '../entities/Item.js';
import { CharacterCalculator } from '../core/character-calculator.js';
import { addExperience } from '../entities/GameEntity.js';
import {
  CombatResult,
  CombatEffect,
  AttackParams,
  DamageCalculation,
  CombatConfig,
  CombatAction,
  CombatLogEntry,
  CombatState,
  CombatActionType
} from '../types/combat';
import { AttributeSystem } from './AttributeSystem';
import { ActionResult } from '../types/movement';
import { DamageDisplayManager } from '../web/DamageDisplayManager';

export class CombatSystem {
  private config: CombatConfig;
  private combatState: CombatState;
  private attributeSystem: AttributeSystem;
  private dungeonManager?: DungeonManager;
  private messageSink?: (message: string) => void;
  private damageDisplayManager?: DamageDisplayManager;

  constructor(config?: Partial<CombatConfig>) {
    this.config = {
      attackMultiplier: 1.3,
      defenseBase: 35/36, // ≈ 0.9722
      randomRangeMin: 7/8, // 0.875
      randomRangeMax: 9/8, // 1.125
      minimumDamage: 1,
      // criticalMultiplier removed - now using random 1.5-2.5x
      baseEvasionRate: 0.05,
      evasionEnabled: true,
      statusEffectChances: {},
      ...config
    };

    this.combatState = {
      inCombat: false,
      participants: [],
      combatLog: [],
      turnCount: 0
    };

    this.attributeSystem = new AttributeSystem();
  }

  /**
   * Get entity HP
   */
  private getEntityHp(entity: GameEntity): number {
    // Check if entity has character system
    if ('characterInfo' in entity && 'characterStats' in entity) {
      const characterEntity = entity as any;
      return characterEntity.characterStats.hp.current;
    }
    return 0;
  }

  /**
   * Set entity HP
   */
  private setEntityHp(entity: GameEntity, hp: number): void {
    // Check if entity has character system
    if ('characterInfo' in entity && 'characterStats' in entity) {
      const characterEntity = entity as any;
      characterEntity.characterStats.hp.current = Math.max(0, hp);
    }
  }

  /**
   * Get entity evasion rate
   */
  private getEntityEvasionRate(entity: GameEntity): number {
    // Check if entity has character system
    if ('characterInfo' in entity && 'characterStats' in entity) {
      const characterEntity = entity as any;
      return characterEntity.characterStats.combat.evasionRate;
    }
    return 0;
  }

  /**
   * DungeonManager を設定（撃破時の取り除きなど副作用用）
   */
  setDungeonManager(dm: DungeonManager): void {
    this.dungeonManager = dm;
  }

  /**
   * メッセージ出力先を設定（UI ログ等）
   */
  setMessageSink(sink: (message: string) => void): void {
    this.messageSink = sink;
  }

  /**
   * ダメージ表示マネージャーを設定
   */
  setDamageDisplayManager(manager: DamageDisplayManager): void {
    this.damageDisplayManager = manager;
  }

  /**
   * 攻撃を試行し、ActionResultを返す（ターン消費判定用）
   */
  attemptAttackWithActionResult(params: AttackParams): ActionResult {
    // 攻撃範囲チェック
    if (!this.isInAttackRange(params.attacker, params.defender)) {
      return {
        success: false,
        actionType: 'attack',
        consumedTurn: false,  // 攻撃範囲外はターン消費しない
        message: '攻撃範囲外だ'
      };
    }

    // 攻撃実行
    const combatResult = this.executeAttack(params);

    if (combatResult.success) {
      return {
        success: true,
        actionType: 'attack',
        consumedTurn: true,  // 攻撃成功時はターン消費
        message: combatResult.message,
        data: combatResult
      };
    } else {
      return {
        success: false,
        actionType: 'attack',
        consumedTurn: false,  // 攻撃失敗時はターン消費しない
        message: combatResult.message,
        data: combatResult
      };
    }
  }

  /**
   * Execute an attack between two entities
   */
  executeAttack(params: AttackParams): CombatResult {
    const { attacker, defender, attackType, weaponBonus = 0, attributeModifier = 1.0, criticalOverride, unavoidable } = params;


    // Check if attack hits (evasion check)
    if (!unavoidable && this.config.evasionEnabled && this.checkEvasion(attacker, defender)) {
      // 回避時のダメージ表示（MISS）
      if (this.damageDisplayManager) {
        this.damageDisplayManager.addMiss(defender.id, defender.position.x, defender.position.y);
      }

      return {
        success: true,
        damage: 0,
        actualDamage: 0,
        critical: false,
        evaded: true,
        blocked: false,
        attacker,
        defender,
        effects: [],
        message: `${defender.id} evaded ${attacker.id}'s attack!`
      };
    }

    // Check for critical hit
    const isCritical = criticalOverride === true ? true :
                      (criticalOverride === false ? false : this.checkCriticalHit(attacker, defender));

    // Calculate attribute modifier if not provided
    const finalAttributeModifier = attributeModifier !== undefined ?
      attributeModifier : this.attributeSystem.calculateEntityAttributeModifier(attacker, defender);

    // Calculate damage
    const damageCalc = this.calculateDamage(attacker, defender, weaponBonus, finalAttributeModifier, isCritical);

    // ダメージ表示を追加（HPクリップ前の実際のダメージを表示）
    if (this.damageDisplayManager && damageCalc.finalDamage > 0) {
      this.damageDisplayManager.addDamage(defender.id, damageCalc.finalDamage, isCritical, false, defender.position.x, defender.position.y);
    }

    // Apply damage to defender
    const actualDamage = this.applyDamage(defender, damageCalc.finalDamage);

    // 死亡チェック
    const defenderHp = this.getEntityHp(defender);
    const isDead = defenderHp <= 0;

    if (isDead) {
      this.handleEntityDeath(defender);
    }

    // Generate combat effects
    const effects = this.generateCombatEffects(attacker, defender, actualDamage, isCritical);

    // Create result
    const result: CombatResult = {
      success: true,
      damage: damageCalc.finalDamage,
      actualDamage,
      critical: isCritical,
      evaded: false,
      blocked: false,
      attacker,
      defender,
      effects,
      message: `${attacker.id}が${defender.id}に${actualDamage}ダメージを与えた！`
    };

    // Log the combat action
    this.logCombatAction({
      type: 'attack',
      attacker,
      target: defender
    }, result);

    // メッセージシンクがあれば通知
    if (this.messageSink) {
      console.log(`[DEBUG] executeAttack: メッセージ表示: "${result.message}"`);
      this.messageSink(result.message);

      // 死亡時は追加で死亡メッセージを表示
      if (isDead) {
        if (this.isEnemy(defender)) {
          console.log(`[DEBUG] executeAttack: 敵死亡メッセージ表示: "${defender.id}を倒した！"`);
          this.messageSink(`${defender.id}を倒した！`);
        } else {
          console.log(`[DEBUG] executeAttack: プレイヤー死亡メッセージ表示: "${defender.id}は力尽きた..."`);
          this.messageSink(`${defender.id}は力尽きた...`);
        }
      }
    }

    return result;
  }

  /**
   * 攻撃範囲内かチェック（角を挟んだ斜め攻撃は禁止）
   */
  private isInAttackRange(attacker: GameEntity, defender: GameEntity): boolean {
    // 隣接攻撃（上下左右 + 斜め）に対応
    const attackerPos = attacker.position;
    const defenderPos = defender.position;

    const dx = Math.abs(attackerPos.x - defenderPos.x);
    const dy = Math.abs(attackerPos.y - defenderPos.y);

    // 隣接判定: 上下左右(距離1) + 斜め(距離√2 ≈ 1.414)
    const isAdjacent = dx <= 1 && dy <= 1 && (dx + dy > 0); // 同じ位置は除外

    if (!isAdjacent) {
      return false;
    }

    // 斜め隣接の場合、角を挟んでいないかチェック
    if (dx === 1 && dy === 1) {
      // 斜め隣接の場合、角の位置が歩行可能かチェック
      // 攻撃者と防御者の間の角をチェック
      const cornerPos1 = { x: attackerPos.x, y: defenderPos.y };
      const cornerPos2 = { x: defenderPos.x, y: attackerPos.y };

      // ダンジョンマネージャーが利用可能な場合のみチェック
      if (this.dungeonManager && typeof this.dungeonManager.isWalkable === 'function') {
        const isCorner1Walkable = this.dungeonManager.isWalkable(cornerPos1);
        const isCorner2Walkable = this.dungeonManager.isWalkable(cornerPos2);

        // 両方の角が歩行可能でなければ攻撃禁止
        if (!isCorner1Walkable || !isCorner2Walkable) {
          return false; // 角が歩行不可のため攻撃禁止
        }
      }
    }

    return true;
  }

  /**
   * Calculate damage using the mystery dungeon formula
   * Formula: {攻撃力×1.3×(35/36)^防御力}×(7/8~9/8)
   * New system: Uses CharacterStats with unarmed attack power and equipment bonuses
   */
  private calculateDamage(
    attacker: GameEntity,
    defender: GameEntity,
    weaponBonus: number,
    attributeModifier: number,
    isCritical: boolean
  ): DamageCalculation {
    // Get unarmed attack power from basic stats
    let unarmedAttack = 0;
    if ('characterInfo' in attacker) {
      const stats = (attacker as any).characterInfo.stats;
      unarmedAttack = CharacterCalculator.unarmedAttackPower(stats.STR, stats.DEX);
    }

    // Get equipment damage bonus
    let equipmentBonus = 0;
    if ('characterStats' in attacker) {
      equipmentBonus = (attacker as any).characterStats.combat.damageBonus.melee || 0;
    }

    // Get defender's physical resistance
    let physicalResistance = 0;
    if ('characterStats' in defender) {
      physicalResistance = (defender as any).characterStats.combat.resistance.physical || 0;
    }

    const baseAttack = unarmedAttack + equipmentBonus + weaponBonus;
    const defense = physicalResistance; // Critical hits no longer ignore defense

    // Apply the mystery dungeon damage formula
    const attackMultiplied = baseAttack * this.config.attackMultiplier;
    const defenseReduction = Math.pow(this.config.defenseBase, defense);
    const baseDamage = attackMultiplied * defenseReduction;

    // Apply random variation (7/8 to 9/8)
    const randomMultiplier = Math.random() * (this.config.randomRangeMax - this.config.randomRangeMin) + this.config.randomRangeMin;
    const randomizedDamage = baseDamage * randomMultiplier;

    // Apply attribute modifier
    const attributeDamage = randomizedDamage * attributeModifier;

    // Apply critical multiplier if critical (1.5 to 2.5x random)
    const criticalDamage = isCritical ? 
      attributeDamage * (1.5 + Math.random() * 1.0) : // 1.5 to 2.5x random
      attributeDamage;

    // Ensure minimum damage
    const finalDamage = Math.max(Math.round(criticalDamage), this.config.minimumDamage);

    return {
      baseAttack,
      defense,
      attackMultiplier: this.config.attackMultiplier,
      defenseReduction,
      randomMultiplier,
      attributeMultiplier: attributeModifier,
      weaponBonus,
      finalDamage,
      minimumDamage: this.config.minimumDamage
    };
  }

  /**
   * Check if attack results in critical hit
   */
  private checkCriticalHit(attacker: GameEntity, defender: GameEntity): boolean {
    // Get critical chance from attacker's stats only
    let criticalChance = 0;
    if ('characterStats' in attacker) {
      criticalChance = (attacker as any).characterStats.combat.criticalRate || 0;
    }

    // Subtract defender's critical resistance if available
    if ('characterStats' in defender) {
      // Critical resistance not implemented in new system yet
    }

    // Ensure chance is within valid range
    criticalChance = Math.max(0, Math.min(1, criticalChance));

    return Math.random() < criticalChance;
  }

  /**
   * Check if attack hits (new hit rate system)
   * Formula: 80% + (attacker's hitRate/10 - defender's evasionRate/10)
   * Clamped between 5% and 95%
   */
  private checkEvasion(attacker: GameEntity, defender: GameEntity): boolean {
    // Get attacker's hit rate
    let attackerHitRate = 0;
    if ('characterStats' in attacker) {
      attackerHitRate = (attacker as any).characterStats.combat.hitRate.melee || 0;
    }

    // Get defender's evasion rate
    let defenderEvasionRate = 0;
    if ('characterStats' in defender) {
      defenderEvasionRate = (defender as any).characterStats.combat.evasionRate || 0;
    }

    // Calculate hit rate: 80% + (hitRate/10 - evasionRate/10)
    const baseHitRate = 0.8; // 80%
    const hitRateDiff = (attackerHitRate - defenderEvasionRate) / 10;
    let finalHitRate = baseHitRate + hitRateDiff;

    // Clamp between 5% and 95%
    finalHitRate = Math.max(0.05, Math.min(0.95, finalHitRate));

    // Return true if attack misses (evaded)
    return Math.random() >= finalHitRate;
  }

  /**
   * Apply damage to an entity
   */
  private applyDamage(entity: GameEntity, damage: number): number {
    const currentHp = this.getEntityHp(entity);
    const actualDamage = Math.min(damage, currentHp);

    this.setEntityHp(entity, currentHp - damage);

    return actualDamage;
  }

  /**
   * Generate combat effects from an attack
   */
  private generateCombatEffects(
    attacker: GameEntity,
    defender: GameEntity,
    damage: number,
    isCritical: boolean
  ): CombatEffect[] {
    const effects: CombatEffect[] = [];

    // Damage effect
    effects.push({
      type: 'damage',
      target: defender,
      value: damage
    });

    // Check for death
    const defenderHp = this.getEntityHp(defender);
    if (defenderHp <= 0) {
      effects.push({
        type: 'death',
        target: defender
      });
    }

    // TODO: Add status effect chances, weapon special effects, etc.

    return effects;
  }

  /**
   * Generate combat message
   */
  private generateCombatMessage(
    attacker: GameEntity,
    defender: GameEntity,
    damage: number,
    isCritical: boolean,
    isDead: boolean = false
  ): string {
    const attackerName = (attacker as any).name || attacker.id;
    const defenderName = (defender as any).name || defender.id;

    let message = `${attackerName} attacks ${defenderName}`;

    if (isCritical) {
      message += ' with a critical hit';
    }

    message += ` for ${damage} damage!`;

    if (isDead) {
      message += ` ${defenderName} is defeated!`;
    }

    return message;
  }

  /**
   * Check if entity can attack target
   */
  canAttack(attacker: GameEntity, target: GameEntity): boolean {
    // Basic checks
    if (attacker === target) return false;
    // Items are not valid targets
    if (target instanceof ItemEntity) return false;

    const attackerHp = this.getEntityHp(attacker);
    const targetHp = this.getEntityHp(target);

    if (attackerHp <= 0) return false;
    if (targetHp <= 0) return false;
    // 近接レンジ・角抜け禁止のチェック（DungeonManagerがある場合）
    if (this.dungeonManager) {
      if (!this.isInAttackRange(attacker, target)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Process combat action between entities
   */
  private processCombatAction(attacker: GameEntity, target: GameEntity, actionType: string): CombatResult | null {
    // ダメージ計算
    const damage = this.calculateDamage(attacker, target, 0, 1.0, false);

    // ターゲットのHPを減少
    const currentHp = this.getEntityHp(target);
    this.setEntityHp(target, currentHp - damage.finalDamage);

    // 死亡チェック（メッセージ生成前に）
    const targetHp = this.getEntityHp(target);
    const isDead = targetHp <= 0;

    if (isDead) {
      this.handleEntityDeath(target);
    }

    // ダメージ表示を追加
    if (this.damageDisplayManager && damage.finalDamage > 0) {
      this.damageDisplayManager.addDamage(target.id, damage.finalDamage, false, false, target.position.x, target.position.y);
    }

    // 戦闘結果を作成
    const result: CombatResult = {
      success: true,
      damage: damage.finalDamage,
      actualDamage: damage.finalDamage,
      critical: false,
      evaded: false,
      blocked: false,
      attacker,
      defender: target,
      effects: [],
      message: `${attacker.id}が${target.id}に${damage.finalDamage}ダメージを与えた！`
    };

    // 戦闘ログに記録
    this.logCombatAction({ type: 'attack' as CombatActionType, attacker, target }, result);

    return result;
  }

  /**
   * Process attack between entities
   */
  processAttack(attacker: GameEntity, target: GameEntity): CombatResult | null {
    if (!this.canAttack(attacker, target)) {
      return null;
    }

    // 攻撃処理を実行
    const result = this.processCombatAction(attacker, target, 'attack');

    // メッセージシンクがあれば通知
    if (this.messageSink && result) {
      console.log(`[DEBUG] processAttack: メッセージ表示: "${result.message}"`);
      this.messageSink(result.message);

      // 追加: 死亡時メッセージも送出（敵AI経路でも表示されるように）
      const defender = result.defender;
      const defenderHp = this.getEntityHp(defender);
      const isDead = defenderHp <= 0;
      if (isDead) {
        if (this.isEnemy(defender)) {
          console.log(`[DEBUG] processAttack: 敵死亡メッセージ表示: "${defender.id}を倒した！"`);
          this.messageSink(`${defender.id}を倒した！`);
        } else {
          console.log(`[DEBUG] processAttack: プレイヤー死亡メッセージ表示: "${defender.id}は力尽きた..."`);
          this.messageSink(`${defender.id}は力尽きた...`);
        }
      }
    }

    return result;
  }

  /**
   * Get combat preview (damage estimation)
   */
  getCombatPreview(attacker: GameEntity, defender: GameEntity, weaponBonus: number = 0): {
    minDamage: number;
    maxDamage: number;
    averageDamage: number;
    criticalDamage: number;
    hitChance: number;
    criticalChance: number;
  } {
    // Calculate damage range without random factor
    const baseDamageCalc = this.calculateDamage(attacker, defender, weaponBonus, 1.0, false);
    const criticalDamageCalc = this.calculateDamage(attacker, defender, weaponBonus, 1.0, true);

    // Calculate damage range with random factor
    const baseWithoutRandom = baseDamageCalc.finalDamage / baseDamageCalc.randomMultiplier;
    const minDamage = Math.max(Math.floor(baseWithoutRandom * this.config.randomRangeMin), this.config.minimumDamage);
    const maxDamage = Math.max(Math.floor(baseWithoutRandom * this.config.randomRangeMax), this.config.minimumDamage);
    const averageDamage = Math.floor((minDamage + maxDamage) / 2);

    // Calculate hit chance (1 - evasion chance)
    const evasionChance = this.config.evasionEnabled ?
      Math.min(1, Math.max(0, this.config.baseEvasionRate + this.getEntityEvasionRate(defender))) : 0;
    const hitChance = 1 - evasionChance;

    // Calculate critical chance from attacker's stats
    let criticalChance = 0;
    if ('characterStats' in attacker) {
      criticalChance = (attacker as any).characterStats.combat.criticalRate || 0;
    }
    criticalChance = Math.min(1, Math.max(0, criticalChance));

    return {
      minDamage,
      maxDamage,
      averageDamage,
      criticalDamage: criticalDamageCalc.finalDamage,
      hitChance,
      criticalChance
    };
  }

  /**
   * Log combat action
   */
  private logCombatAction(action: CombatAction, result: CombatResult): void {
    const logEntry: CombatLogEntry = {
      turn: this.combatState.turnCount,
      timestamp: Date.now(),
      action,
      result,
      message: result.message
    };

    this.combatState.combatLog.push(logEntry);
  }

  /**
   * Get combat log
   */
  getCombatLog(): CombatLogEntry[] {
    return [...this.combatState.combatLog];
  }

  /**
   * Clear combat log
   */
  clearCombatLog(): void {
    this.combatState.combatLog = [];
  }

  /**
   * Start combat
   */
  startCombat(participants: GameEntity[]): void {
    this.combatState.inCombat = true;
    this.combatState.participants = [...participants];
    this.combatState.turnCount = 0;
    this.combatState.combatLog = [];
  }

  /**
   * End combat
   */
  endCombat(): void {
    this.combatState.inCombat = false;
    this.combatState.participants = [];
    this.combatState.currentAttacker = undefined;
  }

  /**
   * Check if in combat
   */
  isInCombat(): boolean {
    return this.combatState.inCombat;
  }

  /**
   * Get combat participants
   */
  getCombatParticipants(): GameEntity[] {
    return [...this.combatState.participants];
  }


  /**
   * Get current combat configuration
   */
  getConfig(): CombatConfig {
    return { ...this.config };
  }

  /**
   * Update combat configuration
   */
  updateConfig(newConfig: Partial<CombatConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get attribute system
   */
  getAttributeSystem(): AttributeSystem {
    return this.attributeSystem;
  }

  /**
   * Handle entity death (enemy defeat, item drops, etc.)
   */
  private handleEntityDeath(entity: GameEntity): void {
    // 敵の死亡処理
    if (this.isEnemy(entity)) {
      this.handleEnemyDeath(entity);
    }

    // プレイヤーの死亡処理
    if (this.isPlayer(entity)) {
      this.handlePlayerDeath(entity);
    }
  }

    /**
   * Handle enemy death
   */
  private handleEnemyDeath(enemy: GameEntity): void {
    console.log(`[CombatSystem] 敵${enemy.id}が倒された`);
    console.log(`[CombatSystem] 敵${enemy.id}の現在位置: (${enemy.position.x}, ${enemy.position.y})`);

    // 経験値付与処理
    this.giveExperienceToPlayer(enemy);

    // ドロップアイテムの生成（実装予定）
    // TODO: DropSystemと連携してドロップアイテムを生成

    // エンティティをダンジョンから削除
    if (this.dungeonManager) {
      console.log(`[CombatSystem] 敵${enemy.id}をダンジョンから削除開始`);
      const removed = this.dungeonManager.removeEntity(enemy);
      console.log(`[CombatSystem] 敵${enemy.id}の削除結果: ${removed ? '成功' : '失敗'}`);

      if (removed) {
        console.log(`[CombatSystem] 敵${enemy.id}をダンジョンから削除完了`);
      } else {
        console.log(`[CombatSystem] 警告: 敵${enemy.id}の削除に失敗しました`);
      }
    } else {
      console.log(`[CombatSystem] 警告: dungeonManagerが設定されていません`);
    }

    // メッセージはexecuteAttackで統一的に管理される
  }

  /**
   * Handle player death
   */
  private handlePlayerDeath(player: GameEntity): void {
    console.log(`[CombatSystem] プレイヤー${player.id}が倒された`);

    // メッセージはexecuteAttackで統一的に管理される

    // TODO: DeathSystemと連携してゲームオーバー処理
  }

  /**
   * Check if entity is an enemy
   */
  private isEnemy(entity: GameEntity): boolean {
    // MonsterEntityの判定（暫定的な実装）
    return entity.id.includes('enemy') || entity.id.includes('monster');
  }

  /**
   * Check if entity is a player
   */
  private isPlayer(entity: GameEntity): boolean {
    // PlayerEntityの判定（暫定的な実装）
    return entity.id.includes('player') || entity.id === 'player-1';
  }

  /**
   * Give experience to player when enemy is defeated
   */
  private giveExperienceToPlayer(enemy: GameEntity): void {
    // 敵の経験値を取得
    const experienceValue = enemy.flags?.experienceValue as number;
    if (!experienceValue || experienceValue <= 0) {
      console.log(`[CombatSystem] 敵${enemy.id}の経験値が設定されていません`);
      return;
    }

    // プレイヤーを取得
    const player = this.findPlayer();
    if (!player) {
      console.log(`[CombatSystem] プレイヤーが見つかりません`);
      return;
    }

    // プレイヤーの現在の経験値とレベルアップ設定を取得
    if (!('characterStats' in player)) {
      console.log(`[CombatSystem] プレイヤー${player.id}にcharacterStatsがありません`);
      return;
    }

    const playerStats = (player as any).characterStats as CharacterStats;
    
    // 設定ファイルから経験値テーブルと成長率を取得
    const experienceTable = [100, 220, 360, 520, 700, 900, 1120, 1360, 1620, 1900];
    const growthRates = { hp: 1.1, attack: 1.2, defense: 1.2 };

    console.log(`[CombatSystem] プレイヤー現在の経験値: ${playerStats.experience.current}/${playerStats.experience.required}`);

    // 経験値を追加
    const result = addExperience(playerStats, experienceValue, experienceTable, growthRates);
    
    // プレイヤーのステータスを更新
    (player as any).characterStats = result.newStats;

    console.log(`[CombatSystem] プレイヤー更新後の経験値: ${result.newStats.experience.current}/${result.newStats.experience.required}`);

    // メッセージ表示
    if (this.messageSink) {
      this.messageSink(`${experienceValue}の経験値を獲得！`);
      
      if (result.leveledUp) {
        this.messageSink(`レベルアップ！レベル${result.newStats.level}になった！`);
      }
    }

    console.log(`[CombatSystem] プレイヤーに${experienceValue}の経験値を付与。レベルアップ: ${result.leveledUp}`);
  }

  /**
   * Find player entity in the dungeon
   */
  private findPlayer(): GameEntity | null {
    if (!this.dungeonManager) {
      return null;
    }

    // ダンジョン内の全エンティティからプレイヤーを検索
    const entities = this.dungeonManager.getAllEntities();
    return entities.find(entity => this.isPlayer(entity)) || null;
  }
}
