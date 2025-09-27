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
import { DropSystem } from '../systems/DropSystem.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { TilesetManager } from './TilesetManager.js';
import { ItemSpriteManager } from './ItemSpriteManager.js';
import { MonsterSpriteManager } from './MonsterSpriteManager.js';
import { WebConfigLoader } from './WebConfigLoader.js';
import { UIManager } from './ui/UIManager.js';
import { DamageDisplayManager } from './DamageDisplayManager.js';
import { FontManager } from '../core/FontManager.js';
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
  dropSystem: DropSystem;
  renderer: CanvasRenderer;
  tilesetManager: TilesetManager | null;
  damageDisplayManager: DamageDisplayManager;
}

export class GameInitializer {
  private configLoader: WebConfigLoader;
  private damageDisplayManager: DamageDisplayManager | null = null;

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
    
    // FontManagerを初期化
    if (config.ui?.fonts) {
      FontManager.getInstance(config.ui.fonts);
    } else {
      FontManager.createDefault();
    }
    
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
      reg.loadFromConfig(config?.items?.templates || {});
    } catch (e) {
      console.warn('ItemRegistry load failed (continuing with defaults):', e);
    }

    // Monsterテンプレートをレジストリに読み込み（あれば）
    try {
      const { MonsterRegistry } = await import('../core/MonsterRegistry.js');
      const reg = MonsterRegistry.getInstance();
      
      // characters.jsonのtemplates配列をオブジェクト形式に変換
      const templatesArray = config?.monsters?.templates || [];
      const templatesObject: any = {};
      templatesArray.forEach((template: any) => {
        if (template.id) {
          templatesObject[template.id] = template;
        }
      });
      
      console.log('[DEBUG] MonsterRegistry: Loading templates:', templatesObject);
      reg.loadFromConfig(templatesObject);
    } catch (e) {
      console.warn('MonsterRegistry load failed (continuing with defaults):', e);
    }
    // 先に ItemSystem を生成してから MovementSystem に渡す
    const itemSystem = new ItemSystem(dungeonManager);
    // レジストリ優先でテンプレートを反映（レジストリが空の場合はItemSystem内デフォルトのまま）
    try {
      await itemSystem.reloadTemplatesFromRegistry?.();
    } catch {}
    const movementSystem = new MovementSystem(dungeonManager, itemSystem);
    
    // 満腹度システムの生成
    const hungerSystem = new HungerSystem(config.player?.hungerConfig);

    // ダメージ表示マネージャーの生成
    const damageDisplayManager = new DamageDisplayManager();

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
    combatSystem.setTurnSystem(turnSystem);
    combatSystem.setMessageSink((msg: string) => uiSystem.pushMessage(msg));
    // ダメージ表示マネージャーを設定
    this.damageDisplayManager = damageDisplayManager;
    combatSystem.setDamageDisplayManager(this.damageDisplayManager);

    // 満腹度のメッセージをUIへ
    hungerSystem.setMessageSink?.((msg: string) => uiSystem.pushMessage(msg));

    // DropSystem を MultipleDungeonSystem に登録（フロア生成時の床アイテムスポーン用）
    const { DropSystem } = await import('../systems/DropSystem.js');
    const dropSystem = new DropSystem(dungeonManager, itemSystem);
    multipleDungeonSystem.setDropSystem(dropSystem);
    
    // TurnSystem を MultipleDungeonSystem に登録（フロア移動時のターン数リセット用）
    multipleDungeonSystem.setTurnSystem(turnSystem);

    return {
      dungeonManager,
      multipleDungeonSystem,
      uiSystem,
      combatSystem,
      inputSystem,
      movementSystem,
      turnSystem,
      itemSystem,
      dropSystem,
      renderer: null as any, // 後で設定
      tilesetManager: null,
      damageDisplayManager,
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
    const { dungeonManager, multipleDungeonSystem, uiSystem, dropSystem } = systems;

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

    // 初期フロアにアイテムをスポーン
    if (dropSystem) {
      const template = dungeonManager.getTemplate('beginner-cave');
      if (template) {
        dropSystem.spawnFloorItems(template, 1);
      }
    }

    // 初期フロアに敵をスポーン
    if (systems.turnSystem) {
      await systems.turnSystem.executeFloorInitialSpawn();
      console.log('[GameInitializer] 初期フロアの敵スポーン完了');
      
      // 初期スポーン後のエンティティでターン順序を再初期化
      const entitiesAfterSpawn = dungeonManager.getAllEntities();
      systems.turnSystem.initializeTurnOrder(entitiesAfterSpawn);
      console.log(`[GameInitializer] 初期スポーン後のターン順序再初期化完了（${entitiesAfterSpawn.length}体）`);
    }

    // UISystemにUIManagerを設定（後で行う）
  }




  private async addTestItems(systems: GameSystems, player: PlayerEntity, spawn: Position): Promise<void> {
    // テスト用アイテムを初期インベントリに追加（地形感知5個 + 敵感知3個 + アイテム感知2個）
    const testItemTemplates = [
      { id: '6', count: 5 },  // 地形感知の巻物
      { id: '7', count: 3 },  // 敵感知の巻物
      { id: '8', count: 2 }   // アイテム感知の巻物
    ];

    for (const template of testItemTemplates) {
      for (let i = 0; i < template.count; i++) {
        const item = ItemEntity.createFromTemplate(template.id, { x: 0, y: 0 }, systems.itemSystem);
        if (item) {
          // テスト用なので識別済みにする
          item.identify();
          player.addToInventory(item);
        }
      }
    }
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
    
    // DungeonManagerをCanvasRendererに設定（アイテム感知効果用）
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

    // ダメージ表示マネージャーをレンダラーとUIManagerに設定
    if (this.damageDisplayManager) {
      renderer.setDamageDisplayManager(this.damageDisplayManager);
      uiManager.setDamageDisplayManager(this.damageDisplayManager);
    }

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
