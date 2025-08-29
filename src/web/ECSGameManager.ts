/**
 * ECS Game Manager - 完全ECS統合のためのゲーム管理
 * 非ECSシステムとの段階的移行をサポート
 */

import { World } from '../ecs/core/World.js';
import { ECSItemSystem } from '../ecs/systems/common/ItemSystem.js';
import { MovementSystem } from '../ecs/systems/movement/MovementSystem.js';
import { ECSCombatSystem } from '../ecs/systems/combat/CombatSystem.js';
import { ECSHungerSystem } from '../ecs/systems/status/HungerSystem.js';
import { InventoryComponentFactory } from '../ecs/components/common/Inventory.js';
import { HealthComponentFactory } from '../ecs/components/common/Health.js';
import { HungerComponentFactory } from '../ecs/components/status/Hunger.js';
import { PositionComponentFactory } from '../ecs/components/common/Position.js';
import { ItemComponentFactory } from '../ecs/components/common/Item.js';
import type { DungeonManager } from '../dungeon/DungeonManager.js';
import type { PlayerEntity } from '../entities/Player.js';
import type { MonsterEntity } from '../entities/Monster.js';
import type { ItemEntity } from '../entities/Item.js';

export interface ECSGameManagerConfig {
  targetFPS: number;
  enableProfiling: boolean;
  enableDebugging: boolean;
  maxEntities: number;
}

export interface ECSGameState {
  ecsWorld: World;
  dungeonManager: DungeonManager;
  player: PlayerEntity;
  ecsPlayerId: string;
  ecsMonsterIds: string[];
  ecsItemIds: string[];
}

export class ECSGameManager {
  private world: World;
  private config: ECSGameManagerConfig;
  private gameState: ECSGameState | null = null;
  private systems: Map<string, any> = new Map();

  constructor(config: ECSGameManagerConfig) {
    this.config = config;
    
    // ECS Worldの初期化
    this.world = new World({
      maxEntities: config.maxEntities,
      enableProfiling: config.enableProfiling,
      enableDebugging: config.enableDebugging
    });

    // ECSシステムの初期化と登録
    this.initializeECSSystems();
  }

  /**
   * ECSシステムの初期化と登録
   */
  private initializeECSSystems(): void {
    // 各ECSシステムをWorldに登録
    const itemSystem = new ECSItemSystem(this.world.getComponentManager());
    const movementSystem = new MovementSystem(this.world.getComponentManager());
    
    // ECSCombatSystemとECSHungerSystemは設定が必要
    const combatSystem = new ECSCombatSystem(this.world.getComponentManager(), {
      attackMultiplier: 1.3,
      defenseBase: 35/36,
      randomRangeMin: 7/8,
      randomRangeMax: 9/8,
      minimumDamage: 1,
      baseCriticalChance: 0.05,
      criticalMultiplier: 2.0,
      baseEvasionRate: 0.05,
      evasionEnabled: true
    });
    
    const hungerSystem = new ECSHungerSystem(this.world.getComponentManager(), {
      maxValue: 100,
      decreaseRate: 1,
      minValue: 0,
      damageAmount: 5,
      recoveryAmount: 1,
      maxOverfeedTime: 10
    });

    // システムを登録
    this.world.addSystem(itemSystem);
    this.world.addSystem(movementSystem);
    this.world.addSystem(combatSystem);
    this.world.addSystem(hungerSystem);

    // システムマップに保存
    this.systems.set('item', itemSystem);
    this.systems.set('movement', movementSystem);
    this.systems.set('combat', combatSystem);
    this.systems.set('hunger', hungerSystem);

    console.log('[ECS GameManager] Systems initialized:', {
      item: itemSystem.constructor.name,
      movement: movementSystem.constructor.name,
      combat: combatSystem.constructor.name,
      hunger: hungerSystem.constructor.name
    });
  }

  /**
   * ゲーム状態を設定
   */
  setGameState(gameState: ECSGameState): void {
    this.gameState = gameState;
    
    // MovementSystemにDungeonManagerを設定
    const movementSystem = this.getSystem('movement');
    if (movementSystem && gameState.dungeonManager) {
      (movementSystem as any).setDungeonManager?.(gameState.dungeonManager);
    }

    // CombatSystemにDungeonManagerとMessageSinkを設定
    const combatSystem = this.getSystem('combat');
    if (combatSystem && gameState.dungeonManager) {
      (combatSystem as any).setDungeonManager?.(gameState.dungeonManager);
      // MessageSinkは後で設定（UISystemが利用可能になった後）
    }
    
    console.log('[ECS GameManager] Game state set:', {
      playerId: gameState.ecsPlayerId,
      monsterCount: gameState.ecsMonsterIds.length,
      itemCount: gameState.ecsItemIds.length
    });
  }

  /**
   * ECSプレイヤーエンティティの作成
   */
  createECSPlayer(player: PlayerEntity): string {
    const playerEntity = this.world.createEntity();
    
    // プレイヤーの現在位置を取得（ダンジョン初期化後の正しい位置）
    const currentPosition = player.position || { x: 0, y: 0 };
    
    // プレイヤーコンポーネントの追加
    const position = PositionComponentFactory.create(
      currentPosition.x, 
      currentPosition.y
    );
    const health = HealthComponentFactory.create(
      player.stats.hp, 
      player.stats.maxHp
    );
    const hunger = HungerComponentFactory.create(
      player.hunger, 
      player.maxHunger, 
      1
    );
    const inventory = InventoryComponentFactory.create(20);

    this.world.addComponent(playerEntity.id, position);
    this.world.addComponent(playerEntity.id, health);
    this.world.addComponent(playerEntity.id, hunger);
    this.world.addComponent(playerEntity.id, inventory);

    console.log('[ECS GameManager] Player entity created:', playerEntity.id, 'at position:', currentPosition);
    return playerEntity.id;
  }

  /**
   * ECSモンスターエンティティの作成
   */
  createECSMonster(monster: MonsterEntity): string {
    const monsterEntity = this.world.createEntity();
    
    // モンスターコンポーネントの追加
    const position = PositionComponentFactory.create(
      monster.position?.x ?? 0, 
      monster.position?.y ?? 0
    );
    const health = HealthComponentFactory.create(
      monster.stats.hp, 
      monster.stats.maxHp
    );

    this.world.addComponent(monsterEntity.id, position);
    this.world.addComponent(monsterEntity.id, health);

    console.log('[ECS GameManager] Monster entity created:', monsterEntity.id);
    return monsterEntity.id;
  }

  /**
   * ECSアイテムエンティティの作成
   */
  createECSItem(item: ItemEntity): string {
    const itemEntity = this.world.createEntity();
    
    // アイテムコンポーネントの追加
    const position = PositionComponentFactory.create(
      item.position?.x ?? 0, 
      item.position?.y ?? 0
    );
    const itemComponent = ItemComponentFactory.create(
      item.id,
      item.name,
      item.itemType,
      item.identified,
      item.cursed,
      1
    );

    this.world.addComponent(itemEntity.id, position);
    this.world.addComponent(itemEntity.id, itemComponent);

    console.log('[ECS GameManager] Item entity created:', itemEntity.id);
    return itemEntity.id;
  }

  /**
   * ゲームループを開始
   */
  startGameLoop(): void {
    // 簡易実装：ECS Worldの更新を開始
    console.log('[ECS GameManager] Game loop started');
  }

  /**
   * ゲームループを停止
   */
  stopGameLoop(): void {
    console.log('[ECS GameManager] Game loop stopped');
  }

  /**
   * ECSシステムを更新
   */
  update(deltaTime: number = 16): void {
    if (!this.gameState) return;

    // プレイヤー位置をAIシステムに同期
    const aiSystem = this.getSystem('ai');
    if (aiSystem && this.gameState.player.position) {
      // AIシステムの型を確認してから呼び出し
      (aiSystem as any).setPlayerPosition?.(this.gameState.player.position);
    }

    // ECS Worldを更新（正しい形式）
    this.world.update(deltaTime);
  }

  /**
   * プレイヤー位置をECSに同期
   */
  updatePlayerPosition(position: { x: number; y: number }): void {
    if (!this.gameState) return;

    // AIシステムにプレイヤー位置を通知
    const aiSystem = this.getSystem('ai');
    if (aiSystem) {
      (aiSystem as any).setPlayerPosition?.(position);
    }
  }

  /**
   * 非ECSプレイヤーの状態をECSプレイヤーに同期
   */
  syncNonECSPlayerToECS(nonECSPlayer: PlayerEntity, ecsPlayerId: string): void {
    // 簡易実装：位置の同期
    if (nonECSPlayer.position) {
      const position = this.world.getComponent(ecsPlayerId, 'position');
      if (position) {
        (position as any).x = nonECSPlayer.position.x;
        (position as any).y = nonECSPlayer.position.y;
      }
    }
  }

  /**
   * 特定のシステムを取得
   */
  getSystem<T>(systemName: string): T | null {
    return this.systems.get(systemName) || null;
  }

  /**
   * ワールドを取得
   */
  getWorld(): World {
    return this.world;
  }

  /**
   * ワールドの統計情報を取得
   */
  getWorldStats(): any {
    return this.world.getStats();
  }

  /**
   * エンティティの存在確認
   */
  hasEntity(entityId: string): boolean {
    return this.world.hasEntity(entityId);
  }

  /**
   * エンティティの削除
   */
  destroyEntity(entityId: string): boolean {
    return this.world.destroyEntity(entityId);
  }

  /**
   * コンポーネントの取得
   */
  getComponent<T>(entityId: string, componentType: string): T | undefined {
    return this.world.getComponent(entityId, componentType) as T | undefined;
  }

  /**
   * コンポーネントの追加
   */
  addComponent(entityId: string, component: any): void {
    this.world.addComponent(entityId, component);
  }

  /**
   * コンポーネントの削除
   */
  removeComponent(entityId: string, componentType: string): boolean {
    return this.world.removeComponent(entityId, componentType);
  }

  /**
   * 特定のコンポーネントを持つエンティティを取得
   */
  getEntitiesWithComponent(componentType: string): string[] {
    return this.world.getComponentManager().getEntitiesWithComponent(componentType);
  }

  /**
   * 全エンティティIDを取得
   */
  getAllEntityIds(): string[] {
    return this.world.getEntityIds();
  }

  // ECSDataProvider インターフェースの実装
  getPlayerHealth(): { current: number; max: number } | null {
    if (!this.gameState) return null;
    
    const health = this.world.getComponent(this.gameState.ecsPlayerId, 'health');
    if (health) {
      return {
        current: (health as any).currentHp,
        max: (health as any).maxHp
      };
    }
    return null;
  }

  getPlayerHunger(): { current: number; max: number } | null {
    if (!this.gameState) return null;
    
    const hunger = this.world.getComponent(this.gameState.ecsPlayerId, 'hunger');
    if (hunger) {
      return {
        current: (hunger as any).currentValue,
        max: (hunger as any).maxValue
      };
    }
    return null;
  }

  getPlayerPosition(): { x: number; y: number } | null {
    if (!this.gameState) return null;
    
    const position = this.world.getComponent(this.gameState.ecsPlayerId, 'position');
    if (position) {
      return {
        x: (position as any).x,
        y: (position as any).y
      };
    }
    return null;
  }

  getPlayerInventory(): Array<{ id: string; name: string; identified: boolean; cursed: boolean }> | null {
    if (!this.gameState) return null;
    
    const inventory = this.world.getComponent(this.gameState.ecsPlayerId, 'inventory');
    if (inventory) {
      return (inventory as any).items.map((item: any) => ({
        id: item.id,
        name: item.name,
        identified: item.identified,
        cursed: item.cursed
      }));
    }
    return null;
  }

  getMonstersAtPosition(position: { x: number; y: number }): Array<{ id: string; health: number; maxHealth: number }> | null {
    if (!this.gameState) return null;
    
    const monsters: Array<{ id: string; health: number; maxHealth: number }> = [];
    
    // 位置コンポーネントを持つエンティティを検索
    const entitiesWithPosition = this.world.getComponentManager().getEntitiesWithComponent('position');
    
    for (const entityId of entitiesWithPosition) {
      if (entityId === this.gameState.ecsPlayerId) continue; // プレイヤーは除外
      
      const pos = this.world.getComponent(entityId, 'position');
      const health = this.world.getComponent(entityId, 'health');
      
      if (pos && health && (pos as any).x === position.x && (pos as any).y === position.y) {
        monsters.push({
          id: entityId,
          health: (health as any).currentHp,
          maxHealth: (health as any).maxHp
        });
      }
    }
    
    return monsters.length > 0 ? monsters : null;
  }

  getItemsAtPosition(position: { x: number; y: number }): Array<{ id: string; name: string; identified: boolean }> | null {
    if (!this.gameState) return null;
    
    const itemSystem = this.getSystem('item');
    if (itemSystem) {
      return (itemSystem as any).getItemsAtPosition({ x: position.x, y: position.y })
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          identified: item.identified
        }));
    }
    return null;
  }
}
