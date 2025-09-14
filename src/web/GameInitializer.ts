import { DungeonManager } from '../dungeon/DungeonManager.js';
import { MultipleDungeonSystem } from '../systems/MultipleDungeonSystem.js';
import { PlayerEntity } from '../entities/Player.js';
import { ItemEntity } from '../entities/Item.js';
import { MonsterEntity } from '../entities/Monster.js';
import { CompanionEntity } from '../entities/Companion.js';
import { GameEntity } from '../types/entities.js';
import { UISystem } from '../systems/UISystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { InputSystem } from '../systems/InputSystem.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { TurnSystem } from '../systems/TurnSystem.js';
import { HungerSystem } from '../systems/HungerSystem.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { TilesetManager } from './TilesetManager.js';
import { ItemSpriteManager } from './ItemSpriteManager.js';
import { MonsterSpriteManager } from './MonsterSpriteManager.js';
import { WebConfigLoader } from './WebConfigLoader.js';
import { UIManager } from './ui/UIManager.js';
import type { Position } from '../types/core.js';

// ECS統合のためのインポート - 削除済み

export interface GameSystems {
  dungeonManager: DungeonManager;
  multipleDungeonSystem: MultipleDungeonSystem;
  uiSystem: UISystem;
  combatSystem: CombatSystem;
  inputSystem: InputSystem;
  movementSystem: MovementSystem;
  turnSystem: TurnSystem;
  itemSystem: ItemSystem;
  renderer: CanvasRenderer;
  tilesetManager: TilesetManager | null;
}

export class GameInitializer {
  private configLoader: WebConfigLoader;

  constructor() {
    this.configLoader = new WebConfigLoader();
  }

  async initialize(): Promise<{
    systems: GameSystems;
    player: PlayerEntity;
    uiManager: UIManager;
    config: any;
  }> {
    // 設定の読み込み
    const config = await this.configLoader.loadGameConfig();
    
    // UIの作成
    const uiManager = await this.createUI(config);

    // システムの初期化
    const systems = await this.initializeSystems(config);

    // 非ECSプレイヤーの作成（段階的移行のため残存）
    const player = await this.createPlayer(config);

    // TurnSystemにプレイヤーエンティティを設定
    systems.turnSystem.setPlayerEntity(player);

    // ダンジョンの初期化
    await this.initializeDungeon(systems, player, config);

    // テスト用モンスターの追加
    await this.addTestMonsters(systems, player, config);

    // テスト用アイテムの追加
    const spawn = player.position;
    await this.addTestItems(systems, player, spawn);

    // レンダラーの設定
    await this.setupRenderer(systems, uiManager, config);

    // ミニマップの設定
    this.setupMinimap(systems, uiManager);

    // ゲーム情報オーバーレイの作成
    uiManager.createGameInfoOverlay();

    return { systems, player, uiManager, config };
  }

  private async createUI(config: any): Promise<UIManager> {
    const app = document.querySelector('#app') as HTMLElement;
    if (!app) throw new Error('Element not found: #app');
    
    const uiManager = new UIManager(config, app);
    uiManager.createLayout();
    return uiManager;
  }

  private async initializeSystems(config: any): Promise<GameSystems> {
    const dungeonManager = new DungeonManager();
    const multipleDungeonSystem = new MultipleDungeonSystem(dungeonManager);
    const uiSystem = new UISystem(dungeonManager);
    const combatSystem = new CombatSystem();
    const inputSystem = new InputSystem(config);
    // Itemテンプレートをレジストリに読み込み（あれば）
    try {
      const { ItemRegistry } = await import('../core/ItemRegistry.js');
      const reg = ItemRegistry.getInstance();
      reg.loadFromConfig(config?.items?.templates || []);
    } catch (e) {
      console.warn('ItemRegistry load failed (continuing with defaults):', e);
    }
    // 先に ItemSystem を生成してから MovementSystem に渡す
    const itemSystem = new ItemSystem(dungeonManager);
    // レジストリ優先でテンプレートを反映（レジストリが空の場合はItemSystem内デフォルトのまま）
    try {
      itemSystem.reloadTemplatesFromRegistry?.();
    } catch {}
    const movementSystem = new MovementSystem(dungeonManager, itemSystem);
    
    // 満腹度システムの生成
    const hungerSystem = new HungerSystem(config.player?.hungerConfig);

    const turnSystem = new TurnSystem(
      config.turnSystem,
      dungeonManager,
      combatSystem,
      hungerSystem, // hungerSystem を注入
      undefined, // statusSystem - 後で設定
      undefined  // playerEntity - 後で設定
    );
    // 自然スポーンはデフォルト設定のまま利用
    
    // AISystemを作成（TurnSystemの参照を渡す）
    const { AISystem } = await import('../systems/AISystem.js');
    const aiSystem = new AISystem(dungeonManager, movementSystem, combatSystem, turnSystem);
    
    // DungeonManagerにAISystemを設定
    dungeonManager.aiSystem = aiSystem;

    // システム間の依存関係を設定
    uiSystem.setItemSystem(itemSystem);
    // アイテム取得時などのメッセージをUIログへ
    itemSystem.setMessageSink((msg: string) => uiSystem.pushMessage(msg));
    // 戦闘結果のメッセージや撃破時の取り除きに必要な参照を設定
    combatSystem.setDungeonManager(dungeonManager);
    combatSystem.setMessageSink((msg: string) => uiSystem.pushMessage(msg));

    // 満腹度のメッセージをUIへ
    hungerSystem.setMessageSink?.((msg: string) => uiSystem.pushMessage(msg));

    // DropSystem を MultipleDungeonSystem に登録（フロア生成時の床アイテムスポーン用）
    const { DropSystem } = await import('../systems/DropSystem.js');
    const dropSystem = new DropSystem(dungeonManager, itemSystem);
    multipleDungeonSystem.setDropSystem(dropSystem);

    return {
      dungeonManager,
      multipleDungeonSystem,
      uiSystem,
      combatSystem,
      inputSystem,
      movementSystem,
      turnSystem,
      itemSystem,
      renderer: null as any, // 後で設定
      tilesetManager: null,
      // ECS統合

    };
  }

  private async createPlayer(config: any): Promise<PlayerEntity> {
    // 設定ファイルからキャラクター情報を取得
    const characterInfo = config.player?.characterInfo || {
      name: 'Hero',
      gender: 'male' as const,
      age: 20,
      height: 170,
      weight: 70,
      race: 'human' as const,
      class: 'unemployed' as const,
      stats: {
        STR: 10,
        DEX: 10,
        INT: 10,
        CON: 10,
        POW: 10,
        APP: 10,
        LUK: 10
      },
      features: []
    };
    
    return new PlayerEntity('player-1', characterInfo, { x: 0, y: 0 });
  }

  private async initializeDungeon(
    systems: GameSystems,
    player: PlayerEntity,
    config: any
  ): Promise<void> {
    const { dungeonManager, multipleDungeonSystem, uiSystem } = systems;

    const select = multipleDungeonSystem.selectDungeon('beginner-cave', player);
    if (!select.success) {
      throw new Error(`Failed to enter dungeon: ${select.message}`);
    }

    const dungeon = dungeonManager.getCurrentDungeon();
    if (!dungeon) {
      throw new Error('No dungeon generated');
    }

    const spawn: Position = dungeon.playerSpawn;
    player.setPosition(spawn);
    dungeonManager.addEntity(player as any, spawn);

    // UISystemにUIManagerを設定（後で行う）
  }

  private async addTestMonsters(
    systems: GameSystems,
    player: PlayerEntity,
    config: any
  ): Promise<void> {
    const { dungeonManager } = systems;
    const spawn = player.position;

    // 設定ファイルのモンスターテンプレートを使用
    if (config.monsters?.templates) {
      
      // スポーン数を計算
      const spawnCount = this.calculateMonsterSpawnCount(dungeonManager, config);
      
      // 各テンプレートから指定された数だけ作成
      for (const template of config.monsters.templates) {
        
        for (let i = 0; i < spawnCount; i++) {
          // フロア全体のランダムな位置を取得
          const randomPosition = this.getRandomFloorPosition(dungeonManager, player);
          if (!randomPosition) {
            break; // 位置が見つからない場合は終了
          }
          
          // テンプレートからモンスターを作成
          const characterInfo = {
            name: template.name,
            gender: 'other' as const,
            age: 0,
            height: 150,
            weight: 50,
            race: 'human' as const,
            class: 'unemployed' as const,
            stats: {
              STR: template.characterStats?.STR || 5,
              DEX: template.characterStats?.DEX || 10,
              INT: template.characterStats?.INT || 5,
              CON: template.characterStats?.CON || 2,
              POW: template.characterStats?.POW || 5,
              APP: template.characterStats?.APP || 5,
              LUK: template.characterStats?.LUK || 5
            },
            features: []
          };
          
          const monster = new MonsterEntity(
            `${template.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            characterInfo,
            template.monsterType,
            randomPosition,
            undefined, // attributes
            template.movementPattern || 'approach',
            template.movementConfig,
            template.spriteId,
            template.experienceValue,
            template.dropRate,
            template.dropTableId,
            template.level,
            template.description,
            template.spritesheet
          );

          // ドロップテーブルを設定ファイルから取得して設定
          // まずダンジョンテンプレートのマッピングを確認
          const currentDungeonId = dungeonManager.getCurrentDungeon()?.id;
          if (currentDungeonId) {
            const dungeonTemplate = dungeonManager.getTemplate(currentDungeonId);
            if (template.dropTableId && dungeonTemplate?.dropTableMapping?.[template.dropTableId]) {
              const actualDropTableId = dungeonTemplate.dropTableMapping[template.dropTableId];
              if (config.monsters?.dropTables?.[actualDropTableId]) {
                monster.dropTable = config.monsters.dropTables[actualDropTableId];
              }
            }
          }
          
          // 初期方向を設定
          monster.currentDirection = 'front';
          
          
          // モンスターをダンジョンに追加
          dungeonManager.addEntity(monster as any, randomPosition);
          console.log(`Added test monster: ${monster.characterInfo.name} at (${randomPosition.x}, ${randomPosition.y})`);
        }
      }
    } else {
    }
    
  }

  /**
   * モンスターのスポーン数を計算
   */
  private calculateMonsterSpawnCount(dungeonManager: any, config: any): number {
    // 部屋の数を取得
    const roomCount = dungeonManager.currentDungeon?.rooms?.length || 0;
    
    // 基本スポーン数（部屋の数）
    const baseSpawnCount = roomCount;
    
    // ランダム変動（-2〜+2）
    const randomVariation = config.monsters?.spawnLimits?.randomVariation || 2;
    const variation = Math.floor(Math.random() * (randomVariation * 2 + 1)) - randomVariation;
    
    // 最終スポーン数
    let finalSpawnCount = baseSpawnCount + variation;
    
    // 上限チェック
    const maxPerFloor = config.monsters?.spawnLimits?.maxPerFloor || 50;
    finalSpawnCount = Math.min(finalSpawnCount, maxPerFloor);
    
    // 最小値チェック（最低1体）
    finalSpawnCount = Math.max(finalSpawnCount, 1);
    
    
    return finalSpawnCount;
  }

  /**
   * 部屋内のランダムな位置を取得（プレイヤー、敵、味方と重ならない位置）
   */
  private getRandomFloorPosition(dungeonManager: any, player: PlayerEntity): Position | null {
    // 部屋内の位置のリストを取得
    const roomPositions: Position[] = [];
    
    // フロア全体をスキャンして部屋内の位置を収集
    for (let x = 0; x < 45; x++) {
      for (let y = 0; y < 45; y++) {
        const position = { x, y };
        const cell = dungeonManager.getCellAt(position);
        
        // 部屋内で歩行可能な位置のみ
        if (cell && cell.type === 'room' && cell.walkable) {
          roomPositions.push(position);
        }
      }
    }
    
    // 部屋内の位置がない場合
    if (roomPositions.length === 0) {
      return null;
    }
    
    // プレイヤー、敵、味方がいる位置を除外
    const availablePositions = roomPositions.filter(position => 
      this.isValidMonsterPosition(dungeonManager, position, player)
    );
    
    if (availablePositions.length === 0) {
      return null;
    }
    
    // 利用可能な部屋位置からランダムで選択
    const randomIndex = Math.floor(Math.random() * availablePositions.length);
    return availablePositions[randomIndex];
  }

  /**
   * モンスターの位置が有効かチェック
   */
  private isValidMonsterPosition(dungeonManager: any, position: Position, player: PlayerEntity): boolean {
    // 歩行可能な位置かチェック
    if (!dungeonManager.isWalkable(position)) {
      return false;
    }
    
    // プレイヤーと重ならないかチェック
    if (position.x === player.position.x && position.y === player.position.y) {
      return false;
    }
    
    // 他の敵や味方と重ならないかチェック
    const entitiesAtPosition = dungeonManager.getEntitiesAt(position);
    const hasEnemyOrAlly = entitiesAtPosition.some((entity: GameEntity) => 
      entity instanceof MonsterEntity || 
      entity instanceof CompanionEntity
    );
    
    if (hasEnemyOrAlly) {
      return false;
    }
    
    return true;
  }

  private async addTestItems(systems: GameSystems, player: PlayerEntity, spawn: Position): Promise<void> {
    // テスト用アイテムを初期インベントリに追加（レミーラ5個 + 透視3個 + 千里眼2個）
    const testItems = [
      {
        id: 'scroll-remilla-1',
        name: 'レミーラの巻物',
        effect: { type: 'reveal-map', value: 1, description: 'フロア全体の地形と罠の位置を表示' }
      },
      {
        id: 'scroll-remilla-2',
        name: 'レミーラの巻物',
        effect: { type: 'reveal-map', value: 1, description: 'フロア全体の地形と罠の位置を表示' }
      },
      {
        id: 'scroll-remilla-3',
        name: 'レミーラの巻物',
        effect: { type: 'reveal-map', value: 1, description: 'フロア全体の地形と罠の位置を表示' }
      },
      {
        id: 'scroll-remilla-4',
        name: 'レミーラの巻物',
        effect: { type: 'reveal-map', value: 1, description: 'フロア全体の地形と罠の位置を表示' }
      },
      {
        id: 'scroll-remilla-5',
        name: 'レミーラの巻物',
        effect: { type: 'reveal-map', value: 1, description: 'フロア全体の地形と罠の位置を表示' }
      },
      {
        id: 'scroll-monster-vision-1',
        name: '透視の巻物',
        effect: { type: 'reveal-monsters', value: 1, description: 'フロア全体のモンスターの位置を表示' }
      },
      {
        id: 'scroll-monster-vision-2',
        name: '透視の巻物',
        effect: { type: 'reveal-monsters', value: 1, description: 'フロア全体のモンスターの位置を表示' }
      },
      {
        id: 'scroll-monster-vision-3',
        name: '透視の巻物',
        effect: { type: 'reveal-monsters', value: 1, description: 'フロア全体のモンスターの位置を表示' }
      },
      {
        id: 'scroll-clairvoyance-1',
        name: '千里眼の巻物',
        effect: { type: 'reveal-items', value: 1, description: 'フロア全体のアイテムの位置を表示' }
      },
      {
        id: 'scroll-clairvoyance-2',
        name: '千里眼の巻物',
        effect: { type: 'reveal-items', value: 1, description: 'フロア全体のアイテムの位置を表示' }
      }
    ];

    for (const itemData of testItems) {
      // テンプレートからアイテムを作成
      const item = ItemEntity.createFromTemplateObject({
        id: itemData.id,
        name: itemData.name,
        itemType: 'consumable',
        identified: true,
        cursed: false,
        effects: [itemData.effect]
      }, { x: 0, y: 0 });
      
      if (item) {
        player.addToInventory(item);
      }
    }

    // テスト用アイテムは削除済み（既存のデフォルトアイテムでスプライト表示をテスト）
  }

  private async setupRenderer(
    systems: GameSystems,
    uiManager: UIManager,
    config: any
  ): Promise<void> {
    const { dungeonManager, multipleDungeonSystem, uiSystem } = systems;
    
    const canvas = uiManager.getGameCanvas();
    if (!canvas) {
      throw new Error('Game canvas not found');
    }
    
    const renderer = new CanvasRenderer(canvas, config.ui.viewport.tileSize);
    
    // DungeonManagerをCanvasRendererに設定（千里眼効果用）
    renderer.setDungeonManager(dungeonManager);
    
    // UISystemにレンダラーを設定
    uiSystem.setRenderer(renderer);
    
    // MultipleDungeonSystemにレンダラーを設定（フロア変更時の効果管理用）
    multipleDungeonSystem.setRenderer(renderer);

    // タイルセットマネージャーの初期化
    let tilesetManager: TilesetManager | null = null;
    try {
      if (config.dungeon?.defaultTileset) {
        console.log('Dungeon tileset config found');
        
        // 現在のダンジョンIDを取得
        const currentDungeon = dungeonManager.getCurrentDungeon();
        const dungeonId = currentDungeon?.id || 'beginner-cave';
        
        // ダンジョン別の設定を取得
        const tilesetConfig = TilesetManager.getDungeonTilesetConfig(
          config.dungeon,
          dungeonId
        );
        
        console.log(`Using tileset for dungeon: ${dungeonId}`);
        tilesetManager = new TilesetManager(tilesetConfig, dungeonId);
        
        // 画像の読み込み完了を待ってからレンダラーに設定
        try {
          await tilesetManager.load();
          console.log('Tileset loaded successfully');
          renderer.setTilesetManager(tilesetManager);
          renderer.setGameConfig(config);
        } catch (error) {
          console.warn('Failed to load tileset:', error);
          renderer.setTilesetManager(tilesetManager);
          renderer.setGameConfig(config);
        }
      }
    } catch (error) {
      console.warn('Failed to load tileset:', error);
    }

    // アイテムスプライトマネージャーの初期化
    let itemSpriteManager: ItemSpriteManager | null = null;
    try {
      if (config.items?.spritesheet) {
        console.log('Item spritesheet config found');
        
        itemSpriteManager = new ItemSpriteManager(config.items.spritesheet);
        
        // 画像の読み込み完了を待ってからレンダラーに設定
        try {
          await itemSpriteManager.load();
          console.log('Item spritesheet loaded successfully');
          renderer.setItemSpriteManager(itemSpriteManager);
        } catch (error) {
          console.warn('Failed to load item spritesheet:', error);
          renderer.setItemSpriteManager(itemSpriteManager);
        }
      }
    } catch (error) {
      console.warn('Failed to load item spritesheet:', error);
    }

    // 敵のスプライトマネージャーの初期化
    let monsterSpriteManager: MonsterSpriteManager | null = null;
    try {
      if (config.monsters?.spritesheets) {
        console.log('Monster spritesheets config found');
        
        // 複数スプライトシートとアニメーション設定を渡す
        const monsterConfig = {
          ...config.monsters.spritesheets,
          animations: config.monsters.animations
        };
        
        monsterSpriteManager = new MonsterSpriteManager(monsterConfig);
        
        // 画像の読み込み完了を待ってからレンダラーに設定
        try {
          await monsterSpriteManager.load();
          console.log('Monster spritesheets loaded successfully');
          renderer.setMonsterSpriteManager(monsterSpriteManager);
        } catch (error) {
          console.warn('Failed to load monster spritesheets:', error);
          renderer.setMonsterSpriteManager(monsterSpriteManager);
        }
      }
    } catch (error) {
      console.warn('Failed to load monster spritesheets:', error);
    }
    
    // 設定からビューポートを設定
    renderer.setViewportTiles(config.ui.viewport.tilesX, config.ui.viewport.tilesY);
    renderer.setTileSize(config.ui.viewport.tileSize);

    // システムにレンダラーを設定
    systems.renderer = renderer;
    systems.tilesetManager = tilesetManager;

    // 初回入場時のアイキャッチ演出
    try {
      const currentDungeon = dungeonManager.getCurrentDungeon();
      if (currentDungeon) {
        await renderer.playFloorTransition(currentDungeon.name, currentDungeon.floor);
      }
    } catch (e) {
      console.warn('Initial floor transition effect failed:', e);
    }
  }

  private setupMinimap(systems: GameSystems, uiManager: UIManager): void {
    const { renderer } = systems;
    
    // ミニマップ接続
    const minimap = uiManager.setupMinimap();
    if (minimap) {
      renderer.attachMinimap(minimap);
    }
  }

}
